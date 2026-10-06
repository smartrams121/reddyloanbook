import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { Role } from '@/lib/constants'

interface Props {
  params: Promise<{ requestId: string }>
}

export async function POST(request: Request, { params }: Props) {
  const { requestId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { assertPermission(user, 'manage_registration_requests') } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const regRequest = await prisma.registrationRequest.findUnique({ where: { id: requestId } })
  if (!regRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (regRequest.status !== 'PENDING') {
    return NextResponse.json({ error: 'Only pending requests can be approved' }, { status: 400 })
  }

  const existingUser = await prisma.user.findUnique({ where: { username: regRequest.username } })
  if (existingUser) {
    return NextResponse.json({ error: 'Username was taken since registration. Ask the owner to re-register.' }, { status: 409 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        fullName: regRequest.fullName,
        phone: regRequest.phone,
        email: regRequest.email,
        username: regRequest.username,
        passwordHash: regRequest.passwordHash,
        role: Role.OWNER,
        isActive: true,
        mustChangePassword: false,
        organizationName: regRequest.businessName || null,
      },
    })

    await tx.registrationRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedBy: user.id,
        reviewedAt: new Date(),
      },
    })

    return { userId: newUser.id }
  })

  return NextResponse.json({
    success: true,
    message: 'Owner approved. Account is now active. Owner can create their collections after login.',
    userId: result.userId,
  })
}
