import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createSession } from '@/lib/auth'
import { Role } from '@/lib/constants'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const { username } = await request.json()

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const token = await createSession(user.id, user.role as Role)

  let redirectTo = '/dashboard'
  if (user.role === Role.PLATFORM_ADMIN) {
    redirectTo = '/admin/owners'
  }

  const response = NextResponse.json({ success: true, redirectTo })
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  return response
}
