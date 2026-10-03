import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { Role } from '@/lib/constants'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ businessId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { await assertBusinessAccess(user, businessId) } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  // Agents cannot view/manage other employees
  if (user.role === Role.AGENT) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true },
  })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  // Get all owner's employees (AGENT + BUSINESS_ADMIN)
  const ownerBusinesses = await prisma.business.findMany({
    where: { ownerId: business.ownerId },
    select: { id: true },
  })
  const ownerBizIds = ownerBusinesses.map(b => b.id)

  // All employees assigned to any of the owner's businesses + unassigned ones
  const assignedUsers = await prisma.userBusinessAssignment.findMany({
    where: { businessId: { in: ownerBizIds } },
    include: { user: { select: { id: true, fullName: true, username: true, phone: true, role: true, isActive: true } } },
  })

  const userMap = new Map<string, { id: string; fullName: string; username: string; phone: string | null; role: string; isActive: boolean }>()
  for (const a of assignedUsers) {
    if (a.user.role === 'AGENT' || a.user.role === 'BUSINESS_ADMIN') {
      userMap.set(a.user.id, a.user)
    }
  }

  // Also find unassigned employees
  const unassigned = await prisma.user.findMany({
    where: {
      role: { in: ['AGENT', 'BUSINESS_ADMIN'] },
      isActive: true,
      businessAssignments: { none: {} },
    },
    select: { id: true, fullName: true, username: true, phone: true, role: true, isActive: true },
  })
  for (const u of unassigned) {
    userMap.set(u.id, u)
  }

  // Get current business assignments
  const currentAssignments = await prisma.userBusinessAssignment.findMany({
    where: { businessId },
    select: { userId: true },
  })
  const assignedIds = new Set(currentAssignments.map(a => a.userId))

  // Get villages for this business
  const villages = await prisma.village.findMany({
    where: { businessId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // Get village assignments for assigned employees
  const villageAssignments = await prisma.userVillageAssignment.findMany({
    where: {
      userId: { in: Array.from(assignedIds) },
      villageId: { in: villages.map(v => v.id) },
    },
    select: { userId: true, villageId: true },
  })

  const villageAssignmentMap: Record<string, string[]> = {}
  for (const va of villageAssignments) {
    if (!villageAssignmentMap[va.userId]) villageAssignmentMap[va.userId] = []
    villageAssignmentMap[va.userId].push(va.villageId)
  }

  const employees = Array.from(userMap.values())
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map(u => ({
      ...u,
      assigned: assignedIds.has(u.id),
      villageIds: villageAssignmentMap[u.id] || [],
    }))

  return NextResponse.json({ employees, villages })
}

const toggleSchema = z.object({
  action: z.enum(['assign', 'unassign']),
  userId: z.string().min(1),
  villageIds: z.array(z.string()).optional(),
})

export async function POST(request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { await assertBusinessAccess(user, businessId) } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }
  assertPermission(user, 'edit_business_settings')

  const body = await request.json()
  const parsed = toggleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { action, userId, villageIds } = parsed.data

  if (action === 'assign') {
    // Create UserBusinessAssignment if not exists
    const existing = await prisma.userBusinessAssignment.findFirst({
      where: { userId, businessId },
    })
    if (!existing) {
      await prisma.userBusinessAssignment.create({
        data: { userId, businessId },
      })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'unassign') {
    // Remove village assignments for this business first
    const bizVillages = await prisma.village.findMany({
      where: { businessId },
      select: { id: true },
    })
    await prisma.userVillageAssignment.deleteMany({
      where: { userId, villageId: { in: bizVillages.map(v => v.id) } },
    })
    // Remove business assignment
    await prisma.userBusinessAssignment.deleteMany({
      where: { userId, businessId },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

const villageAssignSchema = z.object({
  userId: z.string().min(1),
  villageIds: z.array(z.string()),
})

export async function PATCH(request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { await assertBusinessAccess(user, businessId) } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }
  assertPermission(user, 'edit_business_settings')

  const body = await request.json()
  const parsed = villageAssignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { userId, villageIds } = parsed.data

  // Get all villages for this business
  const bizVillages = await prisma.village.findMany({
    where: { businessId },
    select: { id: true },
  })
  const bizVillageIds = new Set(bizVillages.map(v => v.id))

  // Remove all current village assignments for this user in this business
  await prisma.userVillageAssignment.deleteMany({
    where: { userId, villageId: { in: Array.from(bizVillageIds) } },
  })

  // Create new assignments
  const validVillageIds = villageIds.filter(id => bizVillageIds.has(id))
  if (validVillageIds.length > 0) {
    await prisma.userVillageAssignment.createMany({
      data: validVillageIds.map(villageId => ({ userId, villageId })),
    })
  }

  return NextResponse.json({ ok: true, villageIds: validVillageIds })
}
