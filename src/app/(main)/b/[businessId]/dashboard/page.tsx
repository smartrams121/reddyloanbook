import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { formatPaiseShort } from '@/lib/money'
import { todayIST, formatDateISO, formatDateDisplay, parseISODate, addDays } from '@/lib/date'
import { deriveLoanStatus } from '@/lib/loan-status'
import { Role } from '@/lib/constants'
import Link from 'next/link'
import DateFilter from './DateFilter'

interface Props {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}

function getDateRange(range: string | undefined, from: string | undefined, to: string | undefined) {
  const today = todayIST()
  const todayDate = parseISODate(today)

  switch (range) {
    case 'yesterday': {
      const d = formatDateISO(addDays(todayDate, -1))
      return { start: d, end: d, label: "Yesterday's Collection" }
    }
    case '7d': {
      const start = formatDateISO(addDays(todayDate, -6))
      return { start, end: today, label: 'Last 7 Days' }
    }
    case '30d': {
      const start = formatDateISO(addDays(todayDate, -29))
      return { start, end: today, label: 'Last 30 Days' }
    }
    case 'custom': {
      if (from && to) {
        return { start: from, end: to, label: `${formatDateDisplay(from)} – ${formatDateDisplay(to)}` }
      }
      return { start: today, end: today, label: "Today's Collection" }
    }
    default:
      return { start: today, end: today, label: "Today's Collection" }
  }
}

