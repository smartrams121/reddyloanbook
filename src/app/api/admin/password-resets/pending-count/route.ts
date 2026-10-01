import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertPermission } from '@/lib/permissions'
import { Role } from '@/lib/constants'

export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    assertPermission(user, 'manage_password_resets')

    const count = await prisma.passwordResetRequest.count({
      where: {
        status: 'PENDING',
        user: { role: Role.OWNER },
      },
    })

    return NextResponse.json({ count })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'PermissionError') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Pending reset count error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
