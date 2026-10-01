import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { assertBusinessAccess } from '@/lib/scope'
import { z } from 'zod'

const updateVillageSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ businessId: string; villageId: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { businessId, villageId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await assertBusinessAccess(user, businessId)
  assertPermission(user, 'edit_village')

  const body = await request.json()
  const parsed = updateVillageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const village = await prisma.village.findFirst({
    where: { id: villageId, businessId },
  })
  if (!village) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  if (parsed.data.name) {
    const duplicate = await prisma.village.findFirst({
      where: { businessId, name: parsed.data.name, id: { not: villageId } },
    })
    if (duplicate) {
      return NextResponse.json({ error: 'Location name already exists' }, { status: 409 })
    }
  }

  const updated = await prisma.village.update({
    where: { id: villageId },
    data: parsed.data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { businessId, villageId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await assertBusinessAccess(user, businessId)
  assertPermission(user, 'edit_village')

  const village = await prisma.village.findFirst({
    where: { id: villageId, businessId },
    include: { _count: { select: { customers: true } } },
  })
  if (!village) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  if (village._count.customers > 0) {
    return NextResponse.json(
      { error: `Cannot delete "${village.name}" — it has ${village._count.customers} customer(s). Move or delete them first.` },
      { status: 400 }
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.userVillageAssignment.deleteMany({ where: { villageId } })
    await tx.village.delete({ where: { id: villageId } })
  })

  return NextResponse.json({ deleted: true })
}
