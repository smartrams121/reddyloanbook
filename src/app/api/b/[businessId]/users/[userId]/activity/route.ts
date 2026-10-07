import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'

interface RouteParams {
  params: Promise<{ businessId: string; userId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { businessId, userId } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(session, businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true } })
  const isBusinessOwner = biz?.ownerId === userId

  const targetUser = await prisma.user.findFirst({
    where: { id: userId, ...(isBusinessOwner ? {} : { businessAssignments: { some: { businessId } } }) },
    select: {
      id: true, fullName: true, phone: true, role: true, isActive: true,
      villageAssignments: {
        where: { village: { businessId } },
        include: { village: { select: { id: true, name: true } } },
      },
    },
  })
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const villageId = searchParams.get('villageId')
  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 })

  const paymentWhere: Record<string, unknown> = {
    collectorId: userId,
    businessId,
    isDeleted: false,
    paymentDate: { gte: from, lte: to },
  }
  if (villageId) {
    paymentWhere.loan = { customer: { villageId } }
  }

  const loanWhere: Record<string, unknown> = {
    agentId: userId,
    businessId,
    startDate: { gte: from, lte: to },
  }
  if (villageId) {
    loanWhere.customer = { villageId }
  }

  const [payments, loans] = await Promise.all([
    prisma.payment.findMany({
      where: paymentWhere,
      include: {
        loan: {
          select: {
            loanNumber: true,
            customer: { select: { id: true, fullName: true, customerId: true } },
          },
        },
      },
      orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.loan.findMany({
      where: loanWhere,
      select: {
        id: true, loanNumber: true, amountGiven: true, totalRepayable: true,
        startDate: true, status: true, collectionType: true,
        customer: { select: { id: true, fullName: true, customerId: true } },
      },
      orderBy: { startDate: 'asc' },
    }),
  ])

  const totalCollected = payments.reduce((s, p) => s + p.amount, 0)
  const totalDisbursed = loans.reduce((s, l) => s + l.amountGiven, 0)

  return NextResponse.json({
    user: {
      id: targetUser.id,
      fullName: targetUser.fullName,
      phone: targetUser.phone,
      role: targetUser.role,
      isActive: targetUser.isActive,
      villages: targetUser.villageAssignments.map(a => a.village),
    },
    collections: {
      payments,
      totalCount: payments.length,
      totalAmount: totalCollected,
    },
    disbursements: {
      loans,
      totalCount: loans.length,
      totalAmount: totalDisbursed,
    },
  })
}
