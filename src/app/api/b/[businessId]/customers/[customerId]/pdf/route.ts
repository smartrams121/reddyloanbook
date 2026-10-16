import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { resolveLoanStatus, deriveCustomerStatus, getGracePeriod } from '@/lib/loan-status'
import PDFDocument from 'pdfkit'
import { readFile } from 'fs/promises'
import path from 'path'
import { setupFonts, drawMixedText, drawInfoRow, fmtPaise, fmtDate } from '@/lib/pdf-helpers'

interface Props { params: Promise<{ businessId: string; customerId: string }> }

export async function GET(request: Request, { params }: Props) {
  const { businessId, customerId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { await assertBusinessAccess(user, businessId); assertPermission(user, 'view_customer', businessId) } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true, gracePeriodDaily: true, gracePeriodWeekly: true, gracePeriodMonthly: true, defaulterPeriodDays: true } })
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    include: {
      village: { select: { name: true } },
      loans: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, loanNumber: true, loanAmount: true, amountGiven: true, interestAmount: true, totalRepayable: true,
          installmentAmount: true, numberOfInstallments: true, collectionType: true, interestModel: true,
          statusOverride: true, statusOverrideDate: true, startDate: true, expectedEndDate: true, status: true, notes: true,
          agent: { select: { fullName: true } },
        },
      },
    },
  })
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const loanIds = customer.loans.map(l => l.id)
  const paidSums = loanIds.length > 0
    ? await prisma.payment.groupBy({ by: ['loanId'], where: { loanId: { in: loanIds }, isDeleted: false }, _sum: { amount: true } })
    : []
  const paidMap = new Map(paidSums.map(p => [p.loanId, p._sum.amount || 0]))

  const payments = loanIds.length > 0
    ? await prisma.payment.findMany({
        where: { loanId: { in: loanIds }, isDeleted: false, amount: { gt: 0 } },
        select: { loanId: true, receiptNumber: true, paymentDate: true, amount: true, note: true, collector: { select: { fullName: true } } },
        orderBy: { paymentDate: 'asc' },
      })
    : []

  const loansWithTotals = customer.loans.map(l => {
    const totalPaid = paidMap.get(l.id) || 0
    const derived = resolveLoanStatus(l, totalPaid, getGracePeriod(business!, l.collectionType), l.collectionType, business!.defaulterPeriodDays)
    return { ...l, totalPaid, outstanding: l.totalRepayable - totalPaid, derivedStatus: derived }
  })

  const loanStatuses = loansWithTotals.map(l => l.derivedStatus)
  const customerStatus = deriveCustomerStatus(loanStatuses)
  const totalLent = customer.loans.reduce((s, l) => s + l.amountGiven, 0)
  const totalRepayable = customer.loans.reduce((s, l) => s + l.totalRepayable, 0)
  const totalPaid = loansWithTotals.reduce((s, l) => s + l.totalPaid, 0)
  const totalOutstanding = loansWithTotals.reduce((s, l) => s + l.outstanding, 0)

  // Generate PDF
  const margin = 40
  const doc = new PDFDocument({ size: 'A4', margin, bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => { doc.on('end', () => resolve(Buffer.concat(chunks))) })

  const fonts = setupFonts(doc)
  const usableWidth = 515

  // Header
  doc.fontSize(14).font(fonts.bold).fillColor('#333333')
  drawMixedText(doc, fonts, `${business?.name || 'Customer Report'}`, margin, margin)
  doc.moveDown(0.5)
  doc.fontSize(9).font(fonts.regular).fillColor('#666666').text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, margin, doc.y)
  doc.moveDown(1)

  // Customer photo
  if (customer.photoPath) {
    try {
      const uploadBase = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads')
      const relPath = customer.photoPath.replace(/^\/uploads\//, '')
      const imgBuf = await readFile(path.join(uploadBase, relPath))
      doc.image(imgBuf, margin, doc.y, { width: 80, height: 100 })
      doc.y += 108
    } catch {}
  }

  // Customer Info section
  doc.fontSize(11).font(fonts.bold).fillColor('#FD5108').text('CUSTOMER INFORMATION', margin, doc.y)
  doc.moveDown(0.3)
  doc.moveTo(margin, doc.y).lineTo(margin + usableWidth, doc.y).strokeColor('#FD5108').lineWidth(1).stroke()
  doc.moveDown(0.5)

  let y = doc.y
  const infoFields: [string, string][] = [
    ['Customer ID', customer.customerId],
    ['Name', customer.fullName],
    ['Phone', customer.phone || '-'],
    ['Alt Phone', customer.altPhone || '-'],
    ['Location', customer.village.name],
    ['Address', customer.address || '-'],
    ['Age', customer.age ? String(customer.age) : '-'],
    ['Job Type', customer.jobType || '-'],
    ['Guarantor', customer.guarantorName || '-'],
    ['Guarantor Phone', customer.guarantorPhone || '-'],
    ['Family', customer.familyRelation ? `${customer.familyRelation} — ${customer.familyMemberName || ''}` : '-'],
    ['Status', customerStatus],
  ]

  for (const [label, value] of infoFields) {
    drawInfoRow(doc, fonts, label, value, y, margin, usableWidth)
    y += 16
  }
  doc.y = y

  // Financial Summary
  doc.moveDown(0.8)
  doc.fontSize(11).font(fonts.bold).fillColor('#FD5108').text('FINANCIAL SUMMARY', margin, doc.y)
  doc.moveDown(0.3)
  doc.moveTo(margin, doc.y).lineTo(margin + usableWidth, doc.y).strokeColor('#FD5108').lineWidth(1).stroke()
  doc.moveDown(0.5)

  y = doc.y
  const finFields: [string, string][] = [
    ['Total Lent', fmtPaise(totalLent)],
    ['Total Repayable', fmtPaise(totalRepayable)],
    ['Total Paid', fmtPaise(totalPaid)],
    ['Outstanding', fmtPaise(totalOutstanding)],
    ['Total Loans', String(customer.loans.length)],
  ]
  for (const [label, value] of finFields) {
    doc.font(fonts.regular).fontSize(9).fillColor('#666666').text(label, margin, y)
    doc.font(fonts.bold).fillColor('#333333').text(value, margin + usableWidth * 0.4, y)
    y += 16
  }
  doc.y = y

  // Loans + Payment History
  for (const loan of loansWithTotals) {
    if (doc.y > 650) doc.addPage()

    doc.moveDown(0.8)
    doc.fontSize(11).font(fonts.bold).fillColor('#FD5108').text(`LOAN #${loan.loanNumber} — ${loan.derivedStatus}`, margin, doc.y)
    doc.moveDown(0.3)
    doc.moveTo(margin, doc.y).lineTo(margin + usableWidth, doc.y).strokeColor('#FD5108').lineWidth(1).stroke()
    doc.moveDown(0.5)

    y = doc.y
    const loanFields: [string, string][] = [
      ['Collection Type', loan.collectionType],
      ['Interest Model', loan.interestModel === 'UPFRONT' ? 'Upfront' : 'Add-on'],
      ['Principal', fmtPaise(loan.loanAmount)],
      ['Interest', fmtPaise(loan.interestAmount)],
      ['Total Repayable', fmtPaise(loan.totalRepayable)],
      ['Installment', `${fmtPaise(loan.installmentAmount)} x ${loan.numberOfInstallments}`],
      ['Total Paid', fmtPaise(loan.totalPaid)],
      ['Outstanding', fmtPaise(loan.outstanding)],
      ['Start Date', fmtDate(loan.startDate)],
      ['Due Date', fmtDate(loan.expectedEndDate)],
      ['Agent', loan.agent?.fullName || '-'],
    ]
    for (const [label, value] of loanFields) {
      doc.font(fonts.regular).fontSize(8).fillColor('#666666').text(label, margin, y)
      doc.font(fonts.regular).fillColor('#333333').text(value, margin + usableWidth * 0.35, y)
      y += 14
    }
    doc.y = y

    // Payment history table for this loan
    const loanPayments = payments.filter(p => p.loanId === loan.id)
    if (loanPayments.length > 0) {
      doc.moveDown(0.5)
      if (doc.y > 680) doc.addPage()

      doc.fontSize(9).font(fonts.bold).fillColor('#333333').text('Payment History', margin, doc.y)
      doc.moveDown(0.3)

      const cols = [30, 80, 80, 100, 100, 125]
      const headers = ['#', 'Date', 'Receipt', 'Amount', 'Collector', 'Mode']
      const headerY = doc.y
      doc.rect(margin, headerY, usableWidth, 18).fill('#FD5108')
      doc.font(fonts.bold).fontSize(7).fillColor('#FFFFFF')
      let cx = margin
      headers.forEach((h, i) => { doc.text(h, cx + 4, headerY + 5, { width: cols[i] - 8 }); cx += cols[i] })

      y = headerY + 18
      let runningBalance = loan.totalRepayable
      loanPayments.forEach((p, idx) => {
        if (y > 760) { doc.addPage(); y = margin }
        if (idx % 2 === 1) { doc.rect(margin, y, usableWidth, 16).fill('#FFF5F0'); doc.fillColor('#333333') }
        cx = margin
        doc.rect(margin, y, usableWidth, 16).stroke('#E5E7EB')
        doc.font(fonts.regular).fontSize(7).fillColor('#333333')
        runningBalance -= p.amount
        const row = [String(idx + 1), fmtDate(p.paymentDate), p.receiptNumber, fmtPaise(p.amount), p.collector?.fullName || '-', p.note || 'Cash']
        row.forEach((v, i) => { doc.text(v, cx + 4, y + 4, { width: cols[i] - 8 }); cx += cols[i] })
        y += 16
      })
      doc.y = y
    }
  }

  // Footer
  doc.moveDown(1)
  doc.fontSize(7).font(fonts.regular).fillColor('#999999').text('Internal Use Only', margin, doc.y, { align: 'center', width: usableWidth })

  doc.end()
  const buffer = await done

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${customer.customerId}-${customer.fullName}.pdf"`,
    },
  })
}
