import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@/lib/constants'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.role !== Role.OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const businesses = await prisma.business.findMany({
    where: { ownerId: user.id, isActive: true },
    select: { id: true, name: true, city: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(businesses)
}
