import { NextResponse } from 'next/server'
import { getSession, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@/lib/constants'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ employeeId: string }>
}

const updateSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  role: z.enum(['AGENT', 'BUSINESS_ADMIN']).optional(),
})

export async function PATCH(request: Request, { params }: RouteParams) {
  const { employeeId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== Role.OWNER) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { action } = body as { action?: string }

  if (action === 'reset-password') {
    const employee = await prisma.user.findUnique({ where: { id: employeeId }, select: { username: true } })
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const passwordHash = await hashPassword(employee.username)
    await prisma.user.update({
      where: { id: employeeId },
      data: { passwordHash, mustChangePassword: true },
    })
    return NextResponse.json({ ok: true, message: `Password reset to username (${employee.username})` })
  }

  if (action === 'suspend') {
    const employee = await prisma.user.findUnique({ where: { id: employeeId }, select: { isActive: true } })
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    await prisma.user.update({
      where: { id: employeeId },
      data: { isActive: !employee.isActive },
    })
    return NextResponse.json({ ok: true, isActive: !employee.isActive })
  }

  // Default: update fields
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.fullName) data.fullName = parsed.data.fullName
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone || null
  if (parsed.data.role) data.role = parsed.data.role

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  await prisma.user.update({ where: { id: employeeId }, data })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { employeeId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== Role.OWNER) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Remove all assignments first
  await prisma.userVillageAssignment.deleteMany({ where: { userId: employeeId } })
  await prisma.userBusinessAssignment.deleteMany({ where: { userId: employeeId } })
  await prisma.user.delete({ where: { id: employeeId } })

  return NextResponse.json({ ok: true })
}
