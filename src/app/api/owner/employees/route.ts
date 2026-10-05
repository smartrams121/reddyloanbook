import { NextResponse } from 'next/server'
import { getSession, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@/lib/constants'
import { z } from 'zod'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== Role.OWNER) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ownedBusinessIds = await prisma.business.findMany({
    where: { ownerId: user.id },
    select: { id: true, name: true },
  })
  const bizIds = ownedBusinessIds.map(b => b.id)
  const bizNameMap = new Map(ownedBusinessIds.map(b => [b.id, b.name]))

  const assignments = await prisma.userBusinessAssignment.findMany({
    where: { businessId: { in: bizIds } },
    include: {
      user: {
        select: { id: true, fullName: true, username: true, phone: true, role: true, isActive: true, createdAt: true },
      },
    },
  })

  const employeeMap = new Map<string, {
    id: string; fullName: string; username: string; phone: string | null
    role: string; isActive: boolean; createdAt: Date; businesses: string[]
  }>()

  for (const a of assignments) {
    if (a.user.role === Role.OWNER) continue
    const existing = employeeMap.get(a.user.id)
    if (existing) {
      existing.businesses.push(bizNameMap.get(a.businessId) || '')
    } else {
      employeeMap.set(a.user.id, {
        ...a.user,
        businesses: [bizNameMap.get(a.businessId) || ''],
      })
    }
  }

  // Also include unassigned employees created by this owner (no business assignment yet)
  const allCreatedUsers = await prisma.user.findMany({
    where: {
      role: { in: ['AGENT', 'BUSINESS_ADMIN'] },
      id: { notIn: Array.from(employeeMap.keys()) },
    },
    select: { id: true, fullName: true, username: true, phone: true, role: true, isActive: true, createdAt: true },
  })

  // Filter to only users that are NOT assigned to any other owner's businesses
  for (const u of allCreatedUsers) {
    const otherAssignments = await prisma.userBusinessAssignment.findFirst({
      where: { userId: u.id },
    })
    if (!otherAssignments) {
      employeeMap.set(u.id, { ...u, businesses: [] })
    }
  }

  const employees = Array.from(employeeMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName))

  const ownerUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, fullName: true, username: true, phone: true },
  })

  return NextResponse.json({ owner: ownerUser, employees })
}

const createEmployeeSchema = z.object({
  fullName: z.string().min(2),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  phone: z.string().optional(),
  role: z.enum(['AGENT', 'BUSINESS_ADMIN']),
  password: z.string().min(4),
})

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== Role.OWNER) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = createEmployeeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { fullName, username, phone, role, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const newUser = await prisma.user.create({
    data: {
      fullName,
      username,
      phone: phone || null,
      role,
      passwordHash,
      isActive: true,
      mustChangePassword: true,
    },
  })

  return NextResponse.json({ id: newUser.id, fullName: newUser.fullName, username: newUser.username }, { status: 201 })
}
