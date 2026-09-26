import { NextResponse } from 'next/server'
import { getSession, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { createOwnerSchema } from '@/lib/validators'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  assertPermission(user, 'manage_owners')

  const owners = await prisma.user.findMany({
    where: { role: 'OWNER' },
    include: {
      ownedBusinesses: {
        select: { id: true, name: true, city: true, isActive: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(owners)
}

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  assertPermission(user, 'manage_owners')

  const body = await request.json()
  const parsed = createOwnerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { fullName, phone, username, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)

  const owner = await prisma.user.create({
    data: {
      fullName,
      phone,
      username,
      passwordHash,
      role: 'OWNER',
      mustChangePassword: true,
    },
  })

  return NextResponse.json(
    { id: owner.id, username: owner.username, fullName: owner.fullName },
    { status: 201 }
  )
}
