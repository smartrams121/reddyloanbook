import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertPermission } from '@/lib/permissions'
import { Role } from '@/lib/constants'

export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    assertPermission(user, 'manage_employee_password_resets')

    const ownerBusinesses = await prisma.business.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    })
    const businessIds = ownerBusinesses.map((b) => b.id)

    if (businessIds.length === 0) {
      return NextResponse.json({ count: 0 })
    }

    const employeeUsers = await prisma.userBusinessAssignment.findMany({
      where: { businessId: { in: businessIds } },
      select: { userId: true },
    })
    const employeeUserIds = Array.from(new Set(employeeUsers.map((e) => e.userId)))

    if (employeeUserIds.length === 0) {
      return NextResponse.json({ count: 0 })
    }

    const count = await prisma.passwordResetRequest.count({
      where: {
        status: 'PENDING',
        userId: { in: employeeUserIds },
        user: { role: { in: [Role.BUSINESS_ADMIN, Role.AGENT] } },
      },
    })

    return NextResponse.json({ count })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'PermissionError') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Pending employee reset count error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
