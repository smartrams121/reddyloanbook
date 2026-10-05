import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { Role } from '@/lib/constants'
import Link from 'next/link'

interface Props {
  params: Promise<{ businessId: string }>
}

export default async function MorePage({ params }: Props) {
  const { businessId } = await params
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

  const isAdminOrOwner = user.role === Role.OWNER || user.role === Role.BUSINESS_ADMIN

  const menuItems = [
    { href: `/b/${businessId}/dashboard`, label: 'Dashboard', icon: '📊', show: true },
    { href: `/b/${businessId}/villages`, label: 'Locations', icon: '🏘️', show: true },
    { href: `/b/${businessId}/customers`, label: 'All Customers', icon: '👥', show: true },
    { href: `/b/${businessId}/customers/new`, label: 'New Customer', icon: '➕', show: isAdminOrOwner },
    { href: `/b/${businessId}/posting`, label: 'New Payment', icon: '💰', show: true },
    { href: `/b/${businessId}/posting/bulk`, label: 'Bulk Posting', icon: '📋', show: true },
    { href: `/b/${businessId}/reports`, label: 'Reports', icon: '📑', show: isAdminOrOwner },
    { href: `/b/${businessId}/employees`, label: 'Manage Employees', icon: '👤', show: isAdminOrOwner },
    { href: `/b/${businessId}/settings`, label: 'Settings', icon: '⚙️', show: isAdminOrOwner },
  ]

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">{business?.name || 'Menu'}</h1>
      <p className="text-sm text-gray-500 mb-6">All features</p>

      <div className="space-y-1">
        {menuItems
          .filter((item) => item.show)
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm font-medium text-gray-900">{item.label}</span>
            </Link>
          ))}
      </div>

      {user.businessIds.length > 1 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <Link
            href="/select-business"
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <span className="text-xl">🔄</span>
            <span className="text-sm font-medium text-gray-900">Switch Business</span>
          </Link>
        </div>
      )}
    </div>
  )
}
