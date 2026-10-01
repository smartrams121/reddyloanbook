import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { registrationSchema } from '@/lib/validators'
import { checkRateLimit, recordRateLimitHit } from '@/lib/rate-limit'

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    const { allowed, retryAfterMs } = checkRateLimit('register', ip, 3, 60 * 60 * 1000)
    if (!allowed) {
      const mins = Math.ceil((retryAfterMs || 0) / 60000)
      return NextResponse.json(
        { error: `Too many registration attempts. Try again in ${mins} minutes.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = registrationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { fullName, phone, email, username, password, businessName, city, villages, collectionType, defaultCollectionDay } = parsed.data as typeof parsed.data & { businessName?: string; city?: string; villages?: string[]; collectionType?: string; defaultCollectionDay?: string }

    const existingUser = await prisma.user.findUnique({ where: { username }, select: { id: true, isActive: true } })
    if (existingUser && existingUser.isActive) {
      return NextResponse.json({ error: 'Username is already taken. Please choose another.' }, { status: 409 })
    }

    const existingRequest = await prisma.registrationRequest.findUnique({ where: { username } })
    if (existingRequest && existingRequest.status === 'PENDING') {
      return NextResponse.json({ error: 'A registration with this username is already pending.' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)

    recordRateLimitHit('register', ip)

    try {
      await prisma.registrationRequest.create({
        data: {
          fullName,
          phone,
          email: email || null,
          username,
          passwordHash,
          businessName: businessName || '',
          city: city || '',
          villages: JSON.stringify(villages || []),
          collectionType: collectionType || 'DAILY',
          defaultCollectionDay: collectionType === 'WEEKLY' ? defaultCollectionDay : null,
        },
      })
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
        return NextResponse.json({ error: 'Username was just taken. Please choose another.' }, { status: 409 })
      }
      throw e
    }

    return NextResponse.json({ success: true, message: 'Registration submitted successfully' }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
