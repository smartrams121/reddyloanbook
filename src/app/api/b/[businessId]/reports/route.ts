import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'

interface Props {
  params: Promise<{ businessId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'view_all_reports')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const entity = searchParams.get('entity') || 'customers'
  const startDate = searchParams.get('from')
  const endDate = searchParams.get('to')
  const villageId = searchParams.get('villageId')
  const statuses = searchParams.get('statuses')

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'from and to dates are required' }, { status: 400 })
  }

  switch (entity) {
    case 'customers':
      return getCustomersReport(businessId, startDate, endDate)
    case 'loans':
      return getLoansReport(businessId, startDate, endDate, statuses)
    case 'villages':
      if (villageId) return getVillageCustomersReport(businessId, villageId, startDate, endDate)
      return getVillagesReport(businessId, startDate, endDate)
    case 'employees':
      return getEmployeesReport(businessId, startDate, endDate)
    case 'payments':
      return getPaymentsReport(businessId, startDate, endDate)
    default:
      return NextResponse.json({ error: 'Invalid entity' }, { status: 400 })
  }
}

async function getCustomersReport(businessId: string, from: string, to: string) {
  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      createdAt: { gte: new Date(from + 'T00:00:00'), lte: new Date(to + 'T23:59:59') },
    },
    include: {
      village: { select: { name: true } },
      _count: { select: { loans: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = customers.map((c) => ({
    customerId: c.customerId,
    fullName: c.fullName,
    phone: c.phone,
    village: c.village.name,
    age: c.age,
    status: c.status,
    totalLoans: c._count.loans,
    createdAt: c.createdAt.toISOString().split('T')[0],
  }))

  return NextResponse.json({
    entity: 'customers',
    from,
    to,
    count: rows.length,
    columns: [
      { key: 'customerId', label: 'Customer ID' },
      { key: 'fullName', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'village', label: 'Village' },
      { key: 'age', label: 'Age' },
      { key: 'status', label: 'Status' },
      { key: 'totalLoans', label: 'Total Loans' },
      { key: 'createdAt', label: 'Registered On' },
    ],
    rows,
  })
}

const ACTIVE_STATUSES = ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER']

function loanHealth(expectedEndDate: string, status: string): string {
  if (!ACTIVE_STATUSES.includes(status)) return '-'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(expectedEndDate + 'T00:00:00')
  const due30 = new Date(due)
  due30.setDate(due30.getDate() + 30)
  if (today <= due) return 'On Track'
  if (today <= due30) return 'Overdue'
  return 'Critical'
}

async function getLoansReport(businessId: string, from: string, to: string, statuses: string | null) {
  const where: Record<string, unknown> = {
    businessId,
    startDate: { gte: from, lte: to },
  }

  if (statuses) {
    const statusList = statuses.split(',').map((s) => s.trim()).filter(Boolean)
    if (statusList.length > 0) {
      where.status = { in: statusList }
    }
  }

  const loans = await prisma.loan.findMany({
    where,
    include: {
      customer: { select: { customerId: true, fullName: true, phone: true, village: { select: { name: true } } } },
      agent: { select: { fullName: true } },
      payments: { where: { isDeleted: false }, select: { amount: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = loans.map((l) => {
    const totalPaid = l.payments.reduce((s, p) => s + p.amount, 0)
    return {
      loanNumber: l.loanNumber,
      customerId: l.customer.customerId,
      customerName: l.customer.fullName,
      phone: l.customer.phone,
      village: l.customer.village.name,
      loanAmount: l.loanAmount / 100,
      interestAmount: l.interestAmount / 100,
      totalRepayable: l.totalRepayable / 100,
      installmentAmount: l.installmentAmount / 100,
      numberOfInstallments: l.numberOfInstallments,
      totalPaid: totalPaid / 100,
      outstanding: (l.totalRepayable - totalPaid) / 100,
      status: l.status,
      healthStatus: loanHealth(l.expectedEndDate, l.status),
      collectionType: l.collectionType,
      agent: l.agent?.fullName || '-',
      startDate: l.startDate,
      dueDate: l.expectedEndDate,
    }
  })

  return NextResponse.json({
    entity: 'loans',
    from,
    to,
    count: rows.length,
    columns: [
      { key: 'loanNumber', label: 'Loan #' },
      { key: 'customerName', label: 'Customer' },
      { key: 'phone', label: 'Phone' },
      { key: 'village', label: 'Village' },
      { key: 'loanAmount', label: 'Principal (₹)' },
      { key: 'interestAmount', label: 'Interest (₹)' },
      { key: 'totalRepayable', label: 'Repayable (₹)' },
      { key: 'installmentAmount', label: 'Installment (₹)' },
      { key: 'numberOfInstallments', label: '# Installments' },
      { key: 'totalPaid', label: 'Paid (₹)' },
      { key: 'outstanding', label: 'Outstanding (₹)' },
      { key: 'status', label: 'Status' },
      { key: 'healthStatus', label: 'Health' },
      { key: 'collectionType', label: 'Collection' },
      { key: 'agent', label: 'Agent' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'dueDate', label: 'Due Date' },
    ],
    rows,
  })
}

async function getVillagesReport(businessId: string, from: string, to: string) {
  const villages = await prisma.village.findMany({
    where: { businessId, isActive: true },
    include: {
      customers: {
        where: { businessId },
        select: {
          id: true,
          status: true,
          loans: {
            where: { status: { in: ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER'] } },
            select: {
              loanAmount: true,
              installmentAmount: true,
              payments: {
                where: { isDeleted: false, paymentDate: { gte: from, lte: to } },
                select: { amount: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const rows = villages.map((v) => {
    const activeCustomers = v.customers.filter((c) => c.status === 'ACTIVE').length
    const totalCustomers = v.customers.length
    let activeLoans = 0
    let loanGivenTotal = 0
    let expectedTotal = 0
    let collectedTotal = 0

    v.customers.forEach((c) => {
      c.loans.forEach((l) => {
        activeLoans++
        loanGivenTotal += l.loanAmount
        expectedTotal += l.installmentAmount
        collectedTotal += l.payments.reduce((s, p) => s + p.amount, 0)
      })
    })

    return {
      village: v.name,
      totalCustomers,
      activeCustomers,
      activeLoans,
      loanGiven: loanGivenTotal / 100,
      expected: expectedTotal / 100,
      collected: collectedTotal / 100,
    }
  })

  return NextResponse.json({
    entity: 'villages',
    from,
    to,
    count: rows.length,
    columns: [
      { key: 'village', label: 'Village' },
      { key: 'totalCustomers', label: 'Total Customers' },
      { key: 'activeCustomers', label: 'Active Customers' },
      { key: 'activeLoans', label: 'Active Loans' },
      { key: 'loanGiven', label: 'Loan Given (₹)' },
      { key: 'expected', label: 'Expected (₹)' },
      { key: 'collected', label: 'Collected (₹)' },
    ],
    rows,
  })
}

async function getVillageCustomersReport(businessId: string, villageId: string, from: string, to: string) {
  const village = await prisma.village.findFirst({
    where: { id: villageId, businessId },
    select: { name: true },
  })

  if (!village) {
    return NextResponse.json({ error: 'Village not found' }, { status: 404 })
  }

  const customers = await prisma.customer.findMany({
    where: { businessId, villageId },
    include: {
      loans: {
        where: { status: { in: ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER'] } },
        select: {
          installmentAmount: true,
          loanAmount: true,
          totalRepayable: true,
          status: true,
          payments: {
            where: { isDeleted: false, paymentDate: { gte: from, lte: to } },
            select: { amount: true },
          },
        },
      },
    },
    orderBy: { fullName: 'asc' },
  })

  const rows = customers.map((c) => {
    const activeLoans = c.loans.length
    const totalLent = c.loans.reduce((s, l) => s + l.loanAmount, 0)
    const totalRepayable = c.loans.reduce((s, l) => s + l.totalRepayable, 0)
    const expected = c.loans.reduce((s, l) => s + l.installmentAmount, 0)
    const collected = c.loans.reduce((s, l) => s + l.payments.reduce((ps, p) => ps + p.amount, 0), 0)

    return {
      customerId: c.customerId,
      fullName: c.fullName,
      phone: c.phone,
      status: c.status,
      activeLoans,
      totalLent: totalLent / 100,
      totalRepayable: totalRepayable / 100,
      expected: expected / 100,
      collected: collected / 100,
      pending: (expected - collected) / 100,
    }
  })

  return NextResponse.json({
    entity: 'villages',
    villageName: village.name,
    from,
    to,
    count: rows.length,
    columns: [
      { key: 'customerId', label: 'Customer ID' },
      { key: 'fullName', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status' },
      { key: 'activeLoans', label: 'Active Loans' },
      { key: 'totalLent', label: 'Total Lent (₹)' },
      { key: 'totalRepayable', label: 'Repayable (₹)' },
      { key: 'expected', label: 'Expected (₹)' },
      { key: 'collected', label: 'Collected (₹)' },
      { key: 'pending', label: 'Pending (₹)' },
    ],
    rows,
  })
}

async function getEmployeesReport(businessId: string, from: string, to: string) {
  const assignments = await prisma.userBusinessAssignment.findMany({
    where: { businessId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          villageAssignments: {
            include: { village: { select: { name: true } } },
          },
          assignedLoans: {
            where: { businessId, status: { in: ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER'] } },
            select: { id: true, loanAmount: true },
          },
          collectedPayments: {
            where: { businessId, isDeleted: false, paymentDate: { gte: from, lte: to } },
            select: { amount: true },
          },
        },
      },
    },
  })

  const rows = assignments.map((a) => {
    const u = a.user
    const totalCollected = u.collectedPayments.reduce((s, p) => s + p.amount, 0)
    const totalLoanGiven = u.assignedLoans.reduce((s, l) => s + l.loanAmount, 0)
    const villageNames = u.villageAssignments
      .map((va) => va.village?.name)
      .filter(Boolean)
      .join(', ')
    return {
      name: u.fullName,
      phone: u.phone || '-',
      village: villageNames || '-',
      role: u.role.replace(/_/g, ' '),
      status: u.isActive ? 'Active' : 'Inactive',
      assignedLoans: u.assignedLoans.length,
      loanAmountGiven: totalLoanGiven / 100,
      paymentsCollected: u.collectedPayments.length,
      amountCollected: totalCollected / 100,
    }
  })

  return NextResponse.json({
    entity: 'employees',
    from,
    to,
    count: rows.length,
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'village', label: 'Village' },
      { key: 'role', label: 'Role' },
      { key: 'status', label: 'Status' },
      { key: 'assignedLoans', label: 'Assigned Loans' },
      { key: 'loanAmountGiven', label: 'Loan Given (₹)' },
      { key: 'paymentsCollected', label: 'Payments Collected' },
      { key: 'amountCollected', label: 'Amount Collected (₹)' },
    ],
    rows,
  })
}

async function getPaymentsReport(businessId: string, from: string, to: string) {
  const payments = await prisma.payment.findMany({
    where: {
      businessId,
      isDeleted: false,
      paymentDate: { gte: from, lte: to },
    },
    include: {
      loan: {
        select: {
          loanNumber: true,
          customer: { select: { customerId: true, fullName: true, phone: true, village: { select: { name: true } } } },
        },
      },
      collector: { select: { fullName: true } },
    },
    orderBy: { paymentDate: 'desc' },
  })

  const rows = payments.map((p) => ({
    receiptNumber: p.receiptNumber,
    paymentDate: p.paymentDate,
    customerName: p.loan.customer.fullName,
    customerId: p.loan.customer.customerId,
    phone: p.loan.customer.phone,
    village: p.loan.customer.village.name,
    loanNumber: p.loan.loanNumber,
    amount: p.amount / 100,
    collectedBy: p.collector.fullName,
    note: p.note || '-',
  }))

  return NextResponse.json({
    entity: 'payments',
    from,
    to,
    count: rows.length,
    columns: [
      { key: 'receiptNumber', label: 'Receipt #' },
      { key: 'paymentDate', label: 'Date' },
      { key: 'customerName', label: 'Customer' },
      { key: 'customerId', label: 'Customer ID' },
      { key: 'phone', label: 'Phone' },
      { key: 'village', label: 'Village' },
      { key: 'loanNumber', label: 'Loan #' },
      { key: 'amount', label: 'Amount (₹)' },
      { key: 'collectedBy', label: 'Collected By' },
      { key: 'note', label: 'Note' },
    ],
    rows,
  })
}
