import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { resolveLoanStatus, getGracePeriod } from '@/lib/loan-status'
import Link from 'next/link'

import SearchBox from '../customers/SearchBox'
import CsvBulkLoanUpload from './CsvBulkLoanUpload'
import LoanListClient from './LoanListClient'
import { Role } from '@/lib/constants'

interface Props {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ status?: string; search?: string }>
}

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'ACTIVE', label: 'Active', activeClass: 'bg-success-600 text-white' },
  { key: 'OVERDUE', label: 'Overdue', activeClass: 'bg-red-600 text-white' },
  { key: 'DEFAULTER', label: 'Defaulter', activeClass: 'bg-red-600 text-white' },
  { key: 'COMPLETED', label: 'Completed', activeClass: 'bg-blue-600 text-white' },
]


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

  const isOwnerOrAdmin = user.role === Role.OWNER || user.role === Role.BUSINESS_ADMIN

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, gracePeriodDaily: true, gracePeriodWeekly: true, gracePeriodMonthly: true, defaulterPeriodDays: true },
  })

  const where: Record<string, unknown> = { businessId }

  // Agents only see their own loans
  if (user.role === Role.AGENT) {
    where.agentId = user.id
  }

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
    const derivedStatus = resolveLoanStatus(loan, paid, getGracePeriod(business!, loan.collectionType), loan.collectionType, business!.defaulterPeriodDays)
    return {
      ...loan,
      derivedStatus,
      paid,
    }
  })

  const statusFilter = filters.status || ''
  const activeStatuses = statusFilter ? statusFilter.split(',').filter(Boolean) : []

  const filteredByStatus = activeStatuses.length > 0
    ? loansWithDerived.filter((l) => activeStatuses.includes(l.derivedStatus))
    : loansWithDerived

  const filteredLoans = filteredByStatus

  function buildUrl(statusKey: string) {
    let newStatuses: string[]
    if (!statusKey) {
      newStatuses = []
    } else if (activeStatuses.includes(statusKey)) {
      newStatuses = activeStatuses.filter(s => s !== statusKey)
    } else {
      newStatuses = [...activeStatuses, statusKey]
    }
    const parts: string[] = []
    if (newStatuses.length > 0) parts.push(`status=${newStatuses.join(',')}`)
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
        {isOwnerOrAdmin && (
          <Link href={`/b/${businessId}/loans/new`} className="btn-primary text-sm">
            + New Loan
          </Link>
        )}
      </div>

      {isOwnerOrAdmin && (
        <div className="hidden md:block mb-4">
          <CsvBulkLoanUpload businessId={businessId} />
        </div>
      )}

      {/* Search */}
      <SearchBox initialQuery={filters.search || ''} />

      {/* Status Filters */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => {
          const active = f.key === '' ? activeStatuses.length === 0 : activeStatuses.includes(f.key)
          return (
            <Link
              key={f.key}
              href={buildUrl(f.key)}
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

      {/* Loan List with Bulk Actions */}
      <LoanListClient
        businessId={businessId}
        isAdminOrOwner={isOwnerOrAdmin}
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

          paid: loan.paid,
        }))}
      />
    </div>
  )
}
