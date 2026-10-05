import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { forgotPasswordSchema } from '@/lib/validators'
import { checkRateLimit, recordRateLimitHit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit'

const GENERIC_MESSAGE = 'If an account is found, a password reset request has been submitted. Your business owner will review it shortly.'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    const rl = checkRateLimit('forgot-password', ip, 3, 60 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = forgotPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    recordRateLimitHit('forgot-password', ip)

    const { identifier } = parsed.data
    const isPhone = /^[6-9]\d{9}$/.test(identifier)

    const user = await prisma.user.findFirst({
      where: {
        isActive: true,
        ...(isPhone ? { phone: identifier } : { username: identifier }),
      },
      select: { id: true, fullName: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ message: GENERIC_MESSAGE })
    }

    const existingPending = await prisma.passwordResetRequest.findFirst({
      where: { userId: user.id, status: 'PENDING' },
    })

    if (existingPending) {
      return NextResponse.json({ message: GENERIC_MESSAGE })
    }

    const resetRequest = await prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        ipAddress: ip,
      },
    })

    await createAuditLog({
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'PasswordResetRequest',
      entityId: resetRequest.id,
      newValues: { identifier, userId: user.id, role: user.role },
      userId: user.id,
    })

    return NextResponse.json({ message: GENERIC_MESSAGE })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