export default async function BusinessDashboardPage({ params, searchParams }: Props) {
  const { businessId } = await params
  const { range, from, to } = await searchParams
  const user = await getSession()
  if (!user) redirect('/login')

  try {
    await assertBusinessAccess(user, businessId)
  } catch {
    redirect('/dashboard')
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  })

  if (!business) redirect('/dashboard')

  const isAgent = user.role === Role.AGENT

  const today = todayIST()
  const dateRange = getDateRange(range, from, to)

  if (isAgent) {
    const [agentPayments, agentLoans, agentRangePayments] = await Promise.all([
      prisma.payment.aggregate({
        where: { businessId, collectorId: user.id, isDeleted: false },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.loan.findMany({
        where: { businessId, agentId: user.id },
        select: { id: true, totalRepayable: true, amountGiven: true, expectedEndDate: true, startDate: true },
      }),
      prisma.payment.aggregate({
        where: { businessId, collectorId: user.id, paymentDate: { gte: dateRange.start, lte: dateRange.end }, isDeleted: false },
        _sum: { amount: true },
        _count: true,
      }),
    ])

    const agentLoanIds = agentLoans.map(l => l.id)
    const agentPaidPerLoan = agentLoanIds.length > 0
      ? await prisma.payment.groupBy({
          by: ['loanId'],
          where: { businessId, loanId: { in: agentLoanIds }, isDeleted: false },
          _sum: { amount: true },
        })
      : []
    const agentPaidMap = new Map(agentPaidPerLoan.map(p => [p.loanId, p._sum.amount || 0]))

    const agentLoansWithStatus = agentLoans.map(l => ({
      ...l,
      paid: agentPaidMap.get(l.id) || 0,
      derivedStatus: deriveLoanStatus(l.expectedEndDate, l.totalRepayable, agentPaidMap.get(l.id) || 0),
    }))

    const agentActiveLoans = agentLoansWithStatus.filter(l => l.derivedStatus === 'ACTIVE' || l.derivedStatus === 'OVERDUE')
    const agentCompletedLoans = agentLoansWithStatus.filter(l => l.derivedStatus === 'COMPLETED')
    const agentTotalDisbursed = agentLoans.reduce((s, l) => s + l.amountGiven, 0)
    const agentTotalOutstanding = agentActiveLoans.reduce((s, l) => s + (l.totalRepayable - l.paid), 0)

    return (
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-sm text-gray-500">
            {business.name} &middot; {user.fullName} &middot; {formatDateDisplay(today)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="stat-card">
            <div className="stat-value">{agentActiveLoans.length}</div>
            <div className="stat-label">Active Loans</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{agentCompletedLoans.length}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatPaiseShort(agentTotalDisbursed)}</div>
            <div className="stat-label">Total Disbursed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatPaiseShort(agentTotalOutstanding)}</div>
            <div className="stat-label">Outstanding</div>
          </div>
        </div>

        <DateFilter />

        <div className="card p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {dateRange.label}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-lg font-bold text-success-600">{formatPaiseShort(agentRangePayments._sum.amount || 0)}</div>
              <div className="text-xs text-gray-500">Collected</div>
            </div>
            <div>
              <div className="text-lg font-bold text-primary-600">{agentRangePayments._count}</div>
              <div className="text-xs text-gray-500">Payments</div>
            </div>
          </div>
        </div>

        <div className="card p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">All-Time Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-lg font-bold text-success-600">{formatPaiseShort(agentPayments._sum.amount || 0)}</div>
              <div className="text-xs text-gray-500">Total Collected ({agentPayments._count} payments)</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{agentLoans.length}</div>
              <div className="text-xs text-gray-500">Loans Disbursed</div>
            </div>
          </div>
        </div>

        <div className="card p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Loan Status</h2>
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="badge-success">{agentLoansWithStatus.filter(l => l.derivedStatus === 'ACTIVE').length} Active</span>
            <span className="bg-red-50 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">{agentLoansWithStatus.filter(l => l.derivedStatus === 'OVERDUE').length} Overdue</span>
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">{agentLoansWithStatus.filter(l => l.derivedStatus === 'DEFAULTER').length} Defaulter</span>
            <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">{agentCompletedLoans.length} Completed</span>
          </div>
        </div>

        <Link href={`/b/${businessId}/posting`} className="btn-primary text-center w-full block">
          Record Payment
        </Link>
      </div>
    )
  }

  const [
    allLoans,
    rangePayments,
    villages,
    rangeNewLoans,
  ] = await Promise.all([
    prisma.loan.findMany({
      where: { businessId },
      select: { id: true, totalRepayable: true, installmentAmount: true, startDate: true, expectedEndDate: true, customerId: true, customer: { select: { villageId: true } } },
    }),
    prisma.payment.aggregate({
      where: { businessId, paymentDate: { gte: dateRange.start, lte: dateRange.end }, isDeleted: false },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.village.findMany({
      where: { businessId, isActive: true },
      include: { _count: { select: { customers: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.loan.findMany({
      where: { businessId, startDate: { gte: dateRange.start, lte: dateRange.end } },
      select: { amountGiven: true },
    }),
  ])

  const allLoanIds = allLoans.map((l) => l.id)
  const totalPaidPerLoan = allLoanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { businessId, loanId: { in: allLoanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const paidMap = new Map(totalPaidPerLoan.map((p) => [p.loanId, p._sum.amount || 0]))

  // Derive status for all loans
  const loansWithStatus = allLoans.map((l) => ({
    ...l,
    paid: paidMap.get(l.id) || 0,
    derivedStatus: deriveLoanStatus(l.expectedEndDate, l.totalRepayable, paidMap.get(l.id) || 0),
  }))

  const activeLoans = loansWithStatus.filter((l) => l.derivedStatus === 'ACTIVE' || l.derivedStatus === 'OVERDUE')

  let totalOutstanding = 0
  let totalLent = 0
  for (const loan of activeLoans) {
    totalOutstanding += loan.totalRepayable - loan.paid
    totalLent += loan.totalRepayable
  }

  // Loan status counts for summary
  const loanStatusCounts = { ACTIVE: 0, OVERDUE: 0, DEFAULTER: 0, COMPLETED: 0 }
  for (const l of loansWithStatus) {
    loanStatusCounts[l.derivedStatus]++
  }

  // Range-active loans: started before range end, not completed
  const rangeActiveLoans = loansWithStatus.filter(
    (l) => l.startDate <= dateRange.end && (l.derivedStatus === 'ACTIVE' || l.derivedStatus === 'OVERDUE')
  )

  // Completed loans in range: derive from paid data
  const completedLoansCount = loansWithStatus.filter(
    (l) => l.derivedStatus === 'COMPLETED' && l.paid > 0
  ).length

  const periodExpected = rangeActiveLoans.reduce((sum, l) => sum + (l.installmentAmount || 0), 0)
  const expectedLoanCount = rangeActiveLoans.length
  const periodCollected = rangePayments._sum.amount || 0
  const collectedCount = rangePayments._count
  const newLoanCount = rangeNewLoans.length
  const newLoanAmount = rangeNewLoans.reduce((sum, l) => sum + l.amountGiven, 0)
  const periodInHand = periodCollected - newLoanAmount

  // Range payments with village info for village breakdown
  const rangePaymentsDetail = await prisma.payment.findMany({
    where: { businessId, paymentDate: { gte: dateRange.start, lte: dateRange.end }, isDeleted: false },
    select: { loan: { select: { customerId: true, customer: { select: { villageId: true } } } } },
  })

  // Village breakdown: active customers, paid, not paid
  const villageActiveMap = new Map<string, Set<string>>()
  for (const loan of rangeActiveLoans) {
    const vid = loan.customer.villageId
    if (!villageActiveMap.has(vid)) villageActiveMap.set(vid, new Set())
    villageActiveMap.get(vid)!.add(loan.customerId)
  }

  const villagePaidMap = new Map<string, Set<string>>()
  for (const p of rangePaymentsDetail) {
    const vid = p.loan.customer.villageId
    if (!villagePaidMap.has(vid)) villagePaidMap.set(vid, new Set())
    villagePaidMap.get(vid)!.add(p.loan.customerId)
  }

  const villageStats = villages.map((v) => {
    const activeSet = villageActiveMap.get(v.id) || new Set()
    const paidSet = villagePaidMap.get(v.id) || new Set()
    const notPaid = Array.from(activeSet).filter((cid) => !paidSet.has(cid)).length
    return { id: v.id, name: v.name, active: activeSet.size, paid: paidSet.size, notPaid }
  })

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      {/* Business Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{business.name}</h1>
        <p className="text-sm text-gray-500">
          {business.city} &middot; {business.collectionType} &middot; {formatDateDisplay(today)}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link href={`/b/${businessId}/loans?status=ACTIVE`} className="stat-card hover:border-primary-300 transition-colors">
          <div className="stat-value">{activeLoans.length}</div>
          <div className="stat-label">Active Loans</div>
        </Link>
        <div className="stat-card">
          <div className="stat-value">{formatPaiseShort(totalOutstanding)}</div>
          <div className="stat-label">Outstanding</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatPaiseShort(totalLent)}</div>
          <div className="stat-label">Total Lent</div>
        </div>
      </div>

      {/* Date Filter */}
      <DateFilter />

      {/* Collection Section */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {dateRange.label}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-lg font-bold text-gray-400">{formatPaiseShort(periodExpected)}</div>
            <div className="text-xs text-gray-500">Expected{expectedLoanCount > 0 ? ` (${expectedLoanCount})` : ''}</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${periodCollected >= periodExpected ? 'text-success-600' : 'text-warning-600'}`}>
              {formatPaiseShort(periodCollected)}
            </div>
            <div className="text-xs text-gray-500">Collected{collectedCount > 0 ? ` (${collectedCount})` : ''}</div>
          </div>
          <div>
            <div className="text-lg font-bold text-primary-600">
              {formatPaiseShort(newLoanAmount)}
            </div>
            <div className="text-xs text-gray-500">New Loans{newLoanCount > 0 ? ` (${newLoanCount})` : ''}</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${periodInHand >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
              {formatPaiseShort(Math.abs(periodInHand))}
              {periodInHand < 0 && <span className="text-xs font-normal text-danger-500 ml-1">deficit</span>}
            </div>
            <div className="text-xs text-gray-500">In Hand</div>
          </div>
          <div>
            <div className="text-lg font-bold text-success-700">{completedLoansCount}</div>
            <div className="text-xs text-gray-500">Completed Loans</div>
          </div>
        </div>
        {periodExpected > 0 && (
          <div className="mt-3">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${periodCollected >= periodExpected ? 'bg-success-500' : 'bg-warning-500'}`}
                style={{ width: `${Math.min(100, (periodCollected / periodExpected) * 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {Math.round((periodCollected / periodExpected) * 100)}% collected
            </div>
          </div>
        )}
      </div>

      {/* Loan Summary */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Loans</h2>
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className="badge-success">{loanStatusCounts.ACTIVE} Active</span>
          <span className="bg-red-50 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">{loanStatusCounts.OVERDUE} Overdue</span>
          <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">{loanStatusCounts.DEFAULTER} Defaulter</span>
          <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">{loanStatusCounts.COMPLETED} Completed</span>
        </div>
      </div>

      {/* Village Summary */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Locations</h2>
          <Link href={`/b/${businessId}/villages`} className="text-sm text-primary-600">View All</Link>
        </div>
        <div className="space-y-2">
          {villageStats.map((v) => (
            <Link
              key={v.id}
              href={`/b/${businessId}/villages/${v.id}`}
              className="flex items-center justify-between py-2 px-1 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="text-sm font-medium text-gray-900">{v.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{v.active}</span>
                <span className="text-xs text-success-600">{v.paid} paid</span>
                <span className="text-xs text-danger-600">{v.notPaid} unpaid</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/b/${businessId}/posting`} className="btn-primary text-center">
          Record Payment
        </Link>
        {(user.role === Role.OWNER || user.role === Role.BUSINESS_ADMIN) && (
          <Link href={`/b/${businessId}/customers/new`} className="btn-secondary text-center">
            New Customer
          </Link>
        )}
      </div>
    </div>
  )
}
