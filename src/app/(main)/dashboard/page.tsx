import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@/lib/constants'
import { formatPaiseShort } from '@/lib/money'
import { todayIST } from '@/lib/date'
import { resolveLoanStatus, getGracePeriod } from '@/lib/loan-status'
import Link from 'next/link'
import BusinessActions from './BusinessActions'
import { T } from '@/lib/i18n'
import AutoRefresh from '@/components/AutoRefresh'

export default async function DashboardPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  if (user.role === Role.PLATFORM_ADMIN) {
    redirect('/admin/owners')
  }

  // Agents/Business Admins go straight to their business
  if (user.role === Role.AGENT || user.role === Role.BUSINESS_ADMIN) {
    if (user.businessIds.length === 1) {
      redirect(`/b/${user.businessIds[0]}/dashboard`)
    }
    if (user.activeBusinessId) {
      redirect(`/b/${user.activeBusinessId}/dashboard`)
    }
    if (user.businessIds.length > 1) {
      redirect('/select-business')
    }
  }

  // Owner: show summary dashboard
  const businesses = await prisma.business.findMany({
    where: { ownerId: user.id, isActive: true },
    orderBy: { name: 'asc' },
  })

  const today = todayIST()
  const stats = await Promise.all(
    businesses.map(async (biz) => {
      const [customerCount, allLoans, todayPayments, todayNewLoans] = await Promise.all([
        prisma.customer.count({ where: { businessId: biz.id } }),
        prisma.loan.findMany({
          where: { businessId: biz.id },
          select: { totalRepayable: true, id: true, expectedEndDate: true, collectionType: true, numberOfInstallments: true, statusOverride: true, statusOverrideDate: true },
        }),
        prisma.payment.aggregate({
          where: { businessId: biz.id, paymentDate: today, isDeleted: false },
          _sum: { amount: true },
        }),
        prisma.loan.findMany({
          where: { businessId: biz.id, startDate: today },
          select: { amountGiven: true },
        }),
      ])

      const loanIds = allLoans.map((l) => l.id)
      const totalPaidPerLoan = loanIds.length > 0
        ? await prisma.payment.groupBy({
            by: ['loanId'],
            where: { businessId: biz.id, loanId: { in: loanIds }, isDeleted: false },
            _sum: { amount: true },
          })
        : []
      const paidMap = new Map(totalPaidPerLoan.map((p) => [p.loanId, p._sum.amount || 0]))

      const activeLoans = allLoans.filter((l) => {
        const status = resolveLoanStatus(l, paidMap.get(l.id) || 0, getGracePeriod(biz, l.collectionType), l.collectionType, biz.defaulterPeriodDays ?? 365)
        return status === 'ACTIVE' || status === 'OVERDUE'
      })

      let totalOutstanding = 0
      for (const loan of activeLoans) {
        totalOutstanding += loan.totalRepayable - (paidMap.get(loan.id) || 0)
      }

      return {
        business: biz,
        customerCount,
        activeLoanCount: activeLoans.length,
        totalOutstanding,
        todayCollection: todayPayments._sum.amount || 0,
        todayNewLoanCount: todayNewLoans.length,
        todayDisbursed: todayNewLoans.reduce((sum, l) => sum + l.amountGiven, 0),
      }
    })
  )

  const grandTotals = stats.reduce(
    (acc, s) => ({
      customers: acc.customers + s.customerCount,
      loans: acc.loans + s.activeLoanCount,
      outstanding: acc.outstanding + s.totalOutstanding,
      todayCollection: acc.todayCollection + s.todayCollection,
      todayNewLoans: acc.todayNewLoans + s.todayNewLoanCount,
      todayDisbursed: acc.todayDisbursed + s.todayDisbursed,
    }),
    { customers: 0, loans: 0, outstanding: 0, todayCollection: 0, todayNewLoans: 0, todayDisbursed: 0 }
  )

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <AutoRefresh />
      <h1 className="text-xl font-bold text-gray-900 mb-1">Welcome, {user.fullName}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {businesses.length} collection{businesses.length !== 1 ? 's' : ''} &middot; Select a collection from the top-right dropdown to manage it
      </p>

      {/* Today's Totals */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-value">{grandTotals.todayNewLoans}</div>
          <div className="stat-label"><T k="dashboard.new_loans" /></div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatPaiseShort(grandTotals.todayDisbursed)}</div>
          <div className="stat-label"><T k="dashboard.disbursed" /></div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-success-600">
            {formatPaiseShort(grandTotals.todayCollection)}
          </div>
          <div className="stat-label"><T k="dashboard.collection" /></div>
        </div>
      </div>

      {/* Business List */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900"><T k="dashboard.my_collections" /></h2>
        <Link href="/businesses/new" className="text-xs font-medium px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors">
          + <T k="dashboard.new_collection" />
        </Link>
      </div>
      <div className="space-y-2">
        {stats.map(({ business, customerCount, totalOutstanding, todayCollection }) => (
          <div key={business.id} className="card p-4 hover:border-primary-300 transition-colors">
            <Link
              href={`/b/${business.id}/dashboard`}
              className="flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{business.name}</h3>
                <p className="text-xs text-gray-500">{business.city} &middot; {customerCount} customers</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">{formatPaiseShort(totalOutstanding)}</div>
                <div className="text-xs text-success-600">+{formatPaiseShort(todayCollection)} today</div>
              </div>
            </Link>
          </div>
        ))}

        {businesses.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-gray-500 mb-4">No businesses registered yet.</p>
            <Link href="/businesses/new" className="btn-primary">
              <T k="dashboard.register_first_collection" />
            </Link>
          </div>
        )}
      </div>

      {businesses.length > 0 && (
        <div className="mt-0"></div>
      )}
    </div>
  )
}
