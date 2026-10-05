import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, hashPassword } from '@/lib/auth'
import { assertPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { Role } from '@/lib/constants'

export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    assertPermission(user, 'manage_password_resets')

    const resetRequest = await prisma.passwordResetRequest.findUnique({
      where: { id: params.requestId },
      include: { user: { select: { id: true, role: true, fullName: true, username: true, email: true } } },
    })

    if (!resetRequest || resetRequest.user.role !== Role.OWNER) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (resetRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'This request has already been processed' }, { status: 400 })
    }

    const newPassword = resetRequest.user.username
    const passwordHash = await hashPassword(newPassword)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRequest.userId },
        data: { passwordHash, mustChangePassword: true },
      }),
      prisma.session.deleteMany({
        where: { userId: resetRequest.userId },
      }),
      prisma.passwordResetRequest.update({
        where: { id: params.requestId },
        data: {
          status: 'COMPLETED',
          resolvedBy: user.id,
          resolvedAt: new Date(),
        },
      }),
    ])

    await createAuditLog({
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: resetRequest.userId,
      newValues: { resetRequestId: params.requestId, resetBy: user.id },
      userId: user.id,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'PermissionError') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
