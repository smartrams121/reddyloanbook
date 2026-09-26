import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { formatPaiseShort } from '@/lib/money'
import { todayIST, formatDateISO, formatDateDisplay, parseISODate, addDays } from '@/lib/date'
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

  const today = todayIST()
  const dateRange = getDateRange(range, from, to)

  const [
    activeCustomers,
    closedCustomers,
    defaulterCustomers,
    activeLoans,
    rangePayments,
    villages,
    rangeNewLoans,
    completedLoansCount,
    rangeActiveLoans,
    rangePaymentsDetail,
  ] = await Promise.all([
    prisma.customer.count({ where: { businessId, status: 'ACTIVE' } }),
    prisma.customer.count({ where: { businessId, status: 'CLOSED' } }),
    prisma.customer.count({ where: { businessId, status: 'DEFAULTER' } }),
    prisma.loan.findMany({
      where: { businessId, status: { in: ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER'] } },
      select: { id: true, totalRepayable: true, installmentAmount: true, startDate: true },
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
    prisma.loan.count({
      where: { businessId, closedAt: { gte: dateRange.start, lte: dateRange.end }, status: { in: ['COMPLETED', 'COMPLETED_RENEWED', 'SETTLED'] } },
    }),
    // Loans active during the date range: currently active (started before range end) OR completed/settled during the range
    prisma.loan.findMany({
      where: {
        businessId,
        startDate: { lte: dateRange.end },
        OR: [
          { status: { in: ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER', 'FROZEN'] } },
          { status: { in: ['COMPLETED', 'COMPLETED_RENEWED', 'SETTLED'] }, closedAt: { gte: dateRange.start } },
        ],
      },
      select: { installmentAmount: true, customerId: true, customer: { select: { villageId: true } } },
    }),
    // Payments in date range with customer/village info for village breakdown
    prisma.payment.findMany({
      where: { businessId, paymentDate: { gte: dateRange.start, lte: dateRange.end }, isDeleted: false },
      select: { loan: { select: { customerId: true, customer: { select: { villageId: true } } } } },
    }),
  ])

  const loanIds = activeLoans.map((l) => l.id)
  const totalPaidPerLoan = await prisma.payment.groupBy({
    by: ['loanId'],
    where: { businessId, loanId: { in: loanIds }, isDeleted: false },
    _sum: { amount: true },
  })
  const paidMap = new Map(totalPaidPerLoan.map((p) => [p.loanId, p._sum.amount || 0]))

  let totalOutstanding = 0
  let totalLent = 0
  for (const loan of activeLoans) {
    const paid = paidMap.get(loan.id) || 0
    totalOutstanding += loan.totalRepayable - paid
    totalLent += loan.totalRepayable
  }

  const periodExpected = rangeActiveLoans.reduce((sum, l) => sum + (l.installmentAmount || 0), 0)
  const expectedLoanCount = rangeActiveLoans.length
  const periodCollected = rangePayments._sum.amount || 0
  const collectedCount = rangePayments._count
  const newLoanCount = rangeNewLoans.length
  const newLoanAmount = rangeNewLoans.reduce((sum, l) => sum + l.amountGiven, 0)
  const periodInHand = periodCollected - newLoanAmount

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
    const notPaid = [...activeSet].filter((cid) => !paidSet.has(cid)).length
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

      {/* Customer Summary */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Customers</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="badge-success">{activeCustomers} Active</span>
          <span className="badge-gray">{closedCustomers} Closed</span>
          <span className="badge-danger">{defaulterCustomers} Defaulter</span>
        </div>
      </div>

      {/* Village Summary */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Villages</h2>
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
        <Link href={`/b/${businessId}/customers/new`} className="btn-secondary text-center">
          New Customer
        </Link>
      </div>
    </div>
  )
}
