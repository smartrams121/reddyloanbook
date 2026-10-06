import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@/lib/constants'
import { z } from 'zod'

const schema = z.object({
  organizationName: z.string().min(1).max(100).optional(),
  fullName: z.string().min(1).max(100).optional(),
  phone: z.string().min(10).max(10).optional(),
  email: z.string().email().optional(),
  city: z.string().min(1).max(100).optional(),
})

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (user.role !== Role.OWNER && user.role !== Role.BUSINESS_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const targetUserId = user.role === Role.OWNER ? user.id : user.ownerId
    if (!targetUserId) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

    const { organizationName, fullName, phone, email, city } = parsed.data

    const userData: Record<string, string> = {}
    if (organizationName) userData.organizationName = organizationName
    if (fullName) userData.fullName = fullName
    if (phone) userData.phone = phone
    if (email) userData.email = email

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: targetUserId },
        data: userData,
      })
    }

    if (city) {
      const firstBusiness = await prisma.business.findFirst({
        where: { ownerId: targetUserId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (firstBusiness) {
        await prisma.business.update({
          where: { id: firstBusiness.id },
          data: { city },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Organization update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (user.role !== Role.OWNER) {
      return NextResponse.json({ error: 'Only the Owner can delete the organization' }, { status: 403 })
    }

    const activeBusinesses = await prisma.business.findMany({
      where: { ownerId: user.id, isActive: true },
      select: { id: true },
    })

    if (activeBusinesses.length > 0) {
      return NextResponse.json({
        error: `Cannot delete organization — ${activeBusinesses.length} active collection(s) exist. Delete all collections first.`,
      }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: user.id } })
      await tx.passwordResetRequest.deleteMany({ where: { userId: user.id } })
      await tx.userVillageAssignment.deleteMany({ where: { userId: user.id } })
      await tx.userBusinessAssignment.deleteMany({ where: { userId: user.id } })
      await tx.user.delete({ where: { id: user.id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Organization delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
