import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { nextReceiptNumber } from '@/lib/receipt'
import { todayIST } from '@/lib/date'
import { z } from 'zod'

interface Props {
  params: Promise<{ businessId: string }>
}

const createPaymentSchema = z.object({
  loanId: z.string().min(1),
  amount: z.number().int().positive(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().optional(),
})

export async function GET(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const loanId = searchParams.get('loanId')
  const date = searchParams.get('date')

  const where: Record<string, unknown> = { businessId, isDeleted: false }
  if (loanId) where.loanId = loanId
  if (date) where.paymentDate = date

  const payments = await prisma.payment.findMany({
    where,
    include: {
      loan: { select: { loanNumber: true, customer: { select: { fullName: true, customerId: true } } } },
      collector: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(payments)
}

export async function POST(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'post_payment')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createPaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { loanId, amount, note } = parsed.data
  const paymentDate = parsed.data.paymentDate || todayIST()

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, businessId },
  })
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

  if (['COMPLETED', 'COMPLETED_RENEWED', 'SETTLED', 'WRITTEN_OFF', 'INACTIVE'].includes(loan.status)) {
    return NextResponse.json({ error: `Cannot post payment to a ${loan.status.replace(/_/g, ' ').toLowerCase()} loan` }, { status: 400 })
  }

  // Check total paid so far
  const paidAgg = await prisma.payment.aggregate({
    where: { loanId, isDeleted: false },
    _sum: { amount: true },
  })
  const totalPaid = (paidAgg._sum.amount || 0) + amount
  if (totalPaid > loan.totalRepayable) {
    return NextResponse.json(
      { error: `Payment of ₹${(amount / 100).toLocaleString('en-IN')} would exceed total repayable. Outstanding: ₹${((loan.totalRepayable - (paidAgg._sum.amount || 0)) / 100).toLocaleString('en-IN')}` },
      { status: 400 }
    )
  }

  const receiptNumber = await nextReceiptNumber(businessId)

  const payment = await prisma.payment.create({
    data: {
      receiptNumber,
      loanId,
      businessId,
      amount,
      paymentDate,
      collectorId: user.id,
      note: note || null,
    },
  })

  // Auto-complete loan if fully paid
  if (totalPaid === loan.totalRepayable) {
    await prisma.loan.update({
      where: { id: loanId },
      data: { status: 'COMPLETED', closedAt: paymentDate },
    })
  }

  return NextResponse.json(
    { id: payment.id, receiptNumber: payment.receiptNumber, amount: payment.amount, createdAt: payment.createdAt, updatedAt: payment.updatedAt },
    { status: 201 }
  )
}
