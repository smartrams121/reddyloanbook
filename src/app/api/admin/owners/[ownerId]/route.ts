import { NextResponse } from 'next/server'
import { getSession, hashPassword, invalidateUserSessions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { z } from 'zod'
import { phoneSchema, passwordSchema, usernameSchema } from '@/lib/validators'

const updateOwnerSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: phoneSchema.optional(),
  email: z.string().email().nullable().optional(),
  username: usernameSchema.optional(),
  isActive: z.boolean().optional(),
  resetPassword: passwordSchema.optional(),
})

interface RouteParams {
  params: Promise<{ ownerId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { ownerId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { assertPermission(user, 'manage_owners') } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const owner = await prisma.user.findFirst({
    where: { id: ownerId, role: 'OWNER' },
    include: {
      ownedBusinesses: {
        select: { id: true, name: true, city: true, isActive: true, collectionType: true },
      },
    },
  })

  if (!owner) {
    return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: owner.id,
    username: owner.username,
    fullName: owner.fullName,
    phone: owner.phone,
    email: owner.email,
    isActive: owner.isActive,
    createdAt: owner.createdAt,
    businesses: owner.ownedBusinesses,
  })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { ownerId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { assertPermission(user, 'manage_owners') } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateOwnerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const owner = await prisma.user.findFirst({
    where: { id: ownerId, role: 'OWNER' },
    select: { id: true, username: true, fullName: true, email: true, phone: true, isActive: true, passwordHash: true },
  })
  if (!owner) {
    return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
  }

  const { fullName, phone, email, username, isActive, resetPassword } = parsed.data
  const updateData: Record<string, unknown> = {}

  if (fullName !== undefined) updateData.fullName = fullName
  if (phone !== undefined) updateData.phone = phone
  if (email !== undefined) updateData.email = email
  if (username !== undefined && username !== owner.username) {
    const existing = await prisma.user.findFirst({ where: { username } })
    if (existing) {
      return NextResponse.json({ error: 'Username already taken', details: { username: ['Username already taken'] } }, { status: 400 })
    }
    updateData.username = username
  }
  if (isActive !== undefined) updateData.isActive = isActive
  if (resetPassword !== undefined) {
    updateData.passwordHash = await hashPassword(resetPassword)
    updateData.mustChangePassword = true
  }

  const updated = await prisma.user.update({
    where: { id: ownerId },
    data: updateData,
  })

  if (isActive === false || resetPassword) {
    await invalidateUserSessions(ownerId)
  }

  return NextResponse.json({
    id: updated.id,
    fullName: updated.fullName,
    phone: updated.phone,
    isActive: updated.isActive,
  })
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { ownerId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { assertPermission(user, 'manage_owners') } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const url = new URL(request.url)
  const force = url.searchParams.get('force') === 'true'

  const owner = await prisma.user.findFirst({
    where: { id: ownerId, role: 'OWNER' },
    include: { ownedBusinesses: { select: { id: true, name: true, isActive: true } } },
  })

  if (!owner) {
    return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
  }

  const activeBusinesses = owner.ownedBusinesses.filter(b => b.isActive)
  if (activeBusinesses.length > 0 && !force) {
    const names = activeBusinesses.map(b => b.name).join(', ')
    return NextResponse.json(
      { error: `Cannot delete owner with active businesses: ${names}. Use force delete or deactivate them first.` },
      { status: 400 }
    )
  }

  try {
    await invalidateUserSessions(ownerId)

    // Clean up any deactivated businesses owned by this user
    for (const biz of owner.ownedBusinesses) {
      const loans = await prisma.loan.findMany({ where: { businessId: biz.id }, select: { id: true } })
      const loanIds = loans.map(l => l.id)
      if (loanIds.length > 0) {
        await prisma.payment.deleteMany({ where: { businessId: biz.id } })
        await prisma.loanScheduleEntry.deleteMany({ where: { loanId: { in: loanIds } } })
        await prisma.loan.deleteMany({ where: { businessId: biz.id } })
      }
      await prisma.document.deleteMany({ where: { businessId: biz.id } })
      await prisma.customer.deleteMany({ where: { businessId: biz.id } })
      await prisma.cashHandover.deleteMany({ where: { businessId: biz.id } })
      await prisma.cashBookEntry.deleteMany({ where: { businessId: biz.id } })
      await prisma.expense.deleteMany({ where: { businessId: biz.id } })
      await prisma.expenseCategory.deleteMany({ where: { businessId: biz.id } })
      await prisma.holiday.deleteMany({ where: { businessId: biz.id } })
      await prisma.auditLog.deleteMany({ where: { businessId: biz.id } })
      await prisma.userVillageAssignment.deleteMany({ where: { village: { businessId: biz.id } } })
      await prisma.userBusinessAssignment.deleteMany({ where: { businessId: biz.id } })
      await prisma.village.deleteMany({ where: { businessId: biz.id } })
      await prisma.business.delete({ where: { id: biz.id } })
    }

    // Clean up user-level records with FK to this user
    await prisma.auditLog.deleteMany({ where: { userId: ownerId } })
    await prisma.supportAccess.deleteMany({ where: { OR: [{ ownerId }, { adminId: ownerId }] } })

    await prisma.user.delete({ where: { id: ownerId } })

    // Free up the username by removing the old registration request
    await prisma.registrationRequest.deleteMany({ where: { username: owner.username } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Failed to delete owner:', e)
    return NextResponse.json({ error: 'Failed to delete owner. Please try again.' }, { status: 500 })
  }
}
