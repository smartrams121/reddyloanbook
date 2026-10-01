import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { assertPermission } from '@/lib/permissions'
import { prisma } from '@/lib/db'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { assertPermission(user, 'manage_registration_requests') } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const count = await prisma.registrationRequest.count({ where: { status: 'PENDING' } })

  return NextResponse.json({ count })
}
