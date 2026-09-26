import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  return NextResponse.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    activeBusinessId: user.activeBusinessId,
    businessIds: user.businessIds,
    villageIds: user.villageIds,
  })
}
