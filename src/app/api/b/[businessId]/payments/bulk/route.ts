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
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  collectorId: z.string().min(1).optional(),
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
  const today = todayIST()
  const paymentDate = parsed.data.paymentDate || today
  let collector = user.id
  if (parsed.data.collectorId) {
    const assignment = await prisma.userBusinessAssignment.findFirst({
      where: { userId: parsed.data.collectorId, businessId },
    })
    if (!assignment) {
      return NextResponse.json({ error: 'Selected collector is not assigned to this business' }, { status: 400 })
    }
    collector = parsed.data.collectorId
  }

  const todayDate = new Date(today + 'T00:00:00')
  const payDate = new Date(paymentDate + 'T00:00:00')
  if (isNaN(payDate.getTime())) {
    return NextResponse.json({ error: 'Invalid payment date' }, { status: 400 })
  }
  if (payDate > todayDate) {
    return NextResponse.json({ error: 'Payment date cannot be in the future' }, { status: 400 })
  }
  const minDate = new Date(todayDate)
  minDate.setMonth(minDate.getMonth() - 1)
  if (payDate < minDate) {
    return NextResponse.json({ error: 'Payment date cannot be more than 1 month in the past' }, { status: 400 })
  }
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

      const loanStartDate = new Date(loan.startDate + 'T00:00:00')
      if (payDate < loanStartDate) {
        throw new Error(`Posting date is older than loan creation date for ${loan.loanNumber}. Please change the posting date.`)
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
          collectorId: collector,
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
