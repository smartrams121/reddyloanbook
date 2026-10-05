import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@/lib/constants'
import BusinessTable from './BusinessTable'

export default async function OwnersPage() {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role !== Role.PLATFORM_ADMIN) redirect('/dashboard')

  const owners = await prisma.user.findMany({
    where: { role: 'OWNER' },
    include: {
      ownedBusinesses: {
        select: {
          id: true, name: true, city: true,
          _count: { select: { customers: true, loans: true, payments: true } },
        },
      },
      sessions: { select: { lastActivityAt: true }, orderBy: { lastActivityAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })

  owners.sort((a, b) => {
    const aLogin = a.sessions[0]?.lastActivityAt?.getTime() || 0
    const bLogin = b.sessions[0]?.lastActivityAt?.getTime() || 0
    return bLogin - aLogin
  })

  const rows = owners.map((o) => ({
    id: o.id,
    ownerId: o.id,
    organizationName: o.organizationName || o.ownedBusinesses[0]?.name || '-',
    ownerName: o.fullName,
    ownerUsername: o.username,
    ownerPhone: o.phone || '-',
    ownerEmail: o.email || '-',
    ownerCity: o.ownedBusinesses[0]?.city || '-',
    ownerActive: o.isActive,
    customers: o.ownedBusinesses.reduce((sum, b) => sum + b._count.customers, 0),
    loans: o.ownedBusinesses.reduce((sum, b) => sum + b._count.loans, 0),
    payments: o.ownedBusinesses.reduce((sum, b) => sum + b._count.payments, 0),
    collections: o.ownedBusinesses.length,
    createdAt: o.createdAt.toISOString(),
    lastLogin: o.sessions[0]?.lastActivityAt?.toISOString() || null,
  }))

  return <BusinessTable rows={rows} />
}
