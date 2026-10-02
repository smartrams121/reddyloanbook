import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { assertBusinessAccess } from '@/lib/scope'
import { z } from 'zod'

const updateSettingsSchema = z.object({
  name: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  receiptPrefix: z.string().max(5).regex(/^[A-Z]*$/).optional(),
  defaultCollectionDay: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).optional().nullable(),
  collectionDays: z.string().optional(),
  gracePeriodDaily: z.number().int().min(0).max(365).optional(),
  gracePeriodWeekly: z.number().int().min(0).max(52).optional(),
  gracePeriodMonthly: z.number().int().min(0).max(12).optional(),
  ratingGoodMaxPct: z.number().int().min(0).max(100).optional(),
  ratingAverageMaxPct: z.number().int().min(0).max(200).optional(),
  whatsappTemplate: z.string().max(500).optional(),
  autoLogoutMinutes: z.number().int().min(5).max(480).optional(),
})

interface RouteParams {
  params: Promise<{ businessId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true, name: true, city: true, address: true, phone: true,
      receiptPrefix: true, collectionType: true, defaultCollectionDay: true,
      interestModel: true, collectionDays: true,
      gracePeriodDaily: true, gracePeriodWeekly: true, gracePeriodMonthly: true,
      ratingGoodMaxPct: true, ratingAverageMaxPct: true,
      whatsappTemplate: true, autoLogoutMinutes: true,
      isActive: true,
    },
  })

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  return NextResponse.json(business)
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'edit_business_settings')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const updated = await prisma.business.update({
    where: { id: businessId },
    data: parsed.data,
  })

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    city: updated.city,
  })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'deactivate_business')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    // Get all loan IDs for this business
    const loans = await tx.loan.findMany({
      where: { businessId },
      select: { id: true },
    })
    const loanIds = loans.map(l => l.id)

    // Delete in dependency order
    if (loanIds.length > 0) {
      await tx.payment.deleteMany({ where: { businessId } })
      await tx.loanScheduleEntry.deleteMany({ where: { loanId: { in: loanIds } } })
      await tx.loan.deleteMany({ where: { businessId } })
    }
    await tx.document.deleteMany({ where: { businessId } })
    await tx.customer.deleteMany({ where: { businessId } })
    await tx.cashHandover.deleteMany({ where: { businessId } })
    await tx.cashBookEntry.deleteMany({ where: { businessId } })
    await tx.expense.deleteMany({ where: { businessId } })
    await tx.expenseCategory.deleteMany({ where: { businessId } })
    await tx.holiday.deleteMany({ where: { businessId } })
    await tx.auditLog.deleteMany({ where: { businessId } })
    await tx.userVillageAssignment.deleteMany({
      where: { village: { businessId } },
    })
    await tx.userBusinessAssignment.deleteMany({ where: { businessId } })
    await tx.village.deleteMany({ where: { businessId } })
    await tx.business.delete({ where: { id: businessId } })
  })

  return NextResponse.json({ deleted: true })
}
