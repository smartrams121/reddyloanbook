import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { assertBusinessAccess, getAccessibleVillageIds } from '@/lib/scope'
import { z } from 'zod'

const createVillageSchema = z.object({
  name: z.string().min(2, 'Village name must be at least 2 characters').max(100),
})

interface RouteParams {
  params: Promise<{ businessId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await assertBusinessAccess(user, businessId)

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

  return NextResponse.json(villages)
}

export async function POST(request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await assertBusinessAccess(user, businessId)
  assertPermission(user, 'add_village')

  const body = await request.json()
  const parsed = createVillageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const existing = await prisma.village.findFirst({
    where: { businessId, name: parsed.data.name },
  })
  if (existing) {
    return NextResponse.json({ error: 'Village name already exists in this business' }, { status: 409 })
  }

  const village = await prisma.village.create({
    data: { name: parsed.data.name, businessId },
  })

  return NextResponse.json(village, { status: 201 })
}
