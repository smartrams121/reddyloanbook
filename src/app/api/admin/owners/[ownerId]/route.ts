import { NextResponse } from 'next/server'
import { getSession, hashPassword, invalidateUserSessions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { z } from 'zod'
import { phoneSchema, passwordSchema, usernameSchema } from '@/lib/validators'

const updateOwnerSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: phoneSchema.optional(),
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

  assertPermission(user, 'manage_owners')

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
    isActive: owner.isActive,
    totpEnabled: owner.totpEnabled,
    createdAt: owner.createdAt,
    businesses: owner.ownedBusinesses,
  })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { ownerId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  assertPermission(user, 'manage_owners')

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
  })
  if (!owner) {
    return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
  }

  const { fullName, phone, username, isActive, resetPassword } = parsed.data
  const updateData: Record<string, unknown> = {}

  if (fullName !== undefined) updateData.fullName = fullName
  if (phone !== undefined) updateData.phone = phone
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

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { ownerId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  assertPermission(user, 'manage_owners')

  const owner = await prisma.user.findFirst({
    where: { id: ownerId, role: 'OWNER' },
    include: { ownedBusinesses: { select: { id: true, name: true } } },
  })

  if (!owner) {
    return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
  }

  if (owner.ownedBusinesses.length > 0) {
    const names = owner.ownedBusinesses.map(b => b.name).join(', ')
    return NextResponse.json(
      { error: `Cannot delete owner with active businesses: ${names}. Remove or reassign businesses first.` },
      { status: 400 }
    )
  }

  await invalidateUserSessions(ownerId)
  await prisma.user.delete({ where: { id: ownerId } })

  return NextResponse.json({ success: true })
}
