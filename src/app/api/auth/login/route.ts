import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword, createSession } from '@/lib/auth'
import { loginSchema } from '@/lib/validators'
import { Role } from '@/lib/constants'

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const loginAttempts = new Map<string, { count: number; lastAttempt: Date }>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { username, password } = parsed.data

    const attempts = loginAttempts.get(username)
    if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS) {
      const elapsed = Date.now() - attempts.lastAttempt.getTime()
      if (elapsed < LOCKOUT_MINUTES * 60 * 1000) {
        const remainingMin = Math.ceil((LOCKOUT_MINUTES * 60 * 1000 - elapsed) / 60000)
        return NextResponse.json(
          { error: `Too many attempts. Try again in ${remainingMin} minutes.` },
          { status: 429 }
        )
      }
      loginAttempts.delete(username)
    }

    const user = await prisma.user.findUnique({ where: { username } })

    if (!user) {
      const regRequest = await prisma.registrationRequest.findUnique({
        where: { username },
        select: { status: true },
      })
      if (regRequest?.status === 'PENDING') {
        return NextResponse.json(
          { error: 'Your registration is pending approval by the platform admin. Please try again later.' },
          { status: 403 }
        )
      }
      if (regRequest?.status === 'REJECTED') {
        return NextResponse.json(
          { error: 'Your registration request was not approved. Please contact the platform admin for details.' },
          { status: 403 }
        )
      }
      recordAttempt(username)
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    if (!user.isActive) {
      recordAttempt(username)
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    if (user.role === Role.BUSINESS_ADMIN || user.role === Role.AGENT) {
      const assignments = await prisma.userBusinessAssignment.findMany({
        where: { userId: user.id },
        include: { business: { include: { owner: { select: { isActive: true } } } } },
      })
      const ownerActive = assignments.some((a) => a.business.owner.isActive)
      if (!ownerActive && assignments.length > 0) {
        return NextResponse.json(
          { error: 'Account is currently suspended. Contact your administrator.' },
          { status: 403 }
        )
      }
    }

    const validPassword = await verifyPassword(password, user.passwordHash)
    if (!validPassword) {
      recordAttempt(username)
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    loginAttempts.delete(username)

    const token = await createSession(user.id, user.role as Role)

    let redirectTo = '/dashboard'
    if (user.mustChangePassword) {
      redirectTo = '/change-password'
    } else if (user.role === Role.PLATFORM_ADMIN) {
      redirectTo = '/admin/owners'
    }

    const response = NextResponse.json({
      success: true,
      redirectTo,
      user: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
      },
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function recordAttempt(username: string) {
  const existing = loginAttempts.get(username)
  loginAttempts.set(username, {
    count: (existing?.count || 0) + 1,
    lastAttempt: new Date(),
  })
}
