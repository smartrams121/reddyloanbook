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

const ACTION_COLORS: Record<string, [number, number, number]> = {
  EDIT_LOAN: [217, 119, 6],
  DELETE_LOAN: [220, 38, 38],
  EDIT_CUSTOMER: [217, 119, 6],
  DELETE_CUSTOMER: [220, 38, 38],
  CUSTOMER_MERGE: [147, 51, 234],
  EDIT_PAYMENT: [234, 88, 12],
  CHANGE_PERMISSIONS: [37, 99, 235],
  SUSPEND_EMPLOYEE: [202, 138, 4],
  ACTIVATE_EMPLOYEE: [22, 163, 74],
  DELETE_EMPLOYEE: [220, 38, 38],
  PASSWORD_RESET: [107, 114, 128],
}

function fmtVal(val: unknown): string {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') return JSON.stringify(val)
  if (typeof val === 'number' && val > 100) return `₹${(val / 100).toLocaleString('en-IN')}`
  return String(val)
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

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true, owner: { select: { organizationName: true } } } })

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

  const pageW = 515
  const left = 40

  // Header
  doc.rect(left, 40, pageW, 50).fill('#1e3a5f')
  doc.fontSize(16).font('NotoSans-Bold').fillColor('#ffffff').text('AUDIT LOGS', left + 15, 50)
  doc.fontSize(9).font('NotoSans').text(business?.owner?.organizationName || business?.name || '', left + 15, 68)
  doc.fillColor('#000000')

  // Sub-header
  doc.fontSize(8).font('NotoSans').fillColor('#6b7280')
  doc.text(`Period: ${from} to ${to}  ·  ${logs.length} entries  ·  Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, left, 100)
  doc.moveDown(0.8)

  if (logs.length === 0) {
    doc.fontSize(10).font('NotoSans').fillColor('#9ca3af').text('No audit log entries found for this period.', left, 130, { align: 'center', width: pageW })
  }

  let seq = 1
  for (const log of logs) {
    const blockHeight = 50
    if (doc.y + blockHeight > 750) doc.addPage()

    const startY = doc.y
    const date = new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    const actionLabel = log.action.replace(/_/g, ' ')
    const role = log.user.role === 'BUSINESS_ADMIN' ? 'Partner' : log.user.role
    const color = ACTION_COLORS[log.action] || [107, 114, 128]

    // Entry number + action badge
    doc.fontSize(8).font('NotoSans-Bold').fillColor('#9ca3af').text(`#${seq}`, left, startY)

    // Action badge
    const badgeX = left + 25
    const badgeW = doc.widthOfString(actionLabel) + 12
    doc.roundedRect(badgeX, startY - 1, badgeW, 14, 3).fill(`rgb(${color[0]}, ${color[1]}, ${color[2]})`)
    doc.fontSize(7).font('NotoSans-Bold').fillColor('#ffffff').text(actionLabel, badgeX + 6, startY + 2)
    doc.fillColor('#000000')

    // Entity info
    const oldValues = log.oldValues ? JSON.parse(log.oldValues) : null
    const newValues = log.newValues ? JSON.parse(log.newValues) : null
    const entityInfo = newValues?.customer ? `${newValues.customer}` : ''
    const loanInfo = newValues?.loan ? ` · ${newValues.loan}` : ''
    const receiptInfo = newValues?.receipt ? ` · ${newValues.receipt}` : ''
    doc.fontSize(7).font('NotoSans').fillColor('#374151').text(`${log.entityType}${entityInfo ? ' · ' + entityInfo : ''}${loanInfo}${receiptInfo}`, badgeX + badgeW + 8, startY + 2)

    // Date on the right
    doc.fontSize(7).font('NotoSans').fillColor('#9ca3af').text(date, left, startY + 2, { width: pageW, align: 'right' })

    // User info
    doc.fillColor('#6b7280').fontSize(7).font('NotoSans')
    doc.text(`${log.user.fullName} (@${log.user.username}) · ${role}`, left + 25, startY + 16)

    // Changes table
    const fields = Array.from(new Set(Object.keys(oldValues || {}).concat(Object.keys(newValues || {}))))
    const displayFields = fields.filter(f => f !== 'customer' && f !== 'loan' && f !== 'receipt')

    if (displayFields.length > 0) {
      const tableY = startY + 30
      const colField = left + 25
      const colBefore = left + 140
      const colAfter = left + 330

      // Table header
      doc.rect(colField, tableY, pageW - 25, 12).fill('#f3f4f6')
      doc.fontSize(6.5).font('NotoSans-Bold').fillColor('#6b7280')
      doc.text('FIELD', colField + 4, tableY + 3)
      doc.text('BEFORE', colBefore + 4, tableY + 3)
      doc.text('AFTER', colAfter + 4, tableY + 3)

      let rowY = tableY + 14
      doc.font('NotoSans').fontSize(7).fillColor('#374151')

      for (const field of displayFields) {
        if (rowY > 750) { doc.addPage(); rowY = 50 }

        const oldStr = fmtVal(oldValues?.[field])
        const newStr = fmtVal(newValues?.[field])

        // Alternate row shading
        if (displayFields.indexOf(field) % 2 === 1) {
          doc.rect(colField, rowY - 1, pageW - 25, 12).fill('#f9fafb')
        }

        doc.fillColor('#6b7280').text(field, colField + 4, rowY + 1, { width: 110 })
        doc.fillColor('#dc2626').text(oldStr, colBefore + 4, rowY + 1, { width: 180 })
        doc.fillColor('#16a34a').text(newStr, colAfter + 4, rowY + 1, { width: 180 })
        rowY += 13
      }
      doc.y = rowY + 4
    } else {
      doc.y = startY + 30
    }

    // Separator
    doc.moveTo(left, doc.y).lineTo(left + pageW, doc.y).lineWidth(0.5).stroke('#e5e7eb')
    doc.moveDown(0.4)
    seq++
  }

  // Footer on each page
  const pages = doc.bufferedPageRange()
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i)
    doc.fontSize(6).font('NotoSans').fillColor('#9ca3af')
    doc.text(`Page ${i + 1} of ${pages.count}  ·  Internal Use Only  ·  ${business?.name || ''}`, left, 810, { width: pageW, align: 'center' })
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
