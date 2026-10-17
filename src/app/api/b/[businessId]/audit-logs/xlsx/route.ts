import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { Role } from '@/lib/constants'
import ExcelJS from 'exceljs'

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

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Audit Logs')

  ws.columns = [
    { header: '#', key: 'seq', width: 5 },
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Action', key: 'action', width: 20 },
    { header: 'Entity', key: 'entity', width: 12 },
    { header: 'User', key: 'user', width: 20 },
    { header: 'Role', key: 'role', width: 12 },
    { header: 'Field', key: 'field', width: 18 },
    { header: 'Before', key: 'before', width: 25 },
    { header: 'After', key: 'after', width: 25 },
  ]

  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3b5998' } }

  let seq = 1
  for (const log of logs) {
    const date = new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    const actionLabel = log.action.replace(/_/g, ' ')
    const role = log.user.role === 'BUSINESS_ADMIN' ? 'Partner' : log.user.role

    const oldValues = log.oldValues ? JSON.parse(log.oldValues) : {}
    const newValues = log.newValues ? JSON.parse(log.newValues) : {}
    const fields = Array.from(new Set(Object.keys(oldValues).concat(Object.keys(newValues))))

    if (fields.length === 0) {
      ws.addRow({ seq, date, action: actionLabel, entity: log.entityType, user: log.user.fullName, role, field: '-', before: '-', after: '-' })
      seq++
    } else {
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i]
        const oldVal = oldValues[f] === undefined || oldValues[f] === null ? '-' : typeof oldValues[f] === 'object' ? JSON.stringify(oldValues[f]) : String(oldValues[f])
        const newVal = newValues[f] === undefined || newValues[f] === null ? '-' : typeof newValues[f] === 'object' ? JSON.stringify(newValues[f]) : String(newValues[f])
        ws.addRow({
          seq: i === 0 ? seq : '',
          date: i === 0 ? date : '',
          action: i === 0 ? actionLabel : '',
          entity: i === 0 ? log.entityType : '',
          user: i === 0 ? log.user.fullName : '',
          role: i === 0 ? role : '',
          field: f,
          before: oldVal,
          after: newVal,
        })
      }
      seq++
    }
  }

  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="audit-logs-${from}-${to}.xlsx"`,
    },
  })
}
