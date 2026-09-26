import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  if (token) {
    const payload = verifyToken(token)
    if (payload) {
      await prisma.session.delete({ where: { id: payload.sessionId } }).catch(() => {})
    }
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('auth-token', '', { maxAge: 0, path: '/' })
  return response
}
