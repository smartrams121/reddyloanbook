import { NextResponse } from 'next/server'
import { getSession, hashPassword, verifyPassword, invalidateUserSessions, createSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { passwordSchema } from '@/lib/validators'
import { Role } from '@/lib/constants'

const changePasswordSchema = z.object({
  action: z.literal('changePassword'),
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
})

const updateProfileSchema = z.object({
  action: z.literal('updateProfile'),
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().max(15).optional(),
})

const archiveBusinessSchema = z.object({
  action: z.literal('archiveBusiness'),
  businessId: z.string().min(1),
})

const updateBusinessSchema = z.object({
  action: z.literal('updateBusiness'),
  businessId: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  city: z.string().min(2).max(100).optional(),
  phone: z.string().max(15).optional(),
  address: z.string().max(500).optional(),
})

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, username: true, fullName: true, role: true, phone: true, email: true, organizationName: true },
  })

  if (!dbUser) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  let businesses: { id: string; name: string; city: string; isActive: boolean }[] = []
  if (dbUser.role === Role.OWNER) {
    businesses = await prisma.business.findMany({
      where: { ownerId: user.id },
      select: { id: true, name: true, city: true, isActive: true },
      orderBy: { name: 'asc' },
    })
  }

  return NextResponse.json({
    id: dbUser.id,
    username: dbUser.username,
    fullName: dbUser.fullName,
    role: dbUser.role,
    phone: dbUser.phone,
    email: dbUser.email,
    organizationName: dbUser.organizationName,
    businesses,
  })
}

export async function PATCH(request: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const action = body.action || 'changePassword'

  if (action === 'changePassword') {
    const parsed = changePasswordSchema.safeParse({ ...body, action })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = parsed.data

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const valid = await verifyPassword(currentPassword, dbUser.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })

    const newHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustChangePassword: false },
    })

    await invalidateUserSessions(user.id)
    const token = await createSession(user.id, user.role as Role)

    const response = NextResponse.json({ success: true })
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
    return response
  }

  if (action === 'updateProfile') {
    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const updates: Record<string, string> = {}
    if (parsed.data.fullName) updates.fullName = parsed.data.fullName
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    await prisma.user.update({ where: { id: user.id }, data: updates })
    return NextResponse.json({ success: true })
  }

  if (action === 'archiveBusiness') {
    if (user.role !== Role.OWNER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const parsed = archiveBusinessSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    }

    const business = await prisma.business.findFirst({
      where: { id: parsed.data.businessId, ownerId: user.id },
    })
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    await prisma.business.update({
      where: { id: business.id },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  }

  if (action === 'updateBusiness') {
    if (user.role !== Role.OWNER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const parsed = updateBusinessSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const business = await prisma.business.findFirst({
      where: { id: parsed.data.businessId, ownerId: user.id },
    })
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const bizUpdates: Record<string, string> = {}
    if (parsed.data.name) bizUpdates.name = parsed.data.name
    if (parsed.data.city) bizUpdates.city = parsed.data.city
    if (parsed.data.phone !== undefined) bizUpdates.phone = parsed.data.phone
    if (parsed.data.address !== undefined) bizUpdates.address = parsed.data.address

    if (Object.keys(bizUpdates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    await prisma.business.update({ where: { id: business.id }, data: bizUpdates })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
