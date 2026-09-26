import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { todayIST } from '@/lib/date'
import { z } from 'zod'

interface Props {
  params: Promise<{ businessId: string }>
}

const ACTIVE_STATUSES = ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER', 'FROZEN']

const bulkPaymentSchema = z.object({
  payments: z.array(z.object({
    loanId: z.string().min(1),
    amount: z.number().int().positive(),
  })).min(1).max(200),
})

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
  const parsed = bulkPaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { payments: entries } = parsed.data
  const paymentDate = todayIST()
  const count = entries.length

  const results = await prisma.$transaction(async (tx) => {
    // Reserve receipt numbers in bulk
    const business = await tx.business.update({
      where: { id: businessId },
      data: { receiptSeq: { increment: count } },
      select: { receiptPrefix: true, receiptSeq: true },
    })
    const prefix = business.receiptPrefix || 'REC'
    const startSeq = business.receiptSeq - count + 1

    const created: { loanId: string; receiptNumber: string; amount: number; createdAt: Date }[] = []

    for (let i = 0; i < entries.length; i++) {
      const { loanId, amount } = entries[i]

      const loan = await tx.loan.findFirst({
        where: { id: loanId, businessId },
      })
      if (!loan) throw new Error(`Loan not found: ${loanId}`)
      if (!ACTIVE_STATUSES.includes(loan.status)) {
        throw new Error(`Loan ${loan.loanNumber} is ${loan.status.replace(/_/g, ' ').toLowerCase()} — cannot post payment`)
      }

      const paidAgg = await tx.payment.aggregate({
        where: { loanId, isDeleted: false },
        _sum: { amount: true },
      })
      const alreadyPaid = paidAgg._sum.amount || 0
      const outstanding = loan.totalRepayable - alreadyPaid
      if (amount > outstanding) {
        throw new Error(`Payment of ₹${(amount / 100).toLocaleString('en-IN')} exceeds outstanding ₹${(outstanding / 100).toLocaleString('en-IN')} for loan ${loan.loanNumber}`)
      }

      const receiptNumber = `${prefix}-${String(startSeq + i).padStart(5, '0')}`

      const payment = await tx.payment.create({
        data: {
          receiptNumber,
          loanId,
          businessId,
          amount,
          paymentDate,
          collectorId: user.id,
        },
      })

      // Auto-complete if fully paid
      if (alreadyPaid + amount === loan.totalRepayable) {
        await tx.loan.update({
          where: { id: loanId },
          data: { status: 'COMPLETED', closedAt: paymentDate },
        })
      }

      created.push({
        loanId: payment.loanId,
        receiptNumber: payment.receiptNumber,
        amount: payment.amount,
        createdAt: payment.createdAt,
      })
    }

    return created
  })

  return NextResponse.json(
    { count: results.length, totalAmount: results.reduce((s, r) => s + r.amount, 0), payments: results },
    { status: 201 }
  )
}
