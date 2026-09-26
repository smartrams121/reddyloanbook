import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { formatPaiseShort } from '@/lib/money'
import { formatDateDisplay } from '@/lib/date'
import Link from 'next/link'

interface Props {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ status?: string }>
}

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'ACTIVE', label: 'Active', activeClass: 'bg-success-600 text-white' },
  { key: 'COMPLETED', label: 'Completed', activeClass: 'bg-primary-600 text-white' },
  { key: 'FROZEN', label: 'Frozen', activeClass: 'bg-warning-600 text-white' },
  { key: 'INACTIVE', label: 'Inactive', activeClass: 'bg-gray-600 text-white' },
  { key: 'DEFAULTER', label: 'Defaulter', activeClass: 'bg-danger-600 text-white' },
]

const ACTIVE_STATUSES = ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER']

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'bg-success-50 text-success-700'
    case 'OVERDUE':
    case 'IN_GRACE': return 'bg-warning-50 text-warning-700'
    case 'DEFAULTER': return 'bg-danger-50 text-danger-700'
    case 'FROZEN': return 'bg-blue-50 text-blue-700'
    case 'INACTIVE': return 'bg-gray-100 text-gray-500'
    case 'COMPLETED':
    case 'COMPLETED_RENEWED':
    case 'SETTLED': return 'bg-primary-50 text-primary-700'
    case 'WRITTEN_OFF': return 'bg-red-50 text-red-700'
    default: return 'bg-gray-100 text-gray-500'
  }
}

export default async function LoansPage({ params, searchParams }: Props) {
  const { businessId } = await params
  const filters = await searchParams
  const user = await getSession()
  if (!user) redirect('/login')

  try {
    await assertBusinessAccess(user, businessId)
  } catch {
    redirect('/dashboard')
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  })

  const where: Record<string, unknown> = { businessId }
  if (filters.status === 'ACTIVE') {
    where.status = { in: ACTIVE_STATUSES }
  } else if (filters.status) {
    where.status = filters.status
  }

  const loans = await prisma.loan.findMany({
    where,
    include: {
      customer: { select: { id: true, fullName: true, customerId: true, phone: true } },
      agent: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const loanIds = loans.map((l) => l.id)
  const paidPerLoan = await prisma.payment.groupBy({
    by: ['loanId'],
    where: { businessId, loanId: { in: loanIds }, isDeleted: false },
    _sum: { amount: true },
  })
  const paidMap = new Map(paidPerLoan.map((p) => [p.loanId, p._sum.amount || 0]))

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Loans</h1>
          <p className="text-sm text-gray-500">{business?.name} &middot; {loans.length} loans</p>
        </div>
        <Link href={`/b/${businessId}/loans/new`} className="btn-primary text-sm">
          + New Loan
        </Link>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => {
          const active = (filters.status || '') === f.key
          return (
            <Link
              key={f.key}
              href={`/b/${businessId}/loans${f.key ? `?status=${f.key}` : ''}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                active
                  ? (f.activeClass || 'bg-primary-600 text-white')
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {/* Loan List */}
      <div className="space-y-2">
        {loans.map((loan) => {
          const paid = paidMap.get(loan.id) || 0
          const outstanding = loan.totalRepayable - paid
          const progress = loan.totalRepayable > 0 ? Math.round((paid / loan.totalRepayable) * 100) : 0

          return (
            <Link
              key={loan.id}
              href={`/b/${businessId}/customers/${loan.customer.id}`}
              className="card p-3 block hover:border-primary-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{loan.customer.fullName}</p>
                  <p className="text-xs text-gray-500">
                    {loan.loanNumber} &middot; {loan.customer.phone}
                    {loan.agent ? ` &middot; ${loan.agent.fullName}` : ''}
                  </p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${statusBadgeClass(loan.status)}`}>
                  {loan.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>Lent: {formatPaiseShort(loan.amountGiven)}</span>
                <span>Repayable: {formatPaiseShort(loan.totalRepayable)}</span>
                <span>Due: {formatPaiseShort(outstanding)}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${progress >= 100 ? 'bg-success-500' : 'bg-primary-500'}`}
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">{progress}%</span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1.5">
                <span>{loan.collectionType} &middot; {formatPaiseShort(loan.installmentAmount)}/inst</span>
                <span>Started {formatDateDisplay(loan.startDate)}</span>
              </div>
            </Link>
          )
        })}

        {loans.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-gray-500 mb-4">No loans found.</p>
            <Link href={`/b/${businessId}/loans/new`} className="btn-primary">
              Create First Loan
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
