import { NextResponse } from 'next/server'
import { getSession, hashPassword, invalidateUserSessions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { assertBusinessAccess } from '@/lib/scope'
import { z } from 'zod'
import { phoneSchema, passwordSchema } from '@/lib/validators'

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: phoneSchema.optional(),
  isActive: z.boolean().optional(),
  resetPassword: passwordSchema.optional(),
  villageIds: z.array(z.string()).optional(),
})

interface RouteParams {
  params: Promise<{ businessId: string; userId: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { businessId, userId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await assertBusinessAccess(user, businessId)

  const body = await request.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      id: userId,
      businessAssignments: { some: { businessId } },
    },
  })
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found in this business' }, { status: 404 })
  }

  const { fullName, phone, isActive, resetPassword, villageIds } = parsed.data
  const updateData: Record<string, unknown> = {}

  if (fullName !== undefined) updateData.fullName = fullName
  if (phone !== undefined) updateData.phone = phone

  if (isActive !== undefined) {
    assertPermission(user, 'deactivate_user')
    updateData.isActive = isActive
  }

  if (resetPassword !== undefined) {
    assertPermission(user, 'reset_user_password')
    updateData.passwordHash = await hashPassword(resetPassword)
    updateData.mustChangePassword = true
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  })

  if (villageIds !== undefined) {
    assertPermission(user, 'assign_villages')

    const businessVillages = await prisma.village.findMany({
      where: { businessId },
      select: { id: true },
    })
    const validIds = new Set(businessVillages.map((v) => v.id))
    const filteredIds = villageIds.filter((id) => validIds.has(id))

    await prisma.userVillageAssignment.deleteMany({
      where: {
        userId,
        villageId: { in: businessVillages.map((v) => v.id) },
      },
    })

    if (filteredIds.length > 0) {
      await prisma.userVillageAssignment.createMany({
        data: filteredIds.map((vid) => ({ userId, villageId: vid })),
      })
    }
  }

  if (isActive === false || resetPassword) {
    await invalidateUserSessions(userId)
  }

  return NextResponse.json({
    id: updated.id,
    fullName: updated.fullName,
    isActive: updated.isActive,
  })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { businessId, userId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await assertBusinessAccess(user, businessId)
  assertPermission(user, 'deactivate_user')

  const targetUser = await prisma.user.findFirst({
    where: {
      id: userId,
      businessAssignments: { some: { businessId } },
    },
    select: { id: true, fullName: true, role: true },
  })
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found in this business' }, { status: 404 })
  }

  if (targetUser.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot delete the business owner' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    // Unassign loans assigned to this agent in this business
    await tx.loan.updateMany({
      where: { businessId, agentId: userId },
      data: { agentId: null },
    })
    // Remove village assignments for this business
    const businessVillages = await tx.village.findMany({
      where: { businessId },
      select: { id: true },
    })
    if (businessVillages.length > 0) {
      await tx.userVillageAssignment.deleteMany({
        where: { userId, villageId: { in: businessVillages.map(v => v.id) } },
      })
    }
    // Remove business assignment
    await tx.userBusinessAssignment.deleteMany({
      where: { userId, businessId },
    })
  })

  await invalidateUserSessions(userId)

  return NextResponse.json({ deleted: true })
}
