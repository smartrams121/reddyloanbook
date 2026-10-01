import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertPermission } from '@/lib/permissions'
import { Role } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    assertPermission(user, 'manage_employee_password_resets')

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined

    const ownerBusinesses = await prisma.business.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    })
    const businessIds = ownerBusinesses.map((b) => b.id)

    if (businessIds.length === 0) {
      return NextResponse.json([])
    }

    const employeeUsers = await prisma.userBusinessAssignment.findMany({
      where: { businessId: { in: businessIds } },
      select: { userId: true },
    })
    const employeeUserIds = Array.from(new Set(employeeUsers.map((e) => e.userId)))

    if (employeeUserIds.length === 0) {
      return NextResponse.json([])
    }

    const where: Record<string, unknown> = {
      userId: { in: employeeUserIds },
      user: {
        role: { in: [Role.BUSINESS_ADMIN, Role.AGENT] },
      },
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.user = {
        ...where.user as object,
        OR: [
          { fullName: { contains: search } },
          { username: { contains: search } },
          { phone: { contains: search } },
        ],
      }
    }

    const requests = await prisma.passwordResetRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            phone: true,
            role: true,
            isActive: true,
            businessAssignments: {
              where: { businessId: { in: businessIds } },
              include: { business: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(requests)
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'PermissionError') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('List employee password resets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
