import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { formatPaiseShort } from '@/lib/money'
import { todayIST, formatDateISO, formatDateDisplay, parseISODate, addDays } from '@/lib/date'
import { resolveLoanStatus, getGracePeriod } from '@/lib/loan-status'
import { Role } from '@/lib/constants'
import Link from 'next/link'
import DateFilter from './DateFilter'
import { T } from '@/lib/i18n'
import AutoRefresh from '@/components/AutoRefresh'

interface Props {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string; villages?: string; employees?: string }>
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
  const { range, from, to, villages: villageFilter, employees: employeeFilter } = await searchParams
  const selectedVillageIds = villageFilter ? villageFilter.split(',').filter(Boolean) : []
  const selectedEmployeeIds = employeeFilter ? employeeFilter.split(',').filter(Boolean) : []
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

  // Agents go to their own activity page as dashboard
  if (isAgent) {
    redirect(`/b/${businessId}/users/${user.id}`)
  }

  const today = todayIST()
  const dateRange = getDateRange(range, from, to)


  const [
    allLoans,
    rangePayments,
    villages,
    rangeNewLoans,
    employeeAssignments,
  ] = await Promise.all([
    prisma.loan.findMany({
      where: { businessId },
      select: { id: true, loanAmount: true, totalRepayable: true, installmentAmount: true, startDate: true, expectedEndDate: true, collectionType: true, numberOfInstallments: true, statusOverride: true, statusOverrideDate: true, customerId: true, customer: { select: { villageId: true } } },
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
    prisma.userBusinessAssignment.findMany({
      where: { businessId },
      include: { user: { select: { id: true, fullName: true } } },
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
    derivedStatus: resolveLoanStatus(l, paidMap.get(l.id) || 0, getGracePeriod(business!, l.collectionType), l.collectionType, business!.defaulterPeriodDays),
  }))

  const activeLoans = loansWithStatus.filter((l) => l.derivedStatus === 'ACTIVE' || l.derivedStatus === 'OVERDUE' || l.derivedStatus === 'DEFAULTER')

  let totalOutstanding = 0
  let totalRepayable = 0
  let totalLoanAmount = 0
  for (const loan of activeLoans) {
    totalOutstanding += loan.totalRepayable - loan.paid
    totalRepayable += loan.totalRepayable
    totalLoanAmount += loan.loanAmount
  }

  const activeCustomerIds = new Set(activeLoans.map(l => l.customerId))
  const activeCustomerCount = activeCustomerIds.size

  // Loan status counts for summary
  const loanStatusCounts = { ACTIVE: 0, OVERDUE: 0, DEFAULTER: 0, COMPLETED: 0 }
  for (const l of loansWithStatus) {
    loanStatusCounts[l.derivedStatus]++
  }

  const hasVillageFilter = selectedVillageIds.length > 0
  const villageIdSet = new Set(selectedVillageIds)
  const hasEmployeeFilter = selectedEmployeeIds.length > 0
  const employeeIdSet = new Set(selectedEmployeeIds)

  // Range-active loans: started before range end, not completed, optionally filtered by village
  const rangeActiveLoans = loansWithStatus.filter(
    (l) => l.startDate <= dateRange.end && (l.derivedStatus === 'ACTIVE' || l.derivedStatus === 'OVERDUE')
      && (!hasVillageFilter || villageIdSet.has(l.customer.villageId))
  )

  // Completed loans in range: derive from paid data
  const completedLoansCount = loansWithStatus.filter(
    (l) => l.derivedStatus === 'COMPLETED' && l.paid > 0
      && (!hasVillageFilter || villageIdSet.has(l.customer.villageId))
  ).length

  // Range payments with village info for village breakdown + collection metrics
  const rangePaymentsDetail = await prisma.payment.findMany({
    where: { businessId, paymentDate: { gte: dateRange.start, lte: dateRange.end }, isDeleted: false },
    select: { amount: true, collectorId: true, loan: { select: { customerId: true, customer: { select: { villageId: true } } } } },
  })

  // Village breakdown: active customers, paid, not paid
  // Compute collection metrics with optional village + employee filter
  const filteredPayments = rangePaymentsDetail.filter(p =>
    (!hasVillageFilter || villageIdSet.has(p.loan.customer.villageId))
    && (!hasEmployeeFilter || employeeIdSet.has(p.collectorId))
  )
  const periodCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0)
  const collectedCount = filteredPayments.length
  const periodExpected = rangeActiveLoans.reduce((sum, l) => sum + (l.installmentAmount || 0), 0)
  const expectedLoanCount = rangeActiveLoans.length

  const filteredNewLoans = hasVillageFilter
    ? rangeNewLoans.filter(l => {
        const loan = allLoans.find(al => al.startDate === l.amountGiven.toString())
        return !loan || true // new loans don't have village easily, include all if no filter
      })
    : rangeNewLoans
  // Paid/Unpaid loan counts for the range
  const paidLoanIds = new Set(rangePaymentsDetail.map(p => p.loan?.customerId ? p.loan.customerId : ''))
  const rangePaidLoans = rangePaymentsDetail.map(p => p.loan)
  const paidLoanIdSet = new Set<string>()
  // Get unique loan IDs that received payments in the range
  const rangePaymentsByLoan = await prisma.payment.findMany({
    where: { businessId, paymentDate: { gte: dateRange.start, lte: dateRange.end }, isDeleted: false },
    select: { loanId: true },
    distinct: ['loanId'],
  })
  const paidLoanCount = rangePaymentsByLoan.length
  const unpaidLoanCount = Math.max(0, rangeActiveLoans.length - paidLoanCount)

  const newLoanAmount = rangeNewLoans.reduce((sum, l) => sum + l.amountGiven, 0)
  const newLoanCount = rangeNewLoans.length
  const periodInHand = periodCollected - newLoanAmount

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
      <AutoRefresh />
      {/* Business Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{business.name}</h1>
        <p className="text-sm text-gray-500">
          {business.city} &middot; {business.collectionType} &middot; {formatDateDisplay(today)}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="stat-card">
          <div className="stat-value">{formatPaiseShort(totalLoanAmount)}</div>
          <div className="stat-label"><T k="dashboard.total_loan_amount" /> ({activeLoans.length})</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatPaiseShort(totalRepayable)}</div>
          <div className="stat-label"><T k="dashboard.repayable" /></div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatPaiseShort(totalOutstanding)}</div>
          <div className="stat-label"><T k="dashboard.outstanding" /></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link href={`/b/${businessId}/customers?status=ACTIVE,OVERDUE,DEFAULTER`} className="stat-card hover:border-primary-300 transition-colors block">
          <div className="stat-value">{activeCustomerCount}</div>
          <div className="stat-label"><T k="dashboard.customers" /></div>
        </Link>
        <Link href={`/b/${businessId}/loans?status=ACTIVE,OVERDUE,DEFAULTER`} className="stat-card hover:border-primary-300 transition-colors block">
          <div className="stat-value">{activeLoans.length}</div>
          <div className="stat-label"><T k="dashboard.loans" /></div>
        </Link>
        <Link href={`/b/${businessId}/employees`} className="stat-card hover:border-primary-300 transition-colors block">
          <div className="stat-value">{employeeAssignments.length}</div>
          <div className="stat-label"><T k="dashboard.employees" /></div>
        </Link>
      </div>

      {/* Date Filter */}
      <DateFilter
        villages={villages.map(v => ({ id: v.id, name: v.name }))}
        employees={employeeAssignments.map(ea => ({ id: ea.user.id, name: ea.user.fullName }))}
      />

      {/* Collection Section */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {dateRange.label}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-lg font-bold text-gray-400">{formatPaiseShort(periodExpected)}</div>
            <div className="text-xs text-gray-500"><T k="dashboard.expected" />{expectedLoanCount > 0 ? ` (${expectedLoanCount})` : ''}</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${periodCollected >= periodExpected ? 'text-success-600' : 'text-warning-600'}`}>
              {formatPaiseShort(periodCollected)}
            </div>
            <div className="text-xs text-gray-500"><T k="dashboard.collected" />{collectedCount > 0 ? ` (${collectedCount})` : ''}</div>
          </div>
          <div>
            <div className="text-lg font-bold text-primary-600">
              {formatPaiseShort(newLoanAmount)}
            </div>
            <div className="text-xs text-gray-500"><T k="dashboard.new_loans" />{newLoanCount > 0 ? ` (${newLoanCount})` : ''}</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${periodInHand >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
              {formatPaiseShort(Math.abs(periodInHand))}
              {periodInHand < 0 && <span className="text-xs font-normal text-danger-500 ml-1"><T k="dashboard.deficit" /></span>}
            </div>
            <div className="text-xs text-gray-500"><T k="dashboard.in_hand" /></div>
          </div>
          <div>
            <div className="text-lg font-bold text-success-700">{completedLoansCount}</div>
            <div className="text-xs text-gray-500"><T k="dashboard.completed_loans" /></div>
          </div>
          <Link href={`/b/${businessId}/posting/view`} className="hover:opacity-80 transition-opacity">
            <div className="text-lg font-bold text-green-600">{paidLoanCount}</div>
            <div className="text-xs text-gray-500">Paid</div>
          </Link>
          <Link href={`/b/${businessId}/posting/bulk`} className="hover:opacity-80 transition-opacity">
            <div className="text-lg font-bold text-red-600">{unpaidLoanCount}</div>
            <div className="text-xs text-gray-500">Unpaid</div>
          </Link>
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
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3"><T k="loans.loans" /></h2>
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <Link href={`/b/${businessId}/loans?status=ACTIVE`} className="badge-success hover:opacity-80 transition-opacity">{loanStatusCounts.ACTIVE} Active</Link>
          <Link href={`/b/${businessId}/loans?status=OVERDUE`} className="bg-red-50 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity">{loanStatusCounts.OVERDUE} Overdue</Link>
          <Link href={`/b/${businessId}/loans?status=DEFAULTER`} className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity">{loanStatusCounts.DEFAULTER} Defaulter</Link>
          <Link href={`/b/${businessId}/loans?status=COMPLETED`} className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity">{loanStatusCounts.COMPLETED} Completed</Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/b/${businessId}/posting`} className="btn-primary text-center">
          <T k="dashboard.record_payment" />
        </Link>
        {(user.role === Role.OWNER || user.role === Role.BUSINESS_ADMIN) && (
          <Link href={`/b/${businessId}/customers/new`} className="btn-secondary text-center">
            <T k="dashboard.new_customer" />
          </Link>
        )}
      </div>
    </div>
  )
}
