import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkRateLimit, recordRateLimitHit } from '@/lib/rate-limit'

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = checkRateLimit('check-username', ip, 20, 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')?.trim().toLowerCase()

  if (!username || username.length < 4 || !/^[a-zA-Z0-9._]+$/.test(username)) {
    return NextResponse.json({ available: false })
  }

  recordRateLimitHit('check-username', ip)

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findUnique({ where: { username }, select: { id: true, isActive: true } }),
    prisma.registrationRequest.findUnique({ where: { username }, select: { status: true } }),
  ])

  const taken = (!!existingUser && existingUser.isActive) || (existingRequest?.status === 'PENDING')

  return NextResponse.json({ available: !taken })
}
