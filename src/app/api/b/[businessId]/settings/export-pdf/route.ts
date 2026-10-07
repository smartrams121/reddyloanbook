import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import PDFDocument from 'pdfkit'

interface Props {
  params: Promise<{ businessId: string }>
}

export async function GET(_request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { await assertBusinessAccess(user, businessId) } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true, city: true, collectionType: true } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [customers, loans, payments, villages, employees] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId },
      select: { customerId: true, fullName: true, phone: true, village: { select: { name: true } }, status: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.loan.findMany({
      where: { businessId },
      select: { loanNumber: true, loanAmount: true, totalRepayable: true, installmentAmount: true, startDate: true, expectedEndDate: true, status: true, customer: { select: { fullName: true, customerId: true } }, agent: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.findMany({
      where: { businessId, isDeleted: false },
      select: { receiptNumber: true, amount: true, paymentDate: true, note: true, loan: { select: { loanNumber: true, customer: { select: { fullName: true, customerId: true } } } }, collector: { select: { fullName: true } } },
      orderBy: { paymentDate: 'desc' },
    }),
    prisma.village.findMany({
      where: { businessId, isActive: true },
      select: { name: true, _count: { select: { customers: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.userBusinessAssignment.findMany({
      where: { businessId },
      include: { user: { select: { fullName: true, username: true, phone: true, role: true } } },
    }),
  ])

  const paidSums = await prisma.payment.groupBy({
    by: ['loanId'],
    where: { businessId, isDeleted: false },
    _sum: { amount: true },
  })
  const paidMap = new Map(paidSums.map(p => [p.loanId, p._sum.amount || 0]))

  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const title = `${business.name} — Collection Data`
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })

  function sectionHeader(text: string) {
    doc.addPage()
    doc.fontSize(16).font('Helvetica-Bold').text(text, { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(8).font('Helvetica').text(`${business!.name} · ${business!.city} · ${business!.collectionType} · ${date}`)
    doc.moveDown(1)
  }

  function tableRow(cols: string[], widths: number[], bold = false) {
    const y = doc.y
    if (y > 750) { doc.addPage(); return tableRow(cols, widths, bold) }
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7)
    let x = 40
    cols.forEach((col, i) => {
      doc.text(col, x, y, { width: widths[i], ellipsis: true })
      x += widths[i]
    })
    doc.y = y + 12
  }

  // Cover
  doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(10).font('Helvetica').text(`Generated: ${date}`, { align: 'center' })
  doc.moveDown(1)
  doc.fontSize(10).text(`Customers: ${customers.length} · Loans: ${loans.length} · Payments: ${payments.length} · Locations: ${villages.length} · Employees: ${employees.length}`, { align: 'center' })

  // 1. Customers
  sectionHeader(`Customers (${customers.length})`)
  const cw = [60, 120, 70, 120, 50]
  tableRow(['CID', 'Name', 'Phone', 'Location', 'Status'], cw, true)
  customers.forEach(c => tableRow([c.customerId, c.fullName, c.phone, c.village.name, c.status], cw))

  // 2. Loans
  sectionHeader(`Loans (${loans.length})`)
  const lw = [55, 90, 55, 60, 60, 55, 55, 60]
  tableRow(['Loan #', 'Customer', 'Principal', 'Repayable', 'Installment', 'Start', 'Due', 'Status'], lw, true)
  loans.forEach(l => {
    const paid = paidMap.get(l.loanNumber) || 0
    tableRow([
      l.loanNumber, l.customer.fullName,
      `₹${(l.loanAmount / 100).toLocaleString('en-IN')}`,
      `₹${(l.totalRepayable / 100).toLocaleString('en-IN')}`,
      `₹${(l.installmentAmount / 100).toLocaleString('en-IN')}`,
      l.startDate.split('-').reverse().join('/'),
      l.expectedEndDate.split('-').reverse().join('/'),
      l.status,
    ], lw)
  })

  // 3. Payments (last 500)
  sectionHeader(`Payments (${payments.length})`)
  const pw = [60, 90, 55, 55, 55, 70, 40]
  tableRow(['Receipt', 'Customer', 'Loan #', 'Amount', 'Date', 'Collector', 'Mode'], pw, true)
  payments.forEach(p => tableRow([
    p.receiptNumber, p.loan.customer.fullName, p.loan.loanNumber,
    `₹${(p.amount / 100).toLocaleString('en-IN')}`,
    p.paymentDate.split('-').reverse().join('/'),
    p.collector.fullName, p.note || '-',
  ], pw))

  // 4. Locations
  sectionHeader(`Locations (${villages.length})`)
  const vw = [200, 100]
  tableRow(['Location', 'Customers'], vw, true)
  villages.forEach(v => tableRow([v.name, String(v._count.customers)], vw))

  // 5. Employees
  sectionHeader(`Employees (${employees.length})`)
  const ew = [120, 80, 80, 80]
  tableRow(['Name', 'Username', 'Phone', 'Role'], ew, true)
  employees.forEach(e => tableRow([e.user.fullName, e.user.username, e.user.phone || '-', e.user.role], ew))

  doc.end()

  return new Promise<NextResponse>((resolve) => {
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      resolve(new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${business.name.replace(/[^a-zA-Z0-9 ]/g, '')}_Data.pdf"`,
        },
      }))
    })
  })
}
