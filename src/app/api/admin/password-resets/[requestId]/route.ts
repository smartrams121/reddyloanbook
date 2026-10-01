import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertPermission } from '@/lib/permissions'
import { Role } from '@/lib/constants'

export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    assertPermission(user, 'manage_password_resets')

    const resetRequest = await prisma.passwordResetRequest.findUnique({
      where: { id: params.requestId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            phone: true,
            role: true,
            isActive: true,
          },
        },
      },
    })

    if (!resetRequest || resetRequest.user.role !== Role.OWNER) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(resetRequest)
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'PermissionError') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get password reset error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
