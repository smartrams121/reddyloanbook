import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@/lib/constants'
import Link from 'next/link'
import OwnerActions from './OwnerActions'

export default async function OwnersPage() {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role !== Role.PLATFORM_ADMIN) redirect('/dashboard')

  const owners = await prisma.user.findMany({
    where: { role: 'OWNER' },
    include: {
      ownedBusinesses: {
        select: {
          id: true, name: true, city: true, isActive: true,
          _count: { select: { customers: true, loans: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Owners</h1>
          <p className="text-sm text-gray-500">{owners.length} registered owner(s)</p>
        </div>
        <Link href="/admin/owners/new" className="btn-primary btn-sm">
          + New Owner
        </Link>
      </div>

      <div className="space-y-3">
        {owners.map((owner) => (
          <div key={owner.id} className="card p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900">{owner.fullName}</h3>
                <p className="text-xs text-gray-500">@{owner.username} &middot; {owner.phone || 'No phone'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  owner.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {owner.isActive ? 'Active' : 'Suspended'}
                </span>
                <OwnerActions ownerId={owner.id} isActive={owner.isActive} ownerName={owner.fullName} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-xs text-gray-400">
                {owner.ownedBusinesses.length} collection{owner.ownedBusinesses.length !== 1 ? 's' : ''}
                {' | '}
                {owner.ownedBusinesses.reduce((sum, b) => sum + b._count.customers, 0)} customers
                {' | '}
                {owner.ownedBusinesses.reduce((sum, b) => sum + b._count.loans, 0)} loans
              </span>
            </div>
          </div>
        ))}

        {owners.length === 0 && (
          <div className="card p-8 text-center text-gray-400">
            No owners registered yet. Click &quot;+ New Owner&quot; to create one.
          </div>
        )}
      </div>
    </div>
  )
}
