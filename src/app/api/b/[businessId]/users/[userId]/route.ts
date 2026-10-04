import { NextResponse } from 'next/server'
import { getSession, hashPassword, invalidateUserSessions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { assertBusinessAccess } from '@/lib/scope'
import { Role } from '@/lib/constants'
import { z } from 'zod'
import { phoneSchema, passwordSchema } from '@/lib/validators'

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: phoneSchema.optional(),
  email: z.string().email().nullable().optional(),
  isActive: z.boolean().optional(),
  resetPassword: passwordSchema.optional(),
  villageIds: z.array(z.string()).optional(),
  businessIds: z.array(z.string()).min(1).optional(),
})

interface RouteParams {
  params: Promise<{ businessId: string; userId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { businessId, userId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await assertBusinessAccess(user, businessId)

  const targetUser = await prisma.user.findFirst({
    where: {
      id: userId,
      businessAssignments: { some: { businessId } },
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      username: true,
      role: true,
      isActive: true,
      businessAssignments: {
        select: { businessId: true },
      },
      villageAssignments: {
        include: { village: { select: { id: true, name: true, businessId: true } } },
      },
    },
  })

  if (!targetUser) {
    return NextResponse.json({ error: 'Employee not found in this business' }, { status: 404 })
  }

  return NextResponse.json(targetUser)
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
    return NextResponse.json({ error: 'Employee not found in this business' }, { status: 404 })
  }

  const { fullName, phone, email, isActive, resetPassword, villageIds, businessIds } = parsed.data
  const updateData: Record<string, unknown> = {}

  if (fullName !== undefined) updateData.fullName = fullName
  if (phone !== undefined) updateData.phone = phone
  if (email !== undefined) updateData.email = email

  if (isActive !== undefined) {
    assertPermission(user, 'deactivate_user')
    updateData.isActive = isActive
  }

  if (resetPassword !== undefined) {
    assertPermission(user, 'reset_user_password')
    const newPwd = resetPassword || targetUser.username
    updateData.passwordHash = await hashPassword(newPwd)
    updateData.mustChangePassword = true
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  })

  if (businessIds !== undefined && user.role === Role.OWNER) {
    const ownedBusinesses = await prisma.business.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    })
    const ownedSet = new Set(ownedBusinesses.map((b) => b.id))
    for (const bid of businessIds) {
      if (!ownedSet.has(bid)) {
        return NextResponse.json(
          { error: 'Cannot assign to a business you do not own' },
          { status: 403 }
        )
      }
    }

    await prisma.$transaction(async (tx) => {
      const currentAssignments = await tx.userBusinessAssignment.findMany({
        where: { userId },
        select: { businessId: true },
      })
      const currentBizIds = currentAssignments.map((a) => a.businessId)
      const removedBizIds = currentBizIds.filter((id) => !businessIds.includes(id))
      const addedBizIds = businessIds.filter((id) => !currentBizIds.includes(id))

      if (removedBizIds.length > 0) {
        const removedVillages = await tx.village.findMany({
          where: { businessId: { in: removedBizIds } },
          select: { id: true },
        })
        if (removedVillages.length > 0) {
          await tx.userVillageAssignment.deleteMany({
            where: { userId, villageId: { in: removedVillages.map((v) => v.id) } },
          })
        }
        for (const bid of removedBizIds) {
          await tx.loan.updateMany({
            where: { businessId: bid, agentId: userId },
            data: { agentId: null },
          })
        }
        await tx.userBusinessAssignment.deleteMany({
          where: { userId, businessId: { in: removedBizIds } },
        })
      }

      if (addedBizIds.length > 0) {
        await tx.userBusinessAssignment.createMany({
          data: addedBizIds.map((bid) => ({ userId, businessId: bid })),
        })
      }
    })
  }

  if (villageIds !== undefined) {
    assertPermission(user, 'assign_villages')

    const targetBusinessIds = businessIds !== undefined ? businessIds : [businessId]

    const targetVillages = await prisma.village.findMany({
      where: { businessId: { in: targetBusinessIds } },
      select: { id: true },
    })
    const validIds = new Set(targetVillages.map((v) => v.id))
    const filteredIds = villageIds.filter((id) => validIds.has(id))

    await prisma.userVillageAssignment.deleteMany({
      where: {
        userId,
        villageId: { in: targetVillages.map((v) => v.id) },
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
    return NextResponse.json({ error: 'Employee not found in this business' }, { status: 404 })
  }

  if (targetUser.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot delete the business owner' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.loan.updateMany({
      where: { businessId, agentId: userId },
      data: { agentId: null },
    })
    const businessVillages = await tx.village.findMany({
      where: { businessId },
      select: { id: true },
    })
    if (businessVillages.length > 0) {
      await tx.userVillageAssignment.deleteMany({
        where: { userId, villageId: { in: businessVillages.map(v => v.id) } },
      })
    }
    await tx.userBusinessAssignment.deleteMany({
      where: { userId, businessId },
    })

    const remaining = await tx.userBusinessAssignment.count({ where: { userId } })
    if (remaining === 0) {
      await tx.passwordResetRequest.deleteMany({ where: { userId } })
      await tx.auditLog.deleteMany({ where: { userId } })
      await tx.session.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
    }
  })

  await invalidateUserSessions(userId)

  return NextResponse.json({ deleted: true })
}
