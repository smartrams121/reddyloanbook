import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { assertBusinessAccess } from '@/lib/scope'
import ExcelJS from 'exceljs'

interface RouteParams {
  params: Promise<{ businessId: string }>
}

const HEADER_COLOR = 'FD5108'
const ALT_ROW_COLOR = 'FFF5F0'

function formatPaiseToRupees(paise: number): string {
  return (paise / 100).toFixed(2)
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  if (iso.includes('-') && iso.length === 10) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  return iso
}

function styleSheet(ws: ExcelJS.Worksheet, columns: { key: string; label: string }[], rows: Record<string, unknown>[]) {
  const headerRow = ws.addRow(columns.map(c => c.label))
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } }
    cell.alignment = { horizontal: 'center' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'CCCCCC' } } }
  })

  rows.forEach((row, idx) => {
    const dataRow = ws.addRow(columns.map(c => row[c.key] ?? ''))
    if (idx % 2 === 1) {
      dataRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW_COLOR } }
      })
    }
  })

  columns.forEach((col, i) => {
    const wsCol = ws.getColumn(i + 1)
    let maxLen = col.label.length
    rows.forEach(row => {
      const val = String(row[col.key] ?? '')
      if (val.length > maxLen) maxLen = val.length
    })
    wsCol.width = Math.min(maxLen + 4, 40)
  })

  const footerRowIdx = rows.length + 3
  ws.mergeCells(footerRowIdx, 1, footerRowIdx, columns.length)
  const footerCell = ws.getCell(footerRowIdx, 1)
  footerCell.value = 'Internal Use Only | PwC'
  footerCell.font = { size: 8, italic: true, color: { argb: '999999' } }
  footerCell.alignment = { horizontal: 'center' }
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await assertBusinessAccess(user, businessId)
  assertPermission(user, 'edit_business_settings')

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const [villages, customers, loans, payments, userAssignments] = await Promise.all([
    prisma.village.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, isActive: true, createdAt: true },
    }),
    prisma.customer.findMany({
      where: { businessId },
      orderBy: { fullName: 'asc' },
      include: { village: { select: { name: true } } },
    }),
    prisma.loan.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { fullName: true, customerId: true } },
        agent: { select: { fullName: true } },
      },
    }),
    prisma.payment.findMany({
      where: { businessId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: {
        loan: {
          select: {
            loanNumber: true,
            customer: { select: { fullName: true, customerId: true } },
          },
        },
        collector: { select: { fullName: true } },
      },
    }),
    prisma.userBusinessAssignment.findMany({
      where: { businessId },
      include: {
        user: {
          select: {
            fullName: true,
            phone: true,
            role: true,
            isActive: true,
            username: true,
            villageAssignments: {
              include: { village: { select: { name: true, businessId: true } } },
            },
          },
        },
      },
    }),
  ])

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Daily Finance'
  wb.created = new Date()

  // Villages sheet
  const villageCols = [
    { key: 'name', label: 'Village Name' },
    { key: 'isActive', label: 'Status' },
    { key: 'customerCount', label: 'Customers' },
    { key: 'createdAt', label: 'Created' },
  ]
  const villageCustomerCounts = new Map<string, number>()
  customers.forEach(c => {
    villageCustomerCounts.set(c.villageId, (villageCustomerCounts.get(c.villageId) || 0) + 1)
  })
  const villageRows = villages.map(v => ({
    name: v.name,
    isActive: v.isActive ? 'Active' : 'Inactive',
    customerCount: villageCustomerCounts.get(v.id) || 0,
    createdAt: v.createdAt.toLocaleDateString('en-IN'),
  }))
  const villageWs = wb.addWorksheet('Villages')
  styleSheet(villageWs, villageCols, villageRows)

  // Customers sheet
  const customerCols = [
    { key: 'customerId', label: 'Customer ID' },
    { key: 'fullName', label: 'Full Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'village', label: 'Village' },
    { key: 'status', label: 'Status' },
    { key: 'guarantorName', label: 'Guarantor' },
    { key: 'guarantorPhone', label: 'Guarantor Phone' },
    { key: 'address', label: 'Address' },
    { key: 'createdAt', label: 'Created' },
  ]
  const customerRows = customers.map(c => ({
    customerId: c.customerId,
    fullName: c.fullName,
    phone: c.phone,
    village: c.village.name,
    status: c.status,
    guarantorName: c.guarantorName || '',
    guarantorPhone: c.guarantorPhone || '',
    address: c.address || '',
    createdAt: c.createdAt.toLocaleDateString('en-IN'),
  }))
  const customerWs = wb.addWorksheet('Customers')
  styleSheet(customerWs, customerCols, customerRows)

  // Loans sheet
  const loanCols = [
    { key: 'loanNumber', label: 'Loan Number' },
    { key: 'customerId', label: 'Customer ID' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'loanAmount', label: 'Loan Amount (₹)' },
    { key: 'interestAmount', label: 'Interest (₹)' },
    { key: 'totalRepayable', label: 'Total Repayable (₹)' },
    { key: 'amountGiven', label: 'Amount Given (₹)' },
    { key: 'installmentAmount', label: 'Installment (₹)' },
    { key: 'numberOfInstallments', label: 'No. Installments' },
    { key: 'collectionType', label: 'Collection Type' },
    { key: 'status', label: 'Status' },
    { key: 'agent', label: 'Assigned Agent' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'expectedEndDate', label: 'Expected End' },
    { key: 'closedAt', label: 'Closed Date' },
  ]
  const loanRows = loans.map(l => ({
    loanNumber: l.loanNumber,
    customerId: l.customer.customerId,
    customerName: l.customer.fullName,
    loanAmount: formatPaiseToRupees(l.loanAmount),
    interestAmount: formatPaiseToRupees(l.interestAmount),
    totalRepayable: formatPaiseToRupees(l.totalRepayable),
    amountGiven: formatPaiseToRupees(l.amountGiven),
    installmentAmount: formatPaiseToRupees(l.installmentAmount),
    numberOfInstallments: l.numberOfInstallments,
    collectionType: l.collectionType,
    status: l.status,
    agent: l.agent?.fullName || '',
    startDate: formatDate(l.startDate),
    expectedEndDate: formatDate(l.expectedEndDate),
    closedAt: formatDate(l.closedAt),
  }))
  const loanWs = wb.addWorksheet('Loans')
  styleSheet(loanWs, loanCols, loanRows)

  // Payments sheet
  const paymentCols = [
    { key: 'receiptNumber', label: 'Receipt No.' },
    { key: 'customerId', label: 'Customer ID' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'loanNumber', label: 'Loan Number' },
    { key: 'amount', label: 'Amount (₹)' },
    { key: 'paymentDate', label: 'Payment Date' },
    { key: 'collectedBy', label: 'Collected By' },
    { key: 'createdAt', label: 'Created' },
  ]
  const paymentRows = payments.map(p => ({
    receiptNumber: p.receiptNumber,
    customerId: p.loan.customer.customerId,
    customerName: p.loan.customer.fullName,
    loanNumber: p.loan.loanNumber,
    amount: formatPaiseToRupees(p.amount),
    paymentDate: formatDate(p.paymentDate),
    collectedBy: p.collector.fullName,
    createdAt: p.createdAt.toLocaleDateString('en-IN'),
  }))
  const paymentWs = wb.addWorksheet('Payments')
  styleSheet(paymentWs, paymentCols, paymentRows)

  // Users sheet
  const userCols = [
    { key: 'fullName', label: 'Full Name' },
    { key: 'username', label: 'Username' },
    { key: 'phone', label: 'Phone' },
    { key: 'role', label: 'Role' },
    { key: 'isActive', label: 'Status' },
    { key: 'villages', label: 'Assigned Villages' },
  ]
  const userRows = userAssignments.map(ua => ({
    fullName: ua.user.fullName,
    username: ua.user.username,
    phone: ua.user.phone || '',
    role: ua.user.role.replace(/_/g, ' '),
    isActive: ua.user.isActive ? 'Active' : 'Inactive',
    villages: ua.user.villageAssignments
      .filter(va => va.village.businessId === businessId)
      .map(va => va.village.name)
      .join(', '),
  }))
  const userWs = wb.addWorksheet('Users')
  styleSheet(userWs, userCols, userRows)

  const buffer = await wb.xlsx.writeBuffer()

  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  const safeName = business.name.replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `${safeName}_Data_Export_${dd}${mm}${yyyy}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
