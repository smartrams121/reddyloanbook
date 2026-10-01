import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertPermission } from '@/lib/permissions'
import { Role } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    assertPermission(user, 'manage_password_resets')

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined

    const where: Record<string, unknown> = {
      user: { role: Role.OWNER },
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
    console.error('List password resets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
