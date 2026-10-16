import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { resolveLoanStatus, getGracePeriod } from '@/lib/loan-status'
import PDFDocument from 'pdfkit'
import { setupFonts, drawMixedText, drawInfoRow, fmtPaise, fmtDate } from '@/lib/pdf-helpers'

interface Props { params: Promise<{ businessId: string; loanId: string }> }

export async function GET(_request: Request, { params }: Props) {
  const { businessId, loanId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { await assertBusinessAccess(user, businessId) } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true, gracePeriodDaily: true, gracePeriodWeekly: true, gracePeriodMonthly: true, defaulterPeriodDays: true } })
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, businessId },
    include: {
      customer: { include: { village: { select: { name: true } } } },
      agent: { select: { fullName: true } },
    },
  })
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

  const paidAgg = await prisma.payment.aggregate({ where: { loanId, isDeleted: false }, _sum: { amount: true } })
  const totalPaid = paidAgg._sum.amount || 0
  const outstanding = loan.totalRepayable - totalPaid
  const derivedStatus = resolveLoanStatus(loan, totalPaid, getGracePeriod(business!, loan.collectionType), loan.collectionType, business!.defaulterPeriodDays)

  const payments = await prisma.payment.findMany({
    where: { loanId, isDeleted: false, amount: { gt: 0 } },
    select: { receiptNumber: true, paymentDate: true, amount: true, note: true, collector: { select: { fullName: true } } },
    orderBy: { paymentDate: 'asc' },
  })

  const c = loan.customer
  const margin = 40
  const doc = new PDFDocument({ size: 'A4', margin, bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', (ch: Buffer) => chunks.push(ch))
  const done = new Promise<Buffer>((resolve) => { doc.on('end', () => resolve(Buffer.concat(chunks))) })

  const fonts = setupFonts(doc)
  const usableWidth = 515

  doc.fontSize(14).font(fonts.bold).fillColor('#333333')
  drawMixedText(doc, fonts, `${business?.name || 'Loan Report'}`, margin, margin)
  doc.moveDown(0.5)
  doc.fontSize(9).font(fonts.regular).fillColor('#666666').text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, margin, doc.y)
  doc.moveDown(1)

  // Customer Info
  doc.fontSize(11).font(fonts.bold).fillColor('#FD5108').text('CUSTOMER INFORMATION', margin, doc.y)
  doc.moveDown(0.3)
  doc.moveTo(margin, doc.y).lineTo(margin + usableWidth, doc.y).strokeColor('#FD5108').lineWidth(1).stroke()
  doc.moveDown(0.5)

  let y = doc.y
  for (const [label, value] of [['Customer ID', c.customerId], ['Name', c.fullName], ['Phone', c.phone || '-'], ['Location', c.village.name], ['Address', c.address || '-']] as [string, string][]) {
    drawInfoRow(doc, fonts, label, value, y, margin, usableWidth)
    y += 16
  }
  doc.y = y

  // Loan Details
  doc.moveDown(0.8)
  doc.fontSize(11).font(fonts.bold).fillColor('#FD5108').text(`LOAN #${loan.loanNumber} — ${derivedStatus}`, margin, doc.y)
  doc.moveDown(0.3)
  doc.moveTo(margin, doc.y).lineTo(margin + usableWidth, doc.y).strokeColor('#FD5108').lineWidth(1).stroke()
  doc.moveDown(0.5)

  y = doc.y
  for (const [label, value] of [
    ['Collection Type', loan.collectionType],
    ['Interest Model', (loan as Record<string, unknown>).interestModel === 'UPFRONT' ? 'Upfront' : 'Add-on'],
    ['Principal', fmtPaise(loan.loanAmount)], ['Interest', fmtPaise(loan.interestAmount)],
    ['Total Repayable', fmtPaise(loan.totalRepayable)],
    ['Installment', `${fmtPaise(loan.installmentAmount)} x ${loan.numberOfInstallments}`],
    ['Total Paid', fmtPaise(totalPaid)], ['Outstanding', fmtPaise(outstanding)],
    ['Start Date', fmtDate(loan.startDate)], ['Due Date', fmtDate(loan.expectedEndDate)],
    ['Agent', loan.agent?.fullName || '-'],
  ] as [string, string][]) {
    doc.font(fonts.regular).fontSize(9).fillColor('#666666').text(label, margin, y)
    doc.font(fonts.regular).fillColor('#333333').text(value, margin + usableWidth * 0.35, y)
    y += 16
  }
  doc.y = y

  // Payment History
  if (payments.length > 0) {
    doc.moveDown(0.8)
    doc.fontSize(11).font(fonts.bold).fillColor('#FD5108').text(`PAYMENT HISTORY (${payments.length})`, margin, doc.y)
    doc.moveDown(0.3)
    doc.moveTo(margin, doc.y).lineTo(margin + usableWidth, doc.y).strokeColor('#FD5108').lineWidth(1).stroke()
    doc.moveDown(0.5)

    const cols = [30, 90, 100, 100, 100, 95]
    const headers = ['#', 'Date', 'Receipt', 'Amount', 'Collector', 'Mode']
    const hy = doc.y
    doc.rect(margin, hy, usableWidth, 18).fill('#FD5108')
    doc.font(fonts.bold).fontSize(7).fillColor('#FFFFFF')
    let cx = margin
    headers.forEach((h, i) => { doc.text(h, cx + 4, hy + 5, { width: cols[i] - 8 }); cx += cols[i] })

    y = hy + 18
    payments.forEach((p, idx) => {
      if (y > 760) { doc.addPage(); y = margin }
      if (idx % 2 === 1) { doc.rect(margin, y, usableWidth, 16).fill('#FFF5F0'); doc.fillColor('#333333') }
      doc.rect(margin, y, usableWidth, 16).stroke('#E5E7EB')
      cx = margin
      doc.font(fonts.regular).fontSize(7).fillColor('#333333')
      const row = [String(idx + 1), fmtDate(p.paymentDate), p.receiptNumber, fmtPaise(p.amount), p.collector?.fullName || '-', p.note || 'Cash']
      row.forEach((v, i) => { doc.text(v, cx + 4, y + 4, { width: cols[i] - 8 }); cx += cols[i] })
      y += 16
    })

    doc.rect(margin, y, usableWidth, 18).fill('#F3F4F6')
    doc.font(fonts.bold).fontSize(8).fillColor('#333333')
    doc.text('Total', margin + 4, y + 4)
    doc.text(fmtPaise(totalPaid), margin + cols[0] + cols[1] + cols[2] + 4, y + 4)
    doc.y = y + 18
  }

  doc.moveDown(1)
  doc.fontSize(7).font(fonts.regular).fillColor('#999999').text('Internal Use Only', margin, doc.y, { align: 'center', width: usableWidth })

  doc.end()
  const buffer = await done

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Loan-${loan.loanNumber}-${c.fullName}.pdf"`,
    },
  })
}
