import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { resolveLoanStatus, deriveCustomerStatus, getGracePeriod, GracePeriodConfig } from '@/lib/loan-status'

interface Props {
  params: Promise<{ businessId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const entity = searchParams.get('entity') || 'customers'

  try {
    await assertBusinessAccess(user, businessId)
    if (entity !== 'payslips') {
      assertPermission(user, 'view_all_reports', businessId)
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }
  const startDate = searchParams.get('from')
  const endDate = searchParams.get('to')
  const villageId = searchParams.get('villageId')
  const statuses = searchParams.get('statuses')

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'from and to dates are required' }, { status: 400 })
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { gracePeriodDaily: true, gracePeriodWeekly: true, gracePeriodMonthly: true, defaulterPeriodDays: true },
  })
  const graceConfig: GracePeriodConfig = {
    gracePeriodDaily: business?.gracePeriodDaily ?? 30,
    gracePeriodWeekly: business?.gracePeriodWeekly ?? 4,
    gracePeriodMonthly: business?.gracePeriodMonthly ?? 1,
    defaulterPeriodDays: business?.defaulterPeriodDays ?? 365,
  }

  switch (entity) {
    case 'customers':
      return getCustomersReport(businessId, startDate, endDate, graceConfig)
    case 'loans':
      return getLoansReport(businessId, startDate, endDate, statuses, graceConfig)
    case 'villages':
      if (villageId) return getVillageCustomersReport(businessId, villageId, startDate, endDate, graceConfig)
      return getVillagesReport(businessId, startDate, endDate, graceConfig)
    case 'employees':
      return getEmployeesReport(businessId, startDate, endDate, graceConfig)
    case 'payments':
      return getPaymentsReport(businessId, startDate, endDate)
    case 'payslips':
      return getPaySlipsReport(businessId, startDate)
    case 'daily_collection':
      return getDailyCollectionReport(businessId, startDate, graceConfig)
    default:
      return NextResponse.json({ error: 'Invalid entity' }, { status: 400 })
  }
}

async function getCustomersReport(businessId: string, from: string, to: string, graceConfig: GracePeriodConfig) {
  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      createdAt: { gte: new Date(from + 'T00:00:00'), lte: new Date(to + 'T23:59:59') },
    },
    include: {
      village: { select: { name: true } },
      loans: { select: { id: true, expectedEndDate: true, totalRepayable: true, collectionType: true, numberOfInstallments: true, statusOverride: true, statusOverrideDate: true } },
      _count: { select: { loans: true } },
    },
    orderBy: { customerId: 'asc' },
  })

  const allLoanIds = customers.flatMap((c) => c.loans.map((l) => l.id))
  const paidSums = allLoanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: allLoanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const paidMap = new Map(paidSums.map((p) => [p.loanId, p._sum.amount || 0]))

  const rows = customers.map((c) => {
    const loanStatuses = c.loans.map((l) =>
      resolveLoanStatus(l, paidMap.get(l.id) || 0, getGracePeriod(graceConfig, l.collectionType), l.collectionType, graceConfig.defaulterPeriodDays)
    )
    return {
      customerId: c.customerId,
      fullName: c.fullName,
      phone: c.phone,
      village: c.village.name,
      age: c.age,
      status: deriveCustomerStatus(loanStatuses),
      totalLoans: c._count.loans,
      createdAt: c.createdAt.toISOString().split('T')[0],
    }
  })

  return NextResponse.json({
    entity: 'customers',
    from,
    to,
    count: rows.length,
    columns: [
      { key: 'seq', label: '#' },
      { key: 'customerId', label: 'CID' },
      { key: 'fullName', label: 'Customer' },
      { key: 'phone', label: 'Phone' },
      { key: 'age', label: 'Age' },
      { key: 'village', label: 'Location' },
      { key: 'status', label: 'Status' },
      { key: 'totalLoans', label: 'Total Loans' },
      { key: 'createdAt', label: 'Registered On' },
    ],
    rows: rows.map((r, i) => ({ seq: i + 1, ...r })),
  })
}

