import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { Role } from '@/lib/constants'
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
    select: { name: true },
  })

  const where: Record<string, unknown> = { businessId }
  if (filters.village) where.villageId = filters.village
  if (filters.status) where.status = filters.status

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

  const [customers, villages] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        village: { select: { id: true, name: true } },
        _count: { select: { loans: true } },
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.village.findMany({
      where: { businessId, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ])

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
        <CsvBulkUpload businessId={businessId} villageNames={villages.map(v => v.name)} />
      )}

      {/* Search */}
      <SearchBox initialQuery={filters.search || ''} />

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <FilterChip href={`/b/${businessId}/customers${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`} active={!filters.status && !filters.village} label="All" />
        <FilterChip href={`/b/${businessId}/customers?status=ACTIVE${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`} active={filters.status === 'ACTIVE'} label="Active" activeClass="bg-success-600 text-white" />
        <FilterChip href={`/b/${businessId}/customers?status=CLOSED${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`} active={filters.status === 'CLOSED'} label="Closed" activeClass="bg-gray-600 text-white" />
        <FilterChip href={`/b/${businessId}/customers?status=DEFAULTER${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`} active={filters.status === 'DEFAULTER'} label="Defaulter" activeClass="bg-danger-600 text-white" />
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
          status: c.status,
          village: c.village,
          _count: c._count,
        }))}
        villages={villages.map(v => ({ id: v.id, name: v.name }))}
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
