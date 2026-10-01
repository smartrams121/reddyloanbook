import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { formatDateDisplay, formatDateTimeFull, nowIST } from '@/lib/date'
import ExcelJS from 'exceljs'

interface Props {
  params: Promise<{ businessId: string; customerId: string }>
}

import { deriveLoanStatus } from '@/lib/loan-status'

function fmtPaise(paise: number): string {
  const r = paise / 100
  return r === Math.floor(r)
    ? `₹${Math.floor(r).toLocaleString('en-IN')}`
    : `₹${r.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDD(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export async function GET(request: Request, { params }: Props) {
  const { businessId, customerId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'view_all_reports')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'xlsx'
  const loanIdsParam = searchParams.get('loanIds')
  const all = searchParams.get('all') === 'true'

  const [business, customer] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true, receiptPrefix: true } }),
    prisma.customer.findFirst({
      where: { id: customerId, businessId },
      include: {
        village: { select: { name: true } },
        loans: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, loanNumber: true, loanAmount: true, amountGiven: true,
            totalRepayable: true, installmentAmount: true, collectionType: true,
            startDate: true, expectedEndDate: true, closedAt: true,
            status: true, numberOfInstallments: true,
          },
        },
      },
    }),
  ])

  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  const businessName = business?.name || 'Business'

  let loans = customer.loans
  if (!all && loanIdsParam) {
    const ids = loanIdsParam.split(',').filter(Boolean)
    loans = loans.filter((l) => ids.includes(l.id))
  }

  if (loans.length === 0) {
    return NextResponse.json({ error: 'No loans selected' }, { status: 400 })
  }

  const loanIds = loans.map((l) => l.id)
  const payments = await prisma.payment.findMany({
    where: { loanId: { in: loanIds }, isDeleted: false },
    include: { collector: { select: { fullName: true } } },
    orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
  })

  const paymentsByLoan = new Map<string, typeof payments>()
  for (const p of payments) {
    const arr = paymentsByLoan.get(p.loanId) || []
    arr.push(p)
    paymentsByLoan.set(p.loanId, arr)
  }

  const paidSums = await prisma.payment.groupBy({
    by: ['loanId'],
    where: { loanId: { in: loanIds }, isDeleted: false },
    _sum: { amount: true },
  })
  const paidMap = new Map(paidSums.map((p) => [p.loanId, p._sum.amount || 0]))

  const generatedAt = formatDateTimeFull(nowIST())

  if (format === 'pdf') {
    return generatePDF(businessName, customer, loans, paymentsByLoan, paidMap, user.fullName, generatedAt)
  }
  return generateXLSX(businessName, customer, loans, paymentsByLoan, paidMap, user.fullName, generatedAt)
}

interface CustomerData {
  customerId: string; fullName: string; phone: string; address: string | null
  village: { name: string }
}

interface LoanData {
  id: string; loanNumber: string; loanAmount: number; amountGiven: number
  totalRepayable: number; installmentAmount: number; collectionType: string
  startDate: string; expectedEndDate: string; closedAt: string | null
  status: string; numberOfInstallments: number
}

interface PaymentData {
  amount: number; paymentDate: string; note: string | null
  collector: { fullName: string } | null
}

async function generateXLSX(
  businessName: string,
  customer: CustomerData,
  loans: LoanData[],
  paymentsByLoan: Map<string, PaymentData[]>,
  paidMap: Map<string, number>,
  generatedBy: string,
  generatedAt: string,
) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Daily Finance'
  wb.created = new Date()

  if (loans.length > 1) {
    const summaryWs = wb.addWorksheet('Summary')
    styleSheet(summaryWs)

    summaryWs.mergeCells(1, 1, 1, 6)
    const titleCell = summaryWs.getCell('A1')
    titleCell.value = `${businessName} — Customer Report`
    titleCell.font = { size: 14, bold: true }
    titleCell.alignment = { horizontal: 'center' }

    const infoRows = [
      ['Customer', `${customer.fullName} (${customer.customerId})`],
      ['Phone', customer.phone],
      ['Location', customer.village.name],
      ['Address', customer.address || '-'],
    ]
    infoRows.forEach(([label, val], i) => {
      summaryWs.getCell(3 + i, 1).value = label
      summaryWs.getCell(3 + i, 1).font = { bold: true, size: 10 }
      summaryWs.getCell(3 + i, 2).value = val
    })

    const headerRow = summaryWs.addRow([])
    summaryWs.addRow([])
    const cols = ['Loan #', 'Start Date', 'Total Repayable', 'Total Paid', 'Outstanding', 'Status']
    const hRow = summaryWs.addRow(cols)
    hRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FD5108' } }
      cell.alignment = { horizontal: 'center' }
    })

    loans.forEach((loan, idx) => {
      const paid = paidMap.get(loan.id) || 0
      const derived = deriveLoanStatus(loan.expectedEndDate, loan.totalRepayable, paid)
      const outstanding = derived !== 'COMPLETED' ? loan.totalRepayable - paid : 0
      const r = summaryWs.addRow([
        loan.loanNumber,
        fmtDD(loan.startDate),
        fmtPaise(loan.totalRepayable),
        fmtPaise(paid),
        fmtPaise(outstanding),
        derived,
      ])
      if (idx % 2 === 1) {
        r.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0' } }
        })
      }
    })

    summaryWs.addRow([])
    const totalPaid = loans.reduce((s, l) => s + (paidMap.get(l.id) || 0), 0)
    const totalOut = loans.reduce((s, l) => {
      const paid = paidMap.get(l.id) || 0
      const d = deriveLoanStatus(l.expectedEndDate, l.totalRepayable, paid)
      return s + (d !== 'COMPLETED' ? l.totalRepayable - paid : 0)
    }, 0)
    const totRow = summaryWs.addRow(['TOTAL', '', '', fmtPaise(totalPaid), fmtPaise(totalOut), ''])
    totRow.font = { bold: true }

    addFooter(summaryWs, generatedAt, generatedBy)
    autoWidth(summaryWs, 6)
  }

  for (const loan of loans) {
    const ws = wb.addWorksheet(loan.loanNumber.replace(/[^a-zA-Z0-9]/g, '_'))
    styleSheet(ws)
    addLoanSheet(ws, businessName, customer, loan, paymentsByLoan.get(loan.id) || [], paidMap.get(loan.id) || 0, generatedAt, generatedBy)
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${customer.customerId}_report.xlsx"`,
    },
  })
}

