import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess, getAccessibleVillageIds } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { todayIST, parseISODate, addMonths } from '@/lib/date'
import { Role } from '@/lib/constants'
import { z } from 'zod'
import { createAuditLog } from '@/lib/audit'
import { assertRecordEditAllowed, assertPaymentDateAllowed } from '@/lib/backdate'

interface Props {
  params: Promise<{ businessId: string }>
}

const createPaymentSchema = z.object({
  loanId: z.string().min(1),
  amount: z.number().int().min(0),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  collectorId: z.string().min(1).optional(),
  note: z.string().optional(),
  existingPaymentId: z.string().min(1).optional(),
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
  const customerId = searchParams.get('customerId')
  const date = searchParams.get('date')

  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const villageId = searchParams.get('villageId')
  const collectorId = searchParams.get('collectorId')

  const includeZeroAmount = searchParams.get('includeZeroAmount') === 'true'
  const where: Record<string, unknown> = { businessId, isDeleted: false }
  if (!includeZeroAmount) where.amount = { gt: 0 }

  if (loanId) where.loanId = loanId
  if (date) where.paymentDate = date
  if (from && to) where.paymentDate = { gte: from, lte: to }
  else if (from) where.paymentDate = { gte: from }
  if (collectorId) where.collectorId = collectorId

  const loanFilter: Record<string, unknown> = {}
  if (customerId) loanFilter.customerId = customerId
  if (villageId) loanFilter.customer = { villageId }

  // Agents see payments for loans in their assigned villages
  if (user.role === Role.AGENT) {
    const agentVillageIds = await getAccessibleVillageIds(user, businessId)
    if (agentVillageIds !== 'all') {
      loanFilter.customer = { ...((loanFilter.customer as Record<string, unknown>) || {}), villageId: { in: agentVillageIds } }
    }
  }

  if (Object.keys(loanFilter).length > 0) where.loan = loanFilter

  const payments = await prisma.payment.findMany({
    where,
    include: {
      loan: {
        select: {
          loanNumber: true, totalRepayable: true,
          customer: { select: { id: true, fullName: true, customerId: true, village: { select: { id: true, name: true } } } },
        },
      },
      collector: { select: { id: true, fullName: true } },
    },
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  })

  return NextResponse.json(payments)
}

export async function POST(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'post_payment', businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  let body
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = createPaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { loanId, amount, note, existingPaymentId } = parsed.data
  const paymentDate = parsed.data.paymentDate || todayIST()
  let collector = user.id
  if (parsed.data.collectorId) {
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true } })
    const isOwner = biz?.ownerId === parsed.data.collectorId
    if (!isOwner) {
      const assignment = await prisma.userBusinessAssignment.findFirst({
        where: { userId: parsed.data.collectorId, businessId },
        include: { user: { select: { isActive: true } } },
      })
      if (!assignment) {
        return NextResponse.json({ error: 'Selected collector is not assigned to this business' }, { status: 400 })
      }
      if (!assignment.user.isActive) {
        return NextResponse.json({ error: 'Selected collector is inactive' }, { status: 400 })
      }
    }
    collector = parsed.data.collectorId
  }

  const today = todayIST()
  const todayDate = parseISODate(today)
  const payDate = parseISODate(paymentDate)
  if (isNaN(payDate.getTime())) {
    return NextResponse.json({ error: 'Invalid payment date' }, { status: 400 })
  }
  if (payDate > todayDate) {
    return NextResponse.json({ error: 'Payment date cannot be in the future' }, { status: 400 })
  }
  try { assertPaymentDateAllowed(user, paymentDate) } catch (e) {
    return NextResponse.json({
      error: 'BACKDATING_NOT_ALLOWED',
      message: (e as Error).message,
    }, { status: 400 })
  }
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, businessId },
    include: { customer: { select: { villageId: true, fullName: true, customerId: true } } },
  })
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

  if (user.role === Role.AGENT) {
    const agentVillageIds = await getAccessibleVillageIds(user, businessId)
    if (agentVillageIds !== 'all' && loan.customer?.villageId && !agentVillageIds.includes(loan.customer.villageId)) {
      return NextResponse.json({ error: 'You do not have access to this location' }, { status: 403 })
    }
  }

  const loanStartDate = parseISODate(loan.startDate)
  if (payDate < loanStartDate) {
    return NextResponse.json({ error: 'Posting date is older than loan creation date. Please change the posting date.' }, { status: 400 })
  }

  let result
  try {
    result = await prisma.$transaction(async (tx) => {
      const paidAgg = await tx.payment.aggregate({
        where: { loanId, isDeleted: false },
        _sum: { amount: true },
      })
      const alreadyPaid = paidAgg._sum.amount || 0

      if (existingPaymentId) {
        const existing = await tx.payment.findFirst({
          where: { id: existingPaymentId, loanId, businessId, isDeleted: false },
        })
        if (!existing) throw new Error('Existing payment not found')
        assertRecordEditAllowed(user, existing.createdAt)

        const effectiveOutstanding = loan.totalRepayable - (alreadyPaid - existing.amount)
        if (amount > effectiveOutstanding) {
          throw new Error(`Payment of ₹${(amount / 100).toLocaleString('en-IN')} would exceed outstanding. Outstanding: ₹${(effectiveOutstanding / 100).toLocaleString('en-IN')}`)
        }

        const updated = await tx.payment.update({
          where: { id: existingPaymentId },
          data: { amount, collectorId: collector, note: note || null },
        })

        const newTotal = alreadyPaid - existing.amount + amount
        if (newTotal === loan.totalRepayable) {
          await tx.loan.update({
            where: { id: loanId },
            data: { status: 'COMPLETED', closedAt: paymentDate },
          })
        } else if (loan.status === 'COMPLETED') {
          await tx.loan.update({
            where: { id: loanId },
            data: { status: 'ACTIVE', closedAt: null },
          })
        }

        const [oldCollector, newCollector] = await Promise.all([
          existing.collectorId ? tx.user.findUnique({ where: { id: existing.collectorId }, select: { fullName: true } }) : null,
          collector ? tx.user.findUnique({ where: { id: collector }, select: { fullName: true } }) : null,
        ])
        await createAuditLog({
          action: 'EDIT_PAYMENT', entityType: 'Payment', entityId: existingPaymentId,
          oldValues: { receipt: existing.receiptNumber, customer: loan.customer.fullName, loan: loan.loanNumber, amount: existing.amount, collector: oldCollector?.fullName || '-', note: existing.note, paymentDate: existing.paymentDate },
          newValues: { receipt: updated.receiptNumber, customer: loan.customer.fullName, loan: loan.loanNumber, amount, collector: newCollector?.fullName || '-', note: note || null, paymentDate },
          userId: user.id, businessId,
        })
        return { id: updated.id, receiptNumber: updated.receiptNumber, amount: updated.amount, createdAt: updated.createdAt, updatedAt: updated.updatedAt, updated: true }
      }

      // Server-side duplicate check: if payment exists for same loan+date, update it
      const duplicatePayment = await tx.payment.findFirst({
        where: { loanId, paymentDate, businessId, isDeleted: false },
      })
      if (duplicatePayment) {
        assertRecordEditAllowed(user, duplicatePayment.createdAt)
        const effectiveOutstanding = loan.totalRepayable - (alreadyPaid - duplicatePayment.amount)
        if (amount > effectiveOutstanding) {
          throw new Error(`Payment of ₹${(amount / 100).toLocaleString('en-IN')} would exceed outstanding. Outstanding: ₹${(effectiveOutstanding / 100).toLocaleString('en-IN')}`)
        }
        const updated = await tx.payment.update({
          where: { id: duplicatePayment.id },
          data: { amount, collectorId: collector, note: note || null },
        })
        const [oldCol, newCol] = await Promise.all([
          duplicatePayment.collectorId ? tx.user.findUnique({ where: { id: duplicatePayment.collectorId }, select: { fullName: true } }) : null,
          collector ? tx.user.findUnique({ where: { id: collector }, select: { fullName: true } }) : null,
        ])
        await createAuditLog({
          action: 'EDIT_PAYMENT', entityType: 'Payment', entityId: duplicatePayment.id,
          oldValues: { receipt: duplicatePayment.receiptNumber, customer: loan.customer.fullName, loan: loan.loanNumber, amount: duplicatePayment.amount, collector: oldCol?.fullName || '-', note: duplicatePayment.note, paymentDate: duplicatePayment.paymentDate },
          newValues: { receipt: updated.receiptNumber, customer: loan.customer.fullName, loan: loan.loanNumber, amount, collector: newCol?.fullName || '-', note: note || null, paymentDate },
          userId: user.id, businessId,
        })
        const newTotal = alreadyPaid - duplicatePayment.amount + amount
        if (newTotal === loan.totalRepayable) {
          await tx.loan.update({ where: { id: loanId }, data: { status: 'COMPLETED', closedAt: paymentDate } })
        } else if (loan.status === 'COMPLETED') {
          await tx.loan.update({ where: { id: loanId }, data: { status: 'ACTIVE', closedAt: null } })
        }
        return { id: updated.id, receiptNumber: updated.receiptNumber, amount: updated.amount, createdAt: updated.createdAt, updatedAt: updated.updatedAt, updated: true }
      }

      const outstanding = loan.totalRepayable - alreadyPaid
      if (amount > outstanding) {
        throw new Error(`Payment of ₹${(amount / 100).toLocaleString('en-IN')} would exceed total repayable. Outstanding: ₹${(outstanding / 100).toLocaleString('en-IN')}`)
      }

      const business = await tx.business.update({
        where: { id: businessId },
        data: { receiptSeq: { increment: 1 } },
        select: { receiptPrefix: true, receiptSeq: true },
      })
      const prefix = business.receiptPrefix || 'REC'
      const receiptNumber = `${prefix}-${String(business.receiptSeq).padStart(5, '0')}`

      const payment = await tx.payment.create({
        data: {
          receiptNumber,
          loanId,
          businessId,
          amount,
          paymentDate,
          collectorId: collector,
          note: note || null,
        },
      })

      if (alreadyPaid + amount === loan.totalRepayable) {
        await tx.loan.update({
          where: { id: loanId },
          data: { status: 'COMPLETED', closedAt: paymentDate },
        })
      }

      return { id: payment.id, receiptNumber: payment.receiptNumber, amount: payment.amount, createdAt: payment.createdAt, updatedAt: payment.updatedAt }
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  return NextResponse.json(result, { status: 201 })
}
