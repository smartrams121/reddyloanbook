import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { Role } from '@/lib/constants'

interface Props {
  params: Promise<{ businessId: string }>
}

export async function GET(request: NextRequest, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  if (user.role === Role.AGENT) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const action = searchParams.get('action')
  const entityType = searchParams.get('entityType')

  const where: Record<string, unknown> = { businessId }
  if (from && to) {
    where.createdAt = { gte: new Date(`${from}T00:00:00+05:30`), lte: new Date(`${to}T23:59:59+05:30`) }
  } else if (from) {
    where.createdAt = { gte: new Date(`${from}T00:00:00+05:30`) }
  }
  if (action) where.action = action
  if (entityType) where.entityType = entityType

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { fullName: true, username: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  return NextResponse.json(logs.map(l => ({
    id: l.id,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    oldValues: l.oldValues ? JSON.parse(l.oldValues) : null,
    newValues: l.newValues ? JSON.parse(l.newValues) : null,
    reason: l.reason,
    user: l.user,
    createdAt: l.createdAt.toISOString(),
  })))
}
