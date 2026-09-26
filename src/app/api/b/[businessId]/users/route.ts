import { NextResponse } from 'next/server'
import { getSession, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { assertBusinessAccess } from '@/lib/scope'
import { createUserSchema } from '@/lib/validators'
import { Role } from '@/lib/constants'

interface RouteParams {
  params: Promise<{ businessId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await assertBusinessAccess(user, businessId)

  const assignments = await prisma.userBusinessAssignment.findMany({
    where: { businessId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          villageAssignments: {
            include: { village: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })

  const users = assignments.map((a) => ({
    ...a.user,
    villageAssignments: a.user.villageAssignments.filter(
      (va) => va.village !== null
    ),
  }))

  return NextResponse.json(users)
}

export async function POST(request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await assertBusinessAccess(user, businessId)

  const body = await request.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { fullName, phone, username, password, role, businessIds, villageIds } = parsed.data

  if (role === Role.BUSINESS_ADMIN) {
    assertPermission(user, 'create_business_admin')
  } else {
    assertPermission(user, 'create_agent')
  }

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  if (user.role === Role.OWNER) {
    const ownedBusinessIds = await prisma.business.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    })
    const ownedSet = new Set(ownedBusinessIds.map((b) => b.id))
    for (const bid of businessIds) {
      if (!ownedSet.has(bid)) {
        return NextResponse.json({ error: 'Cannot assign to a business you do not own' }, { status: 403 })
      }
    }
  }

  const passwordHash = await hashPassword(password)

  const newUser = await prisma.user.create({
    data: {
      fullName,
      phone,
      username,
      passwordHash,
      role,
      mustChangePassword: true,
      businessAssignments: {
        create: businessIds.map((bid) => ({ businessId: bid })),
      },
      villageAssignments: villageIds
        ? { create: villageIds.map((vid) => ({ villageId: vid })) }
        : undefined,
    },
  })

  return NextResponse.json(
    { id: newUser.id, username: newUser.username, fullName: newUser.fullName, role: newUser.role },
    { status: 201 }
  )
}
