import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess, getAccessibleVillageIds } from '@/lib/scope'
import { hasPermission } from '@/lib/permissions'
import { Role } from '@/lib/constants'
import VillageList from './VillageList'

interface Props {
  params: Promise<{ businessId: string }>
}

export default async function VillagesPage({ params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) redirect('/login')
  try { await assertBusinessAccess(user, businessId) } catch { redirect('/dashboard') }

  const accessibleIds = await getAccessibleVillageIds(user, businessId)
  const villageFilter = accessibleIds === 'all' ? {} : { id: { in: accessibleIds } }

  const villages = await prisma.village.findMany({
    where: { businessId, ...villageFilter },
    include: {
      _count: { select: { customers: true } },
      agentAssignments: {
        include: { user: { select: { id: true, fullName: true } } },
      },
    },
    orderBy: { name: 'asc' },
  })

  const canAdd = hasPermission(user.role as Role, 'add_village')
  const canEdit = hasPermission(user.role as Role, 'edit_village')

  return (
    <VillageList
      villages={villages.map((v) => ({
        id: v.id,
        name: v.name,
        isActive: v.isActive,
        customerCount: v._count.customers,
        agents: v.agentAssignments.map((a) => a.user.fullName),
      }))}
      businessId={businessId}
      canAdd={canAdd}
      canEdit={canEdit}
    />
  )
}
