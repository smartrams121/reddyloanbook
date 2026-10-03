import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { Role } from '@/lib/constants'
import { deriveLoanStatus, deriveCustomerStatus, getGracePeriod } from '@/lib/loan-status'
import Link from 'next/link'
import SearchBox from './SearchBox'
import CustomerList from './CustomerList'
import CsvBulkUpload from './CsvBulkUpload'

interface Props {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ village?: string; status?: string; search?: string }>
}

export default async function CustomersPage({ params, searchParams }: Props) {
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
    select: { name: true, gracePeriodDaily: true, gracePeriodWeekly: true, gracePeriodMonthly: true },
  })

  const where: Record<string, unknown> = { businessId }
  if (filters.village) where.villageId = filters.village

  // Agents only see customers in their assigned villages
  if (user.role === Role.AGENT) {
    const agentVillages = await prisma.userVillageAssignment.findMany({
      where: { userId: user.id, village: { businessId } },
      select: { villageId: true },
    })
    const villageIds = agentVillages.map(v => v.villageId)
    if (villageIds.length > 0) where.villageId = { in: villageIds }
  }

  const searchQuery = filters.search?.trim().toLowerCase()

  if (searchQuery) {
    where.OR = [
      { fullName: { contains: searchQuery } },
      { phone: { contains: searchQuery } },
      { altPhone: { contains: searchQuery } },
      { customerId: { contains: searchQuery } },
      { address: { contains: searchQuery } },
      { aadhaarLast4: { contains: searchQuery } },
      { guarantorName: { contains: searchQuery } },
      { guarantorPhone: { contains: searchQuery } },
      { notes: { contains: searchQuery } },
      { village: { name: { contains: searchQuery } } },
    ]
  }

  const [customersRaw, villages] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        village: { select: { id: true, name: true } },
        loans: { select: { id: true, expectedEndDate: true, totalRepayable: true, collectionType: true } },
        _count: { select: { loans: true } },
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.village.findMany({
      where: { businessId, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const allLoanIds = customersRaw.flatMap((c) => c.loans.map((l) => l.id))
  const paidSums = allLoanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: allLoanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const paidMap = new Map(paidSums.map((p) => [p.loanId, p._sum.amount || 0]))

  const customersWithStatus = customersRaw.map(c => {
    const loanStatuses = c.loans.map((l) =>
      deriveLoanStatus(l.expectedEndDate, l.totalRepayable, paidMap.get(l.id) || 0, getGracePeriod(business!, l.collectionType), l.collectionType)
    )
    return { ...c, derivedStatus: deriveCustomerStatus(loanStatuses) }
  })

  const activeStatuses = filters.status ? (filters.status as string).split(',').filter(Boolean) : []
  const customers = activeStatuses.length > 0
    ? customersWithStatus.filter(c => activeStatuses.includes(c.derivedStatus))
    : customersWithStatus

  function buildCustomerUrl(statusKey: string) {
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
    if (filters.village) parts.push(`village=${filters.village}`)
    return `/b/${businessId}/customers${parts.length ? '?' + parts.join('&') : ''}`
  }

  const isAdminOrOwner = user.role === Role.OWNER || user.role === Role.BUSINESS_ADMIN

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">{business?.name} &middot; {customers.length} customers</p>
        </div>
        {isAdminOrOwner && (
          <Link href={`/b/${businessId}/customers/new`} className="btn-primary text-sm">
            + New Customer
          </Link>
        )}
      </div>

      {/* CSV Bulk Upload */}
      {isAdminOrOwner && (
        <div className="hidden md:block">
          <CsvBulkUpload businessId={businessId} villageNames={villages.map(v => v.name)} />
        </div>
      )}

      {/* Search */}
      <SearchBox initialQuery={filters.search || ''} />

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <FilterChip href={buildCustomerUrl('')} active={activeStatuses.length === 0 && !filters.village} label="All" />
        <FilterChip href={buildCustomerUrl('ACTIVE')} active={activeStatuses.includes('ACTIVE')} label="Active" activeClass="bg-success-600 text-white" />
        <FilterChip href={buildCustomerUrl('OVERDUE')} active={activeStatuses.includes('OVERDUE')} label="Overdue" activeClass="bg-red-600 text-white" />
        <FilterChip href={buildCustomerUrl('DEFAULTER')} active={activeStatuses.includes('DEFAULTER')} label="Defaulter" activeClass="bg-red-600 text-white" />
        <FilterChip href={buildCustomerUrl('COMPLETED')} active={activeStatuses.includes('COMPLETED')} label="Completed" activeClass="bg-blue-600 text-white" />
        <FilterChip href={buildCustomerUrl('NO LOANS')} active={activeStatuses.includes('NO LOANS')} label="No Loans" activeClass="bg-gray-400 text-white" />
        {villages.map((v) => (
          <FilterChip
            key={v.id}
            href={`/b/${businessId}/customers?village=${v.id}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`}
            active={filters.village === v.id}
            label={v.name}
          />
        ))}
      </div>

      {/* Customer List */}
      <CustomerList
        customers={customers.map(c => ({
          id: c.id,
          customerId: c.customerId,
          fullName: c.fullName,
          phone: c.phone,
          status: c.derivedStatus,
          village: c.village,
          _count: c._count,
        }))}
        businessId={businessId}
        isAdminOrOwner={isAdminOrOwner}
      />
    </div>
  )
}

function FilterChip({ href, active, label, activeClass }: { href: string; active: boolean; label: string; activeClass?: string }) {
  return (
    <Link
      href={href}
      className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${active ? (activeClass || 'bg-primary-600 text-white') : 'bg-gray-100 text-gray-600'}`}
    >
      {label}
    </Link>
  )
}
