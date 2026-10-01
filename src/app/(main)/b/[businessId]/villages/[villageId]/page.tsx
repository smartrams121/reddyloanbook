import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { formatPaiseShort } from '@/lib/money'
import { deriveLoanStatus, deriveCustomerStatus } from '@/lib/loan-status'
import Link from 'next/link'

interface Props {
  params: Promise<{ businessId: string; villageId: string }>
}

export default async function VillageDetailPage({ params }: Props) {
  const { businessId, villageId } = await params
  const user = await getSession()
  if (!user) redirect('/login')

  try {
    await assertBusinessAccess(user, businessId)
  } catch {
    redirect('/dashboard')
  }

  const village = await prisma.village.findFirst({
    where: { id: villageId, businessId },
  })

  if (!village) redirect(`/b/${businessId}/villages`)

  const [customers, agents] = await Promise.all([
    prisma.customer.findMany({
      where: { villageId, businessId },
      include: {
        loans: {
          select: { id: true, totalRepayable: true, amountGiven: true, expectedEndDate: true },
        },
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.userVillageAssignment.findMany({
      where: { villageId },
      include: {
        user: { select: { id: true, fullName: true, phone: true, isActive: true } },
      },
    }),
  ])

  const allLoanIds = customers.flatMap((c) => c.loans.map((l) => l.id))
  const paidPerLoan = allLoanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: allLoanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const paidMap = new Map(paidPerLoan.map((p) => [p.loanId, p._sum.amount || 0]))

  const customerData = customers.map((c) => {
    const loanStatuses = c.loans.map((l) =>
      deriveLoanStatus(l.expectedEndDate, l.totalRepayable, paidMap.get(l.id) || 0)
    )
    const activeLoans = c.loans.filter((_, i) => loanStatuses[i] === 'ACTIVE' || loanStatuses[i] === 'OVERDUE')
    let outstanding = 0
    for (const loan of activeLoans) {
      outstanding += loan.totalRepayable - (paidMap.get(loan.id) || 0)
    }
    return {
      id: c.id,
      customerId: c.customerId,
      fullName: c.fullName,
      phone: c.phone,
      status: deriveCustomerStatus(loanStatuses),
      activeLoanCount: activeLoans.length,
      outstanding,
    }
  })

  const totalOutstanding = customerData.reduce((s, c) => s + c.outstanding, 0)
  const activeCount = customerData.filter((c) => c.status === 'ACTIVE' || c.status === 'OVERDUE').length
  const activeLoansAll = customers.flatMap((c, ci) =>
    c.loans.filter((_, li) => {
      const s = deriveLoanStatus(c.loans[li].expectedEndDate, c.loans[li].totalRepayable, paidMap.get(c.loans[li].id) || 0)
      return s === 'ACTIVE' || s === 'OVERDUE'
    })
  )
  const totalDisbursed = activeLoansAll.reduce((s, l) => s + l.amountGiven, 0)
  const totalCollected = activeLoansAll.reduce((s, l) => s + (paidMap.get(l.id) || 0), 0)

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Link href={`/b/${businessId}/villages`} className="text-primary-600 text-sm">&larr; Locations</Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{village.name}</h1>
      <p className="text-sm text-gray-500 mb-6">Location overview</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="stat-card">
          <div className="stat-value">{customerData.length}</div>
          <div className="stat-label">Total Customers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatPaiseShort(totalOutstanding)}</div>
          <div className="stat-label">Outstanding</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-value text-primary-600">{formatPaiseShort(totalDisbursed)}</div>
          <div className="stat-label">Loan Disbursed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-success-600">{formatPaiseShort(totalCollected)}</div>
          <div className="stat-label">Loan Collected</div>
        </div>
      </div>

      {/* Assigned Agents */}
      {agents.length > 0 && (
        <div className="card p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Assigned Agents</h2>
          <div className="flex flex-wrap gap-2">
            {agents.map((a) => (
              <Link key={a.user.id} href={`/b/${businessId}/users/${a.user.id}`} className="flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full text-sm hover:bg-primary-100 transition-colors">
                <div className="w-5 h-5 rounded-full bg-primary-200 flex items-center justify-center text-[10px] font-bold">
                  {a.user.fullName.charAt(0)}
                </div>
                <span className="font-medium">{a.user.fullName}</span>
                {!a.user.isActive && <span className="text-[10px] text-gray-400">(inactive)</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Customer List */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Customers</h2>
        <Link href={`/b/${businessId}/customers/new`} className="text-sm text-primary-600 font-medium">
          + Add Customer
        </Link>
      </div>

      <div className="space-y-2">
        {customerData.map((c) => (
          <Link
            key={c.id}
            href={`/b/${businessId}/customers/${c.id}`}
            className="card p-3 flex items-center justify-between hover:border-primary-300 transition-colors block"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-sm font-bold shrink-0">
                {c.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{c.fullName}</p>
                <p className="text-xs text-gray-500">{c.customerId} &middot; {c.phone}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-sm font-semibold ${c.outstanding > 0 ? 'text-warning-600' : 'text-success-600'}`}>
                {formatPaiseShort(c.outstanding)}
              </div>
              <div className="text-[10px] text-gray-400">
                {c.activeLoanCount} active loan{c.activeLoanCount !== 1 ? 's' : ''}
              </div>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                c.status === 'ACTIVE' ? 'bg-success-50 text-success-700' :
                c.status === 'OVERDUE' ? 'bg-red-50 text-red-700' :
                c.status === 'DEFAULTER' ? 'bg-red-50 text-red-700' :
                c.status === 'COMPLETED' ? 'bg-blue-50 text-blue-700' :
                c.status === 'NO LOANS' ? 'bg-gray-100 text-gray-400' :
                'bg-gray-100 text-gray-500'
              }`}>
                {c.status}
              </span>
            </div>
          </Link>
        ))}

        {customerData.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-gray-500 mb-4">No customers in this location yet.</p>
            <Link href={`/b/${businessId}/customers/new`} className="btn-primary">
              Add First Customer
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
