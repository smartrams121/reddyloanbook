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

  const villages = await prisma.village.findMany({
    where: {
      business: { ownerId: user.id, isActive: true },
      isActive: true,
    },
    select: { id: true, name: true, businessId: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(villages)
}
