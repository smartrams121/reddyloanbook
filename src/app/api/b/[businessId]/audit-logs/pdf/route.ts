import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { Role } from '@/lib/constants'
import PDFDocument from 'pdfkit'
import { setupFonts } from '@/lib/pdf-helpers'

interface Props {
  params: Promise<{ businessId: string }>
}

export async function GET(request: NextRequest, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  if (user.role === Role.AGENT) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const action = searchParams.get('action')

  const where: Record<string, unknown> = { businessId }
  if (from && to) {
    where.createdAt = { gte: new Date(`${from}T00:00:00+05:30`), lte: new Date(`${to}T23:59:59+05:30`) }
  }
  if (action) where.action = action

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } })

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { fullName: true, username: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  setupFonts(doc)

  doc.fontSize(14).font('NotoSans-Bold').text(`Audit Logs — ${business?.name || 'Unknown'}`)
  doc.fontSize(8).font('NotoSans').text(`${from} to ${to} · ${logs.length} entries · Generated ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`)
  doc.moveDown(1)

  for (const log of logs) {
    if (doc.y > 700) doc.addPage()

    const date = new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    const actionLabel = log.action.replace(/_/g, ' ')
    const role = log.user.role === 'BUSINESS_ADMIN' ? 'Partner' : log.user.role

    doc.fontSize(9).font('NotoSans-Bold').text(`${actionLabel} — ${log.entityType} #${log.entityId.slice(-6)}`, { continued: false })
    doc.fontSize(7).font('NotoSans').text(`${log.user.fullName} (@${log.user.username}, ${role}) · ${date}`)

    const oldValues = log.oldValues ? JSON.parse(log.oldValues) : null
    const newValues = log.newValues ? JSON.parse(log.newValues) : null
    const fields = Array.from(new Set(Object.keys(oldValues || {}).concat(Object.keys(newValues || {}))))

    if (fields.length > 0) {
      const y = doc.y + 2
      doc.fontSize(7).font('NotoSans-Bold')
      doc.text('Field', 50, y, { width: 100 })
      doc.text('Before', 150, y, { width: 150 })
      doc.text('After', 310, y, { width: 150 })
      doc.moveTo(50, y + 10).lineTo(500, y + 10).stroke('#e5e7eb')

      let rowY = y + 12
      doc.font('NotoSans').fontSize(7)
      for (const field of fields) {
        if (rowY > 750) { doc.addPage(); rowY = 50 }
        const oldVal = oldValues?.[field]
        const newVal = newValues?.[field]
        const oldStr = oldVal === null || oldVal === undefined ? '-' : typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)
        const newStr = newVal === null || newVal === undefined ? '-' : typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)
        doc.text(field, 50, rowY, { width: 100 })
        doc.text(oldStr, 150, rowY, { width: 150 })
        doc.text(newStr, 310, rowY, { width: 150 })
        rowY += 11
      }
      doc.y = rowY
    }

    doc.moveDown(0.5)
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#e5e7eb')
    doc.moveDown(0.3)
  }

  doc.end()

  await new Promise<void>(resolve => doc.on('end', resolve))
  const buffer = Buffer.concat(chunks)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="audit-logs-${from}-${to}.pdf"`,
    },
  })
}
