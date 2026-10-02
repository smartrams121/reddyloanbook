import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import PDFDocument from 'pdfkit'

interface Props {
  params: Promise<{ businessId: string; loanId: string }>
}

function fmtPaise(paise: number): string {
  const r = paise / 100
  if (r === Math.floor(r)) return `Rs.${Math.floor(r).toLocaleString('en-IN')}`
  return `Rs.${r.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export async function GET(request: Request, { params }: Props) {
  const { businessId, loanId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, businessId },
    include: {
      customer: { select: { fullName: true, customerId: true, phone: true } },
      agent: { select: { fullName: true } },
      schedule: { orderBy: { installmentNumber: 'asc' } },
    },
  })
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } })

  const paidResult = await prisma.payment.aggregate({
    where: { loanId, isDeleted: false },
    _sum: { amount: true },
  })
  const totalPaid = paidResult._sum.amount || 0
  const outstanding = loan.totalRepayable - totalPaid

  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  // Header
  doc.fontSize(16).font('Helvetica-Bold').text(business?.name || 'Loan Details', { align: 'center' })
  doc.moveDown(0.3)
  doc.fontSize(10).font('Helvetica').text(`Loan: ${loan.loanNumber}`, { align: 'center' })
  doc.moveDown(1)

  // Customer info
  doc.fontSize(11).font('Helvetica-Bold').text('Customer Information')
  doc.moveDown(0.3)
  doc.fontSize(9).font('Helvetica')
  const custRows = [
    ['Customer', `${loan.customer.fullName} (${loan.customer.customerId})`],
    ['Phone', loan.customer.phone],
  ]
  for (const [label, value] of custRows) {
    doc.text(`${label}: ${value}`)
  }

  doc.moveDown(0.8)

  // Loan details
  doc.fontSize(11).font('Helvetica-Bold').text('Loan Details')
  doc.moveDown(0.3)
  doc.fontSize(9).font('Helvetica')
  const interestModelLabel = (loan as Record<string, unknown>).interestModel === 'UPFRONT' ? 'Upfront' : 'Add-on'
  const rows = [
    ['Interest Model', interestModelLabel],
    ['Collection Type', loan.collectionType],
    ['Principal Amount', fmtPaise(loan.loanAmount)],
    ['Interest Amount', fmtPaise(loan.interestAmount)],
    ['Total Repayable', fmtPaise(loan.totalRepayable)],
    ['Amount Given', fmtPaise(loan.amountGiven)],
    ['Installment Amount', fmtPaise(loan.installmentAmount)],
    ['Number of Installments', String(loan.numberOfInstallments)],
    ['Last Installment', fmtPaise(loan.lastInstallmentAmount)],
    ['Start Date', fmtDate(loan.startDate)],
    ['Expected End Date', fmtDate(loan.expectedEndDate)],
    ['Total Paid', fmtPaise(totalPaid)],
    ['Outstanding', fmtPaise(outstanding)],
  ]
  if (loan.agent) rows.push(['Agent', loan.agent.fullName])

  for (const [label, value] of rows) {
    doc.text(`${label}: ${value}`)
  }

  doc.moveDown(0.8)

  // Schedule table
  if (loan.schedule.length > 0) {
    doc.fontSize(11).font('Helvetica-Bold').text(`Repayment Schedule (${loan.schedule.length} installments)`)
    doc.moveDown(0.4)

    const tableTop = doc.y
    const col1 = 40, col2 = 80, col3 = 220, col4 = 380
    doc.fontSize(8).font('Helvetica-Bold')
    doc.text('#', col1, tableTop)
    doc.text('Due Date', col2, tableTop)
    doc.text('Amount', col3, tableTop)
    doc.text('Status', col4, tableTop)
    doc.moveDown(0.3)
    doc.moveTo(40, doc.y).lineTo(500, doc.y).stroke()
    doc.moveDown(0.2)

    doc.font('Helvetica').fontSize(8)
    for (const entry of loan.schedule) {
      if (doc.y > 750) {
        doc.addPage()
      }
      const y = doc.y
      doc.text(String(entry.installmentNumber), col1, y)
      doc.text(fmtDate(entry.dueDate), col2, y)
      doc.text(fmtPaise(entry.amount), col3, y)
      doc.text(entry.status || 'PENDING', col4, y)
      doc.moveDown(0.3)
    }
  }

  doc.end()
  const buffer = await done

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${loan.loanNumber}-details.pdf"`,
    },
  })
}