function addLoanSheet(
  ws: ExcelJS.Worksheet,
  businessName: string,
  customer: CustomerData,
  loan: LoanData,
  payments: PaymentData[],
  totalPaid: number,
  generatedAt: string,
  generatedBy: string,
) {
  ws.mergeCells(1, 1, 1, 6)
  const titleCell = ws.getCell('A1')
  titleCell.value = `${businessName} — Loan Statement`
  titleCell.font = { size: 14, bold: true }
  titleCell.alignment = { horizontal: 'center' }

  const info = [
    ['Customer', `${customer.fullName} (${customer.customerId})`],
    ['Phone', customer.phone],
    ['Location', customer.village.name],
    ['Loan #', loan.loanNumber],
    ['Loan Amount', fmtPaise(loan.amountGiven)],
    ['Total Repayable', fmtPaise(loan.totalRepayable)],
    ['Installment', `${fmtPaise(loan.installmentAmount)} (${loan.collectionType})`],
    ['Start Date', fmtDD(loan.startDate)],
    ['Expected End Date', fmtDD(loan.expectedEndDate)],
    ['Status', loan.status.replace(/_/g, ' ')],
    ...(loan.closedAt ? [['Closed On', fmtDD(loan.closedAt)]] : []),
  ]
  info.forEach(([label, val], i) => {
    ws.getCell(3 + i, 1).value = label
    ws.getCell(3 + i, 1).font = { bold: true, size: 10 }
    ws.getCell(3 + i, 2).value = val
  })

  const startRow = 3 + info.length + 2
  const cols = ['#', 'Posting Date', 'Amount Paid (₹)', 'Agent', 'Note', 'Running Balance (₹)']
  const hRow = ws.getRow(startRow)
  cols.forEach((c, i) => {
    const cell = hRow.getCell(i + 1)
    cell.value = c
    cell.font = { bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FD5108' } }
    cell.alignment = { horizontal: 'center' }
  })
  hRow.commit()

  let balance = loan.totalRepayable
  payments.forEach((p, idx) => {
    balance -= p.amount
    const row = ws.getRow(startRow + 1 + idx)
    row.getCell(1).value = idx + 1
    row.getCell(2).value = fmtDD(p.paymentDate)
    row.getCell(3).value = fmtPaise(p.amount)
    row.getCell(4).value = p.collector?.fullName || '-'
    row.getCell(5).value = p.note || ''
    row.getCell(6).value = fmtPaise(balance)
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0' } }
      })
    }
    row.commit()
  })

  const dStatus = deriveLoanStatus(loan.expectedEndDate, loan.totalRepayable, totalPaid)
  const outstanding = dStatus !== 'COMPLETED' ? loan.totalRepayable - totalPaid : 0
  const totRowIdx = startRow + 1 + payments.length + 1
  ws.getCell(totRowIdx, 1).value = ''
  ws.getCell(totRowIdx, 2).value = 'TOTAL'
  ws.getCell(totRowIdx, 2).font = { bold: true }
  ws.getCell(totRowIdx, 3).value = fmtPaise(totalPaid)
  ws.getCell(totRowIdx, 3).font = { bold: true }
  ws.getCell(totRowIdx, 6).value = fmtPaise(outstanding)
  ws.getCell(totRowIdx, 6).font = { bold: true }

  addFooter(ws, generatedAt, generatedBy)
  autoWidth(ws, 6)
}