async function getLoansReport(businessId: string, from: string, to: string, statuses: string | null, graceConfig: GracePeriodConfig) {
  const where: Record<string, unknown> = {
    businessId,
    startDate: { gte: from, lte: to },
  }

  const loans = await prisma.loan.findMany({
    where,
    include: {
      customer: { select: { customerId: true, fullName: true, phone: true, village: { select: { name: true } } } },
      agent: { select: { fullName: true } },
    },
    orderBy: { customer: { customerId: 'asc' } },
  })

  const loanIds = loans.map((l) => l.id)
  const paidSums = loanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: loanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const paidMap = new Map(paidSums.map((p) => [p.loanId, p._sum.amount || 0]))

  const statusFilter = statuses
    ? new Set(statuses.split(',').map((s) => s.trim()).filter(Boolean))
    : null

  const rows = loans
    .map((l) => {
      const totalPaid = paidMap.get(l.id) || 0
      const status = resolveLoanStatus(l, totalPaid, getGracePeriod(graceConfig, l.collectionType), l.collectionType, graceConfig.defaulterPeriodDays)
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
        status,
        collectionType: l.collectionType,
        agent: l.agent?.fullName || '-',
        startDate: l.startDate,
        dueDate: l.expectedEndDate,
      }
    })
    .filter((r) => !statusFilter || statusFilter.has(r.status))

  return NextResponse.json({
    entity: 'loans',
    from,
    to,
    count: rows.length,
    columns: [
      { key: 'seq', label: '#' },
      { key: 'customerId', label: 'CID' },
      { key: 'customerName', label: 'Customer' },
      { key: 'loanNumber', label: 'Loan #' },
      { key: 'village', label: 'Location' },
      { key: 'collectionType', label: 'Type' },
      { key: 'loanAmount', label: 'Principal (₹)' },
      { key: 'interestAmount', label: 'Interest (₹)' },
      { key: 'totalRepayable', label: 'Repayable (₹)' },
      { key: 'installmentAmount', label: 'Installment (₹)' },
      { key: 'numberOfInstallments', label: '# Installments' },
      { key: 'totalPaid', label: 'Paid (₹)' },
      { key: 'outstanding', label: 'Outstanding (₹)' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'status', label: 'Status' },
      { key: 'agent', label: 'Agent' },
    ],
    rows: rows.map((r, i) => ({ seq: i + 1, ...r })),
  })
}

