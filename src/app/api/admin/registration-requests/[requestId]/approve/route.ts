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

  const hasBusiness = regRequest.businessName && regRequest.businessName.length > 0
  let businessName = regRequest.businessName

  if (hasBusiness) {
    const existingBiz = await prisma.business.findFirst({ where: { name: businessName } })
    if (existingBiz) {
      let suffix = 2
      while (await prisma.business.findFirst({ where: { name: `${regRequest.businessName} (${suffix})` } })) {
        suffix++
      }
      businessName = `${regRequest.businessName} (${suffix})`
    }
  }

  const villages: string[] = JSON.parse(regRequest.villages || '[]')

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
        mustChangePassword: true,
      },
    })

    let newBusinessId: string | null = null

    if (hasBusiness) {
      const newBusiness = await tx.business.create({
        data: {
          name: businessName,
          city: regRequest.city,
          collectionType: regRequest.collectionType,
          defaultCollectionDay: regRequest.defaultCollectionDay,
          ownerId: newUser.id,
        },
      })
      newBusinessId = newBusiness.id

      if (villages.length > 0) {
        await tx.village.createMany({
          data: villages.map((name) => ({
            name,
            businessId: newBusiness.id,
          })),
        })
      }
    }

    await tx.registrationRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedBy: user.id,
        reviewedAt: new Date(),
      },
    })

    return { userId: newUser.id, businessId: newBusinessId, businessName }
  })

  if (hasBusiness) {
    const nameChanged = businessName !== regRequest.businessName
    return NextResponse.json({
      success: true,
      message: `Owner approved. Account and business "${result.businessName}" are now active.${nameChanged ? ` (Name adjusted to avoid duplicate)` : ''}`,
      ...result,
    })
  }

  return NextResponse.json({
    success: true,
    message: 'Owner approved. Account is now active. Owner can register their business after login.',
    userId: result.userId,
  })
}
