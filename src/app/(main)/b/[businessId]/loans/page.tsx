import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { deriveLoanStatus } from '@/lib/loan-status'
import Link from 'next/link'

import SearchBox from '../customers/SearchBox'
import LoanListClient from './LoanListClient'

interface Props {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ status?: string; health?: string; search?: string }>
}

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'ACTIVE', label: 'Active', activeClass: 'bg-success-600 text-white' },
  { key: 'OVERDUE', label: 'Overdue', activeClass: 'bg-red-600 text-white' },
  { key: 'DEFAULTER', label: 'Defaulter', activeClass: 'bg-red-600 text-white' },
  { key: 'COMPLETED', label: 'Completed', activeClass: 'bg-blue-600 text-white' },
]

function loanHealthColor(expectedEndDate: string, derivedStatus: string): { key: string; border: string; label: string; labelClass: string } {
  if (derivedStatus === 'COMPLETED' || derivedStatus === 'DEFAULTER') {
    return { key: '', border: '', label: '', labelClass: '' }
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(expectedEndDate + 'T00:00:00')
  const due30 = new Date(due)
  due30.setDate(due30.getDate() + 30)

  if (today <= due) {
    return { key: 'green', border: 'border-l-4 border-l-green-500', label: 'On Track', labelClass: 'bg-green-100 text-green-700' }
  }
  if (today <= due30) {
    return { key: 'amber', border: 'border-l-4 border-l-amber-500', label: 'Overdue', labelClass: 'bg-amber-100 text-amber-700' }
  }
  return { key: 'red', border: 'border-l-4 border-l-red-500', label: 'Critical', labelClass: 'bg-red-100 text-red-700' }
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

  const searchQuery = filters.search?.trim().toLowerCase()
  if (searchQuery) {
    where.OR = [
      { loanNumber: { contains: searchQuery } },
      { customer: { fullName: { contains: searchQuery } } },
      { customer: { phone: { contains: searchQuery } } },
      { customer: { customerId: { contains: searchQuery } } },
      { customer: { guarantorName: { contains: searchQuery } } },
      { agent: { fullName: { contains: searchQuery } } },
    ]
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
  const paidPerLoan = loanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { businessId, loanId: { in: loanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const paidMap = new Map(paidPerLoan.map((p) => [p.loanId, p._sum.amount || 0]))

  const loansWithDerived = loans.map((loan) => {
    const paid = paidMap.get(loan.id) || 0
    const derivedStatus = deriveLoanStatus(loan.expectedEndDate, loan.totalRepayable, paid)
    return {
      ...loan,
      derivedStatus,
      health: loanHealthColor(loan.expectedEndDate, derivedStatus),
      paid,
    }
  })

  const statusFilter = filters.status || ''
  const filteredByStatus = statusFilter
    ? loansWithDerived.filter((l) => l.derivedStatus === statusFilter)
    : loansWithDerived

  const healthFilter = filters.health || ''
  const filteredLoans = healthFilter
    ? filteredByStatus.filter((l) => l.health.key === healthFilter)
    : filteredByStatus

  const healthCounts = { green: 0, amber: 0, red: 0 }
  filteredByStatus.forEach((l) => {
    if (l.health.key === 'green') healthCounts.green++
    else if (l.health.key === 'amber') healthCounts.amber++
    else if (l.health.key === 'red') healthCounts.red++
  })

  function buildUrl(statusKey: string, healthKey: string) {
    const parts: string[] = []
    if (statusKey) parts.push(`status=${statusKey}`)
    if (healthKey) parts.push(`health=${healthKey}`)
    if (searchQuery) parts.push(`search=${encodeURIComponent(searchQuery)}`)
    return `/b/${businessId}/loans${parts.length ? '?' + parts.join('&') : ''}`
  }

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Loans</h1>
          <p className="text-sm text-gray-500">{business?.name} &middot; {filteredLoans.length} loans</p>
        </div>
        <Link href={`/b/${businessId}/loans/new`} className="btn-primary text-sm">
          + New Loan
        </Link>
      </div>

      {/* Search */}
      <SearchBox initialQuery={filters.search || ''} />

      {/* Status Filters */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key
          return (
            <Link
              key={f.key}
              href={buildUrl(f.key, healthFilter)}
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

      {/* Health Status Filter */}
      <div className="flex gap-2 mb-4 items-center">
        <span className="text-xs text-gray-500 font-medium">Health:</span>
        <Link
          href={buildUrl(statusFilter, '')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${!healthFilter ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All
        </Link>
        <Link
          href={buildUrl(statusFilter, 'green')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${healthFilter === 'green' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
        >
          On Track ({healthCounts.green})
        </Link>
        <Link
          href={buildUrl(statusFilter, 'amber')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${healthFilter === 'amber' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
        >
          Overdue ({healthCounts.amber})
        </Link>
        <Link
          href={buildUrl(statusFilter, 'red')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${healthFilter === 'red' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
        >
          Critical ({healthCounts.red})
        </Link>
      </div>

      {/* Loan List with Bulk Actions */}
      <LoanListClient
        businessId={businessId}
        loans={filteredLoans.map((loan) => ({
          id: loan.id,
          loanNumber: loan.loanNumber,
          loanAmount: loan.loanAmount,
          amountGiven: loan.amountGiven,
          totalRepayable: loan.totalRepayable,
          installmentAmount: loan.installmentAmount,
          collectionType: loan.collectionType,
          startDate: loan.startDate,
          expectedEndDate: loan.expectedEndDate,
          status: loan.derivedStatus,
          pausedAt: loan.pausedAt,
          customer: loan.customer,
          agent: loan.agent,
          health: loan.health,
          paid: loan.paid,
        }))}
      />
    </div>
  )
}
