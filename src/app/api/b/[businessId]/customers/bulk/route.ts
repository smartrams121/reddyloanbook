import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { z } from 'zod'

interface Props {
  params: Promise<{ businessId: string }>
}

const bulkEditSchema = z.object({
  customerIds: z.array(z.string().min(1)).min(1).max(500),
  action: z.enum(['changeStatus', 'changeVillage']),
  status: z.enum(['ACTIVE', 'CLOSED', 'DEFAULTER']).optional(),
  villageId: z.string().min(1).optional(),
})

const bulkDeleteSchema = z.object({
  customerIds: z.array(z.string().min(1)).min(1).max(500),
})

export async function PATCH(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'edit_customer')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = bulkEditSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { customerIds, action, status, villageId } = parsed.data

  if (action === 'changeStatus') {
    if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 })
    const result = await prisma.customer.updateMany({
      where: { id: { in: customerIds }, businessId },
      data: { status },
    })
    return NextResponse.json({ updated: result.count })
  }

  if (action === 'changeVillage') {
    if (!villageId) return NextResponse.json({ error: 'villageId is required' }, { status: 400 })
    const village = await prisma.village.findFirst({
      where: { id: villageId, businessId, isActive: true },
    })
    if (!village) return NextResponse.json({ error: 'Village not found' }, { status: 400 })

    const result = await prisma.customer.updateMany({
      where: { id: { in: customerIds }, businessId },
      data: { villageId },
    })
    return NextResponse.json({ updated: result.count })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function DELETE(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'delete_customer')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = bulkDeleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { customerIds } = parsed.data

  // Check for customers with active loans
  const withActiveLoans = await prisma.customer.findMany({
    where: {
      id: { in: customerIds },
      businessId,
      loans: { some: { status: { in: ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER', 'FROZEN'] } } },
    },
    select: { id: true, fullName: true },
  })

  if (withActiveLoans.length > 0) {
    const names = withActiveLoans.map(c => c.fullName).join(', ')
    return NextResponse.json(
      { error: `Cannot delete customers with active loans: ${names}` },
      { status: 400 }
    )
  }

  // Delete documents first (FK constraint), then customers
  await prisma.$transaction(async (tx) => {
    await tx.document.deleteMany({
      where: { customerId: { in: customerIds }, customer: { businessId } },
    })
    // Delete payments on their loans
    const loans = await tx.loan.findMany({
      where: { customerId: { in: customerIds }, businessId },
      select: { id: true },
    })
    const loanIds = loans.map(l => l.id)
    if (loanIds.length > 0) {
      await tx.payment.deleteMany({ where: { loanId: { in: loanIds } } })
      await tx.loan.deleteMany({ where: { id: { in: loanIds } } })
    }
    await tx.customer.deleteMany({
      where: { id: { in: customerIds }, businessId },
    })
  })

  return NextResponse.json({ deleted: customerIds.length })
}
