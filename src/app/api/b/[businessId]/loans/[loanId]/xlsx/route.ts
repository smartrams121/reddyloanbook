import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { resolveLoanStatus, getGracePeriod } from '@/lib/loan-status'
import ExcelJS from 'exceljs'

interface Props { params: Promise<{ businessId: string; loanId: string }> }

function fmtDate(iso: string): string { if (!iso) return '-'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }
function fmtRs(paise: number): number { return paise / 100 }

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
  const wb = new ExcelJS.Workbook()
  wb.creator = business?.name || 'Daily Finance'

  const ws = wb.addWorksheet(`Loan ${loan.loanNumber}`)

  // Styling
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFD5108' } }
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  const boldFont: Partial<ExcelJS.Font> = { bold: true, size: 10 }
  const labelFont: Partial<ExcelJS.Font> = { color: { argb: 'FF666666' }, size: 10 }

  // Title
  ws.mergeCells('A1:F1')
  const titleCell = ws.getCell('A1')
  titleCell.value = `${business?.name} — Loan Report`
  titleCell.font = { bold: true, size: 14 }

  ws.mergeCells('A2:F2')
  ws.getCell('A2').value = `Generated: ${new Date().toLocaleDateString('en-IN')}`
  ws.getCell('A2').font = { size: 9, color: { argb: 'FF999999' } }

  // Customer Info
  let row = 4
  ws.mergeCells(`A${row}:F${row}`)
  ws.getCell(`A${row}`).value = 'CUSTOMER INFORMATION'
  ws.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: 'FFFD5108' } }
  row++

  const custFields: [string, string][] = [
    ['Customer ID', c.customerId], ['Name', c.fullName], ['Phone', c.phone || '-'],
    ['Location', c.village.name], ['Address', c.address || '-'],
  ]
  for (const [label, value] of custFields) {
    ws.getCell(`A${row}`).value = label; ws.getCell(`A${row}`).font = labelFont
    ws.getCell(`C${row}`).value = value; ws.getCell(`C${row}`).font = boldFont
    row++
  }

  // Loan Details
  row++
  ws.mergeCells(`A${row}:F${row}`)
  ws.getCell(`A${row}`).value = `LOAN #${loan.loanNumber} — ${derivedStatus}`
  ws.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: 'FFFD5108' } }
  row++

  const loanFields: [string, string | number][] = [
    ['Collection Type', loan.collectionType],
    ['Interest Model', (loan as Record<string, unknown>).interestModel === 'UPFRONT' ? 'Upfront' : 'Add-on'],
    ['Principal (₹)', fmtRs(loan.loanAmount)],
    ['Interest (₹)', fmtRs(loan.interestAmount)],
    ['Total Repayable (₹)', fmtRs(loan.totalRepayable)],
    ['Installment (₹)', `${fmtRs(loan.installmentAmount)} x ${loan.numberOfInstallments}`],
    ['Total Paid (₹)', fmtRs(totalPaid)],
    ['Outstanding (₹)', fmtRs(outstanding)],
    ['Start Date', fmtDate(loan.startDate)],
    ['Due Date', fmtDate(loan.expectedEndDate)],
    ['Agent', loan.agent?.fullName || '-'],
  ]
  for (const [label, value] of loanFields) {
    ws.getCell(`A${row}`).value = label; ws.getCell(`A${row}`).font = labelFont
    ws.getCell(`C${row}`).value = value; ws.getCell(`C${row}`).font = boldFont
    row++
  }

  // Payment History
  if (payments.length > 0) {
    row++
    ws.mergeCells(`A${row}:F${row}`)
    ws.getCell(`A${row}`).value = `PAYMENT HISTORY (${payments.length})`
    ws.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: 'FFFD5108' } }
    row++

    const headerRow = ws.getRow(row)
    const hdrs = ['#', 'Date', 'Receipt', 'Amount (₹)', 'Collector', 'Mode']
    hdrs.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value = h; cell.font = headerFont; cell.fill = headerFill
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFFD5108' } } }
    })
    row++

    let runningTotal = 0
    payments.forEach((p, idx) => {
      const r = ws.getRow(row)
      runningTotal += p.amount
      const vals = [idx + 1, fmtDate(p.paymentDate), p.receiptNumber, fmtRs(p.amount), p.collector?.fullName || '-', p.note || 'Cash']
      vals.forEach((v, i) => {
        const cell = r.getCell(i + 1)
        cell.value = v
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
      })
      if (idx % 2 === 1) {
        r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5F0' } } })
      }
      row++
    })

    // Total row
    const totalRow = ws.getRow(row)
    totalRow.getCell(1).value = 'Total'; totalRow.getCell(1).font = boldFont
    totalRow.getCell(4).value = fmtRs(totalPaid); totalRow.getCell(4).font = boldFont
    totalRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } } })
    row++
  }

  // Footer
  row++
  ws.mergeCells(`A${row}:F${row}`)
  ws.getCell(`A${row}`).value = 'Internal Use Only'
  ws.getCell(`A${row}`).font = { size: 8, color: { argb: 'FF999999' } }

  // Column widths
  ws.getColumn(1).width = 18
  ws.getColumn(2).width = 15
  ws.getColumn(3).width = 20
  ws.getColumn(4).width = 15
  ws.getColumn(5).width = 18
  ws.getColumn(6).width = 12

  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent('Loan-' + loan.loanNumber + '-' + c.fullName)}.xlsx"`,
    },
  })
}
