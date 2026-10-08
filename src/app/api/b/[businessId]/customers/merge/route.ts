import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ businessId: string }>
}

const mergeSchema = z.object({
  masterId: z.string().min(1),
  duplicateIds: z.array(z.string().min(1)).min(1),
})

export async function POST(request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'delete_customer', businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = mergeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { masterId, duplicateIds } = parsed.data

  if (duplicateIds.includes(masterId)) {
    return NextResponse.json({ error: 'Master cannot be in duplicate list' }, { status: 400 })
  }

  const master = await prisma.customer.findFirst({
    where: { id: masterId, businessId },
    select: { id: true, fullName: true, customerId: true },
  })
  if (!master) {
    return NextResponse.json({ error: 'Master customer not found' }, { status: 404 })
  }

  const duplicates = await prisma.customer.findMany({
    where: { id: { in: duplicateIds }, businessId },
    select: {
      id: true, fullName: true, customerId: true,
      _count: { select: { loans: true, documents: true } },
    },
  })

  if (duplicates.length !== duplicateIds.length) {
    return NextResponse.json({ error: 'Some duplicate customers not found' }, { status: 404 })
  }

  const result = await prisma.$transaction(async (tx) => {
    let loansMoved = 0
    let docsMoved = 0

    for (const dup of duplicates) {
      const movedLoans = await tx.loan.updateMany({
        where: { customerId: dup.id, businessId },
        data: { customerId: masterId },
      })
      loansMoved += movedLoans.count

      const movedDocs = await tx.document.updateMany({
        where: { customerId: dup.id, businessId },
        data: { customerId: masterId },
      })
      docsMoved += movedDocs.count

      await tx.customer.delete({ where: { id: dup.id } })
    }

    return { loansMoved, docsMoved, duplicatesDeleted: duplicates.length }
  })

  await createAuditLog({
    action: 'CUSTOMER_MERGE',
    entityType: 'Customer',
    entityId: masterId,
    newValues: {
      master: { id: masterId, name: master.fullName, customerId: master.customerId },
      merged: duplicates.map(d => ({ id: d.id, name: d.fullName, customerId: d.customerId })),
      loansMoved: result.loansMoved,
      docsMoved: result.docsMoved,
    },
    userId: user.id,
    businessId,
  })

  return NextResponse.json({
    success: true,
    master: master.customerId,
    ...result,
  })
}
