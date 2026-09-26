import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { formatPaiseShort } from '@/lib/money'
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
          where: { status: { in: ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER'] } },
          select: { id: true, totalRepayable: true },
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

  const loanIds = customers.flatMap((c) => c.loans.map((l) => l.id))
  const paidPerLoan = loanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: loanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const paidMap = new Map(paidPerLoan.map((p) => [p.loanId, p._sum.amount || 0]))

  const customerData = customers.map((c) => {
    let outstanding = 0
    for (const loan of c.loans) {
      outstanding += loan.totalRepayable - (paidMap.get(loan.id) || 0)
    }
    return {
      id: c.id,
      customerId: c.customerId,
      fullName: c.fullName,
      phone: c.phone,
      status: c.status,
      activeLoanCount: c.loans.length,
      outstanding,
    }
  })

  const totalOutstanding = customerData.reduce((s, c) => s + c.outstanding, 0)
  const activeCount = customerData.filter((c) => c.status === 'ACTIVE').length

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Link href={`/b/${businessId}/villages`} className="text-primary-600 text-sm">&larr; Villages</Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{village.name}</h1>
      <p className="text-sm text-gray-500 mb-6">Village overview</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
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

      {/* Assigned Agents */}
      {agents.length > 0 && (
        <div className="card p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Assigned Agents</h2>
          <div className="flex flex-wrap gap-2">
            {agents.map((a) => (
              <div key={a.user.id} className="flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full text-sm">
                <div className="w-5 h-5 rounded-full bg-primary-200 flex items-center justify-center text-[10px] font-bold">
                  {a.user.fullName.charAt(0)}
                </div>
                <span className="font-medium">{a.user.fullName}</span>
                {!a.user.isActive && <span className="text-[10px] text-gray-400">(inactive)</span>}
              </div>
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
                c.status === 'DEFAULTER' ? 'bg-danger-50 text-danger-700' :
                'bg-gray-100 text-gray-500'
              }`}>
                {c.status}
              </span>
            </div>
          </Link>
        ))}

        {customerData.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-gray-500 mb-4">No customers in this village yet.</p>
            <Link href={`/b/${businessId}/customers/new`} className="btn-primary">
              Add First Customer
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
