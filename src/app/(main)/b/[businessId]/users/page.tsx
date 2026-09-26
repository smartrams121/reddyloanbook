import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { hasPermission } from '@/lib/permissions'
import { Role } from '@/lib/constants'
import Link from 'next/link'
import UserActions from './UserActions'

interface Props {
  params: Promise<{ businessId: string }>
}

export default async function UsersPage({ params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) redirect('/login')
  try { await assertBusinessAccess(user, businessId) } catch { redirect('/dashboard') }

  const canCreateAdmin = hasPermission(user.role as Role, 'create_business_admin')
  const canCreateAgent = hasPermission(user.role as Role, 'create_agent')
  const canManage = canCreateAdmin || canCreateAgent

  const assignments = await prisma.userBusinessAssignment.findMany({
    where: { businessId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          villageAssignments: {
            where: { village: { businessId } },
            include: { village: { select: { name: true } } },
          },
        },
      },
    },
  })

  const users = assignments.map((a) => a.user)

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">Users</h1>
        {canManage && (
          <Link href={`/b/${businessId}/users/new`} className="btn-primary btn-sm">
            + Add User
          </Link>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">{users.length} user(s) in this business</p>

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className={`card p-4 ${!u.isActive ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="font-semibold text-gray-900">{u.fullName}</h3>
                <p className="text-xs text-gray-500">@{u.username} &middot; {u.phone || 'No phone'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  u.role === 'BUSINESS_ADMIN'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {u.role === 'BUSINESS_ADMIN' ? 'Admin' : 'Agent'}
                </span>
                {!u.isActive && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    Inactive
                  </span>
                )}
                {canManage && (
                  <UserActions
                    userId={u.id}
                    businessId={businessId}
                    isActive={u.isActive}
                    userName={u.fullName}
                  />
                )}
              </div>
            </div>
            {u.role === 'AGENT' && u.villageAssignments.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {u.villageAssignments.map((va) => (
                  <span key={va.village.name} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {va.village.name}
                  </span>
                ))}
              </div>
            )}
            {u.role === 'AGENT' && u.villageAssignments.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No villages assigned</p>
            )}
          </div>
        ))}

        {users.length === 0 && (
          <div className="card p-8 text-center text-gray-400">
            No users assigned to this business yet.
          </div>
        )}
      </div>
    </div>
  )
}