async function getVillagesReport(businessId: string, from: string, to: string, graceConfig: GracePeriodConfig) {
  const villages = await prisma.village.findMany({
    where: { businessId, isActive: true },
    include: {
      customers: {
        where: { businessId },
        select: {
          id: true,
          loans: {
            select: { id: true, loanAmount: true, installmentAmount: true, totalRepayable: true, expectedEndDate: true, collectionType: true, numberOfInstallments: true, statusOverride: true, statusOverrideDate: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const allLoanIds = villages.flatMap((v) =>
    v.customers.flatMap((c) => c.loans.map((l) => l.id))
  )
  const paidSumsTotal = allLoanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: allLoanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const totalPaidMap = new Map(paidSumsTotal.map((p) => [p.loanId, p._sum.amount || 0]))

  const paidSumsPeriod = allLoanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: allLoanIds }, isDeleted: false, paymentDate: { gte: from, lte: to } },
        _sum: { amount: true },
      })
    : []
  const periodPaidMap = new Map(paidSumsPeriod.map((p) => [p.loanId, p._sum.amount || 0]))

  const rows = villages.map((v) => {
    const totalCustomers = v.customers.length
    let activeCustomers = 0
    let activeLoans = 0
    let loanGivenTotal = 0
    let expectedTotal = 0
    let collectedTotal = 0

    v.customers.forEach((c) => {
      const loanStatuses = c.loans.map((l) =>
        resolveLoanStatus(l, totalPaidMap.get(l.id) || 0, getGracePeriod(graceConfig, l.collectionType), l.collectionType, graceConfig.defaulterPeriodDays)
      )
      const custStatus = deriveCustomerStatus(loanStatuses)
      if (custStatus === 'ACTIVE' || custStatus === 'OVERDUE') activeCustomers++

      c.loans.forEach((l, idx) => {
        const ls = loanStatuses[idx]
        if (ls === 'ACTIVE' || ls === 'OVERDUE') {
          activeLoans++
          loanGivenTotal += l.loanAmount
          expectedTotal += l.installmentAmount
          collectedTotal += periodPaidMap.get(l.id) || 0
        }
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
      { key: 'village', label: 'Location' },
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

async function getVillageCustomersReport(businessId: string, villageId: string, from: string, to: string, graceConfig: GracePeriodConfig) {
  const village = await prisma.village.findFirst({
    where: { id: villageId, businessId },
    select: { name: true },
  })

  if (!village) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  const customers = await prisma.customer.findMany({
    where: { businessId, villageId },
    include: {
      loans: {
        select: {
          id: true,
          installmentAmount: true,
          loanAmount: true,
          totalRepayable: true,
          expectedEndDate: true,
          collectionType: true,
          numberOfInstallments: true,
          statusOverride: true,
          statusOverrideDate: true,
          payments: {
            where: { isDeleted: false, paymentDate: { gte: from, lte: to } },
            select: { amount: true },
          },
        },
      },
    },
    orderBy: { customerId: 'asc' },
  })

  const allLoanIds = customers.flatMap((c) => c.loans.map((l) => l.id))
  const paidSumsAll = allLoanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: allLoanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const totalPaidMap = new Map(paidSumsAll.map((p) => [p.loanId, p._sum.amount || 0]))

  const rows = customers.map((c) => {
    const loanStatuses = c.loans.map((l) =>
      resolveLoanStatus(l, totalPaidMap.get(l.id) || 0, getGracePeriod(graceConfig, l.collectionType), l.collectionType, graceConfig.defaulterPeriodDays)
    )
    const activeLoans = loanStatuses.filter((s) => s === 'ACTIVE' || s === 'OVERDUE').length
    const totalLent = c.loans.reduce((s, l) => s + l.loanAmount, 0)
    const totalRepayable = c.loans.reduce((s, l) => s + l.totalRepayable, 0)
    const expected = c.loans.reduce((s, l) => s + l.installmentAmount, 0)
    const collected = c.loans.reduce((s, l) => s + l.payments.reduce((ps, p) => ps + p.amount, 0), 0)

    return {
      customerId: c.customerId,
      fullName: c.fullName,
      phone: c.phone,
      status: deriveCustomerStatus(loanStatuses),
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
      { key: 'seq', label: '#' },
      { key: 'customerId', label: 'CID' },
      { key: 'fullName', label: 'Customer' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status' },
      { key: 'activeLoans', label: 'Active Loans' },
      { key: 'totalLent', label: 'Total Lent (₹)' },
      { key: 'totalRepayable', label: 'Repayable (₹)' },
      { key: 'expected', label: 'Expected (₹)' },
      { key: 'collected', label: 'Collected (₹)' },
      { key: 'pending', label: 'Pending (₹)' },
    ],
    rows: rows.map((r, i) => ({ seq: i + 1, ...r })),
  })
}

async function getEmployeesReport(businessId: string, from: string, to: string, graceConfig: GracePeriodConfig) {
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
            where: { businessId },
            select: { id: true, loanAmount: true, totalRepayable: true, expectedEndDate: true, collectionType: true, numberOfInstallments: true, statusOverride: true, statusOverrideDate: true },
          },
          collectedPayments: {
            where: { businessId, isDeleted: false, paymentDate: { gte: from, lte: to } },
            select: { amount: true },
          },
        },
      },
    },
  })

  const allEmpLoanIds = assignments.flatMap((a) => a.user.assignedLoans.map((l) => l.id))
  const empPaidSums = allEmpLoanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: allEmpLoanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const empPaidMap = new Map(empPaidSums.map((p) => [p.loanId, p._sum.amount || 0]))

  const rows = assignments.map((a) => {
    const u = a.user
    const totalCollected = u.collectedPayments.reduce((s, p) => s + p.amount, 0)
    const activeLoans = u.assignedLoans.filter((l) => {
      const paid = empPaidMap.get(l.id) || 0
      const s = resolveLoanStatus(l, paid, getGracePeriod(graceConfig, l.collectionType), l.collectionType, graceConfig.defaulterPeriodDays)
      return s === 'ACTIVE' || s === 'OVERDUE'
    })
    const totalLoanGiven = activeLoans.reduce((s, l) => s + l.loanAmount, 0)
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
      assignedLoans: activeLoans.length,
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
      { key: 'village', label: 'Location' },
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
    orderBy: { loan: { customer: { customerId: 'asc' } } },
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
      { key: 'seq', label: '#' },
      { key: 'customerId', label: 'CID' },
      { key: 'customerName', label: 'Customer' },
      { key: 'loanNumber', label: 'Loan #' },
      { key: 'receiptNumber', label: 'Receipt #' },
      { key: 'paymentDate', label: 'Date' },
      { key: 'village', label: 'Location' },
      { key: 'amount', label: 'Amount (₹)' },
      { key: 'collectedBy', label: 'Collected By' },
      { key: 'note', label: 'Note' },
    ],
    rows: rows.map((r, i) => ({ seq: i + 1, ...r })),
  })
}

async function getPaySlipsReport(businessId: string, date: string) {
  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      loans: { some: {} },
    },
    include: {
      village: { select: { name: true } },
      loans: {
        select: {
          id: true, loanNumber: true, amountGiven: true, installmentAmount: true,
          totalRepayable: true, expectedEndDate: true, collectionType: true,
        },
      },
    },
    orderBy: { customerId: 'asc' },
  })

  const loanIds = customers.flatMap((c) => c.loans.map((l) => l.id))
  const paidSums = loanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: loanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const paidMap = new Map(paidSums.map((p) => [p.loanId, p._sum.amount || 0]))

  const [dy, dm, dd] = date.split('-')
  const formattedDate = `${dd}/${dm}/${dy}`

  const sorted = [...customers].sort((a, b) => a.customerId.localeCompare(b.customerId, undefined, { numeric: true }))

  const rows = sorted.flatMap((c) =>
    c.loans
      .filter((l) => {
        const totalPaid = paidMap.get(l.id) || 0
        return totalPaid < l.totalRepayable
      })
      .map((l) => ({
        customerId: c.customerId,
        customerName: c.fullName,
        loanNumber: l.loanNumber,
        location: c.village.name,
        loanAmount: l.amountGiven / 100,
        outstanding: (l.totalRepayable - (paidMap.get(l.id) || 0)) / 100,
        installmentAmount: l.installmentAmount / 100,
        collectionDate: formattedDate,
        paid: '',
      }))
  )

  return NextResponse.json({
    entity: 'payslips',
    from: date,
    to: date,
    count: rows.length,
    columns: [
      { key: 'seq', label: '#' },
      { key: 'customerId', label: 'CID' },
      { key: 'customerName', label: 'Customer' },
      { key: 'loanNumber', label: 'Loan #' },
      { key: 'location', label: 'Location' },
      { key: 'loanAmount', label: 'Loan Amount (₹)' },
      { key: 'outstanding', label: 'Outstanding (₹)' },
      { key: 'installmentAmount', label: 'Installment (₹)' },
      { key: 'collectionDate', label: 'Collection Date' },
      { key: 'paid', label: 'Paid' },
    ],
    rows: rows.map((r, i) => ({ seq: i + 1, ...r })),
  })
}

async function getDailyCollectionReport(businessId: string, date: string, graceConfig: GracePeriodConfig) {
  const loans = await prisma.loan.findMany({
    where: { businessId, startDate: { lte: date }, status: { not: 'COMPLETED' } },
    select: {
      id: true, loanNumber: true, installmentAmount: true, totalRepayable: true,
      expectedEndDate: true, numberOfInstallments: true, collectionType: true,
      statusOverride: true, statusOverrideDate: true,
      customer: { select: { fullName: true, customerId: true, village: { select: { name: true } } } },
      agent: { select: { fullName: true } },
    },
  })

  const loanIds = loans.map(l => l.id)

  const [totalPaidSums, datePaidSums] = await Promise.all([
    loanIds.length > 0
      ? prisma.payment.groupBy({ by: ['loanId'], where: { loanId: { in: loanIds }, isDeleted: false }, _sum: { amount: true } })
      : [],
    loanIds.length > 0
      ? prisma.payment.groupBy({ by: ['loanId'], where: { loanId: { in: loanIds }, paymentDate: date, isDeleted: false }, _sum: { amount: true } })
      : [],
  ])

  const totalPaidMap = new Map(totalPaidSums.map(p => [p.loanId, p._sum.amount || 0]))
  const datePaidMap = new Map(datePaidSums.map(p => [p.loanId, p._sum.amount || 0]))

  const rows = loans
    .map(l => {
      const totalPaid = totalPaidMap.get(l.id) || 0
      const outstanding = l.totalRepayable - totalPaid
      if (outstanding <= 0) return null
      const paidToday = datePaidMap.get(l.id) || 0
      const status = resolveLoanStatus(l, totalPaid, getGracePeriod(graceConfig, l.collectionType), l.collectionType, graceConfig.defaulterPeriodDays)
      return {
        customerName: l.customer.fullName,
        customerId: l.customer.customerId,
        loanNumber: l.loanNumber,
        location: l.customer.village.name,
        installment: l.installmentAmount / 100,
        paidToday: paidToday / 100,
        outstanding: outstanding / 100,
        agent: l.agent?.fullName || '-',
        loanStatus: status,
        paymentStatus: paidToday > 0 ? 'Paid' : 'Unpaid',
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a!.paymentStatus === b!.paymentStatus) return a!.customerId.localeCompare(b!.customerId, undefined, { numeric: true })
      return a!.paymentStatus === 'Unpaid' ? -1 : 1
    })

  const totalExpected = rows.reduce((sum, r) => sum + r!.installment, 0)
  const totalCollected = rows.reduce((sum, r) => sum + r!.paidToday, 0)
  const paidCount = rows.filter(r => r!.paymentStatus === 'Paid').length
  const unpaidCount = rows.filter(r => r!.paymentStatus === 'Unpaid').length

  return NextResponse.json({
    entity: 'daily_collection',
    from: date,
    to: date,
    count: rows.length,
    summary: {
      totalExpected: Math.round(totalExpected * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      pending: Math.round((totalExpected - totalCollected) * 100) / 100,
      paidCount,
      unpaidCount,
      pct: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0,
    },
    columns: [
      { key: 'seq', label: '#' },
      { key: 'customerId', label: 'CID' },
      { key: 'customerName', label: 'Customer' },
      { key: 'loanNumber', label: 'Loan #' },
      { key: 'location', label: 'Location' },
      { key: 'installment', label: 'Installment (₹)' },
      { key: 'paidToday', label: 'Paid Today (₹)' },
      { key: 'outstanding', label: 'Outstanding (₹)' },
      { key: 'agent', label: 'Agent' },
      { key: 'loanStatus', label: 'Loan Status' },
      { key: 'paymentStatus', label: 'Payment Status' },
    ],
    rows: rows.map((r, i) => ({ seq: i + 1, ...r })),
  })
}