function styleSheet(ws: ExcelJS.Worksheet) {
  ws.properties.defaultRowHeight = 18
}

function addFooter(ws: ExcelJS.Worksheet, generatedAt: string, generatedBy: string) {
  const lastRow = ws.lastRow?.number || 1
  const footerRow = lastRow + 2
  ws.mergeCells(footerRow, 1, footerRow, 6)
  const cell = ws.getCell(footerRow, 1)
  cell.value = `Generated: ${generatedAt} by ${generatedBy} | Internal Use Only`
  cell.font = { size: 8, italic: true, color: { argb: '999999' } }
  cell.alignment = { horizontal: 'center' }
}

function autoWidth(ws: ExcelJS.Worksheet, colCount: number) {
  for (let i = 1; i <= colCount; i++) {
    const col = ws.getColumn(i)
    let maxLen = 10
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value || '').length
      if (len > maxLen) maxLen = len
    })
    col.width = Math.min(maxLen + 4, 40)
  }
}

function generatePDF(
  businessName: string,
  customer: CustomerData,
  loans: LoanData[],
  paymentsByLoan: Map<string, PaymentData[]>,
  paidMap: Map<string, number>,
  generatedBy: string,
  generatedAt: string,
) {
  const loanSections = loans.map((loan) => {
    const payments = paymentsByLoan.get(loan.id) || []
    const totalPaid = paidMap.get(loan.id) || 0
    const loanDerived = deriveLoanStatus(loan.expectedEndDate, loan.totalRepayable, totalPaid)
    const outstanding = loanDerived !== 'COMPLETED' ? loan.totalRepayable - totalPaid : 0

    let balance = loan.totalRepayable
    const paymentRows = payments.map((p, idx) => {
      balance -= p.amount
      const bg = idx % 2 === 1 ? 'background:#fff5f0;' : ''
      return `<tr style="${bg}">
        <td style="padding:4px 8px;font-size:11px;border-bottom:1px solid #f0f0f0;text-align:center;">${idx + 1}</td>
        <td style="padding:4px 8px;font-size:11px;border-bottom:1px solid #f0f0f0;">${fmtDD(p.paymentDate)}</td>
        <td style="padding:4px 8px;font-size:11px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmtPaise(p.amount)}</td>
        <td style="padding:4px 8px;font-size:11px;border-bottom:1px solid #f0f0f0;">${p.collector?.fullName || '-'}</td>
        <td style="padding:4px 8px;font-size:11px;border-bottom:1px solid #f0f0f0;">${p.note || ''}</td>
        <td style="padding:4px 8px;font-size:11px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmtPaise(balance)}</td>
      </tr>`
    }).join('')

    return `
      <div class="loan-section" style="page-break-before:${loans.indexOf(loan) > 0 ? 'always' : 'auto'};">
        <h2 style="font-size:14px;margin:0 0 8px;color:#333;">${loan.loanNumber} — ${loan.status.replace(/_/g, ' ')}</h2>
        <table style="border-collapse:collapse;width:100%;margin-bottom:8px;font-size:11px;">
          <tr><td style="padding:2px 0;width:140px;color:#666;"><b>Loan Amount:</b></td><td>${fmtPaise(loan.amountGiven)}</td>
              <td style="padding:2px 0;width:140px;color:#666;"><b>Total Repayable:</b></td><td>${fmtPaise(loan.totalRepayable)}</td></tr>
          <tr><td style="padding:2px 0;color:#666;"><b>Installment:</b></td><td>${fmtPaise(loan.installmentAmount)} (${loan.collectionType})</td>
              <td style="padding:2px 0;color:#666;"><b>Start Date:</b></td><td>${fmtDD(loan.startDate)}</td></tr>
          <tr><td style="padding:2px 0;color:#666;"><b>Expected End:</b></td><td>${fmtDD(loan.expectedEndDate)}</td>
              <td style="padding:2px 0;color:#666;"><b>Closed On:</b></td><td>${loan.closedAt ? fmtDD(loan.closedAt) : '-'}</td></tr>
        </table>
        <table style="border-collapse:collapse;width:100%;">
          <thead>
            <tr>
              <th style="padding:6px 8px;text-align:center;font-size:11px;color:#fff;background:#FD5108;border-bottom:2px solid #e5e7eb;">#</th>
              <th style="padding:6px 8px;text-align:left;font-size:11px;color:#fff;background:#FD5108;border-bottom:2px solid #e5e7eb;">Posting Date</th>
              <th style="padding:6px 8px;text-align:right;font-size:11px;color:#fff;background:#FD5108;border-bottom:2px solid #e5e7eb;">Amount Paid</th>
              <th style="padding:6px 8px;text-align:left;font-size:11px;color:#fff;background:#FD5108;border-bottom:2px solid #e5e7eb;">Agent</th>
              <th style="padding:6px 8px;text-align:left;font-size:11px;color:#fff;background:#FD5108;border-bottom:2px solid #e5e7eb;">Note</th>
              <th style="padding:6px 8px;text-align:right;font-size:11px;color:#fff;background:#FD5108;border-bottom:2px solid #e5e7eb;">Running Balance</th>
            </tr>
          </thead>
          <tbody>
            ${paymentRows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#999;">No payments recorded</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="font-weight:bold;border-top:2px solid #333;">
              <td></td><td style="padding:6px 8px;">TOTAL</td>
              <td style="padding:6px 8px;text-align:right;">${fmtPaise(totalPaid)}</td>
              <td colspan="2"></td>
              <td style="padding:6px 8px;text-align:right;">${fmtPaise(outstanding)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 15mm; }
  body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 20px; position: relative; }
  body::before {
    content: 'CONFIDENTIAL';
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 80px; font-weight: bold; color: rgba(0,0,0,0.04);
    pointer-events: none; z-index: 0;
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
  .footer { text-align: center; font-size: 9px; color: #999; margin-top: 24px; font-style: italic; }
  .loan-section { margin-bottom: 24px; position: relative; z-index: 1; }
</style>
</head>
<body>
  <h1>${businessName} — Customer Loan Report</h1>
  <div class="meta">
    Customer: ${customer.fullName} (${customer.customerId}) &nbsp;|&nbsp;
    Phone: ${customer.phone} &nbsp;|&nbsp;
    Location: ${customer.village.name}
    ${customer.address ? ` &nbsp;|&nbsp; Address: ${customer.address}` : ''}
  </div>
  ${loanSections}
  <div class="footer">Generated: ${generatedAt} by ${generatedBy} &nbsp;|&nbsp; ${businessName} &nbsp;|&nbsp; Internal Use Only</div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${customer.customerId}_report.html"`,
    },
  })
}
