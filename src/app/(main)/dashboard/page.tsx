import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@/lib/constants'
import { formatPaiseShort } from '@/lib/money'
import { todayIST } from '@/lib/date'
import Link from 'next/link'
import BusinessActions from './BusinessActions'

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
      const [customerCount, activeLoans, todayPayments] = await Promise.all([
        prisma.customer.count({ where: { businessId: biz.id, status: 'ACTIVE' } }),
        prisma.loan.findMany({
          where: {
            businessId: biz.id,
            status: { in: ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER'] },
          },
          select: { totalRepayable: true, id: true },
        }),
        prisma.payment.aggregate({
          where: { businessId: biz.id, paymentDate: today, isDeleted: false },
          _sum: { amount: true },
        }),
      ])

      const totalPaidPerLoan = await prisma.payment.groupBy({
        by: ['loanId'],
        where: {
          businessId: biz.id,
          loanId: { in: activeLoans.map((l) => l.id) },
          isDeleted: false,
        },
        _sum: { amount: true },
      })

      const paidMap = new Map(totalPaidPerLoan.map((p) => [p.loanId, p._sum.amount || 0]))
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
      }
    })
  )

  const grandTotals = stats.reduce(
    (acc, s) => ({
      customers: acc.customers + s.customerCount,
      loans: acc.loans + s.activeLoanCount,
      outstanding: acc.outstanding + s.totalOutstanding,
      todayCollection: acc.todayCollection + s.todayCollection,
    }),
    { customers: 0, loans: 0, outstanding: 0, todayCollection: 0 }
  )

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Welcome, {user.fullName}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {businesses.length} business{businesses.length !== 1 ? 'es' : ''} &middot; Select a business from the top-right dropdown to manage it
      </p>

      {/* Grand Totals */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-value">{grandTotals.customers}</div>
          <div className="stat-label">Active Customers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatPaiseShort(grandTotals.outstanding)}</div>
          <div className="stat-label">Total Outstanding</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{grandTotals.loans}</div>
          <div className="stat-label">Active Loans</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-success-600">
            {formatPaiseShort(grandTotals.todayCollection)}
          </div>
          <div className="stat-label">Today&apos;s Collection</div>
        </div>
      </div>

      {/* Business List — simple cards, click to open */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">My Businesses</h2>
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
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
              <BusinessActions businessId={business.id} businessName={business.name} />
            </div>
          </div>
        ))}

        {businesses.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-gray-500 mb-4">No businesses registered yet.</p>
            <Link href="/businesses/new" className="btn-primary">
              Register Your First Business
            </Link>
          </div>
        )}
      </div>

      {/* Register New Business */}
      {businesses.length > 0 && (
        <div className="mt-6">
          <Link href="/businesses/new" className="btn-secondary w-full">
            + Register New Business
          </Link>
        </div>
      )}
    </div>
  )
}
