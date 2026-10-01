import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { createBusinessSchema } from '@/lib/validators'
import { z } from 'zod'

const requestSchema = createBusinessSchema.extend({
  agentIds: z.array(z.string()).optional(),
})

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    assertPermission(user, 'create_business')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { name, city, address, phone, receiptPrefix, collectionType, defaultCollectionDay, interestModel, collectOnSundays, villages, agentIds } = parsed.data

  const existingBiz = await prisma.business.findFirst({
    where: { ownerId: user.id, name },
  })
  if (existingBiz) {
    return NextResponse.json({ error: 'You already have a business with this name' }, { status: 409 })
  }

  if (agentIds && agentIds.length > 0) {
    const ownedBusinesses = await prisma.business.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    })
    const ownedBizIds = new Set(ownedBusinesses.map((b) => b.id))

    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds }, role: 'AGENT', isActive: true },
      include: { businessAssignments: { select: { businessId: true } } },
    })

    for (const agent of agents) {
      const assignedToOwner = agent.businessAssignments.some((a) => ownedBizIds.has(a.businessId))
      if (!assignedToOwner) {
        return NextResponse.json(
          { error: `Agent "${agent.fullName}" is not assigned to any of your businesses` },
          { status: 403 }
        )
      }
    }
  }

  const business = await prisma.$transaction(async (tx) => {
    const biz = await tx.business.create({
      data: {
        name,
        city,
        address: address || null,
        phone: phone || null,
        receiptPrefix: receiptPrefix || null,
        collectionType,
        defaultCollectionDay: defaultCollectionDay || null,
        interestModel,
        collectOnSundays,
        ownerId: user.id,
      },
    })

    if (villages.length > 0) {
      await tx.village.createMany({
        data: villages.map((vName) => ({
          name: vName,
          businessId: biz.id,
        })),
      })
    }

    if (agentIds && agentIds.length > 0) {
      await tx.userBusinessAssignment.createMany({
        data: agentIds.map((agentId: string) => ({
          userId: agentId,
          businessId: biz.id,
        })),
      })
    }

    return biz
  })

  return NextResponse.json({ id: business.id, name: business.name }, { status: 201 })
}
