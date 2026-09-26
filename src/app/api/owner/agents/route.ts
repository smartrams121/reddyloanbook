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

  const ownedBusinessIds = await prisma.business.findMany({
    where: { ownerId: user.id, isActive: true },
    select: { id: true },
  })

  const bizIds = ownedBusinessIds.map((b) => b.id)

  const assignments = await prisma.userBusinessAssignment.findMany({
    where: { businessId: { in: bizIds } },
    include: {
      user: {
        select: { id: true, fullName: true, phone: true, role: true, isActive: true },
      },
    },
  })

  const agentMap = new Map<string, { id: string; fullName: string; phone: string | null; isActive: boolean }>()
  for (const a of assignments) {
    if (a.user.role === 'AGENT' && a.user.isActive) {
      agentMap.set(a.user.id, a.user)
    }
  }

  return NextResponse.json(Array.from(agentMap.values()))
}
