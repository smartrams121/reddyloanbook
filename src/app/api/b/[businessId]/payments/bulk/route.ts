import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess, getAccessibleVillageIds } from '@/lib/scope'
import { Role } from '@/lib/constants'
import { assertPermission } from '@/lib/permissions'
import { todayIST, parseISODate, addMonths } from '@/lib/date'
import { z } from 'zod'
import { createAuditLog } from '@/lib/audit'
import { assertRecordEditAllowed, assertPaymentDateAllowed } from '@/lib/backdate'

interface Props {
  params: Promise<{ businessId: string }>
}

const bulkPaymentSchema = z.object({
  payments: z.array(z.object({
    loanId: z.string().min(1),
    amount: z.number().int().min(0),
    existingPaymentId: z.string().min(1).optional(),
  })).min(1).max(200)
    .refine(
      (arr) => new Set(arr.map(p => p.loanId)).size === arr.length,
      { message: 'Duplicate loan IDs are not allowed in a single bulk request' }
    ),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  collectorId: z.string().min(1).optional(),
  note: z.string().optional(),
})

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
  const note = parsed.data.note || null
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
  // Agents: verify all loans are in accessible villages
  if (user.role === Role.AGENT) {
    const agentVillageIds = await getAccessibleVillageIds(user, businessId)
    if (agentVillageIds !== 'all') {
      const loanIds = entries.map(e => e.loanId)
      const loans = await prisma.loan.findMany({
        where: { id: { in: loanIds }, businessId },
        select: { id: true, customer: { select: { villageId: true } } },
      })
      for (const loan of loans) {
        if (loan.customer?.villageId && !agentVillageIds.includes(loan.customer.villageId)) {
          return NextResponse.json({ error: 'You do not have access to one or more locations' }, { status: 403 })
        }
      }
    }
  }

  const newCount = entries.filter(e => !e.existingPaymentId).length

  const results = await prisma.$transaction(async (tx) => {
    let prefix = ''
    let startSeq = 0
    if (newCount > 0) {
      const business = await tx.business.update({
        where: { id: businessId },
        data: { receiptSeq: { increment: newCount } },
        select: { receiptPrefix: true, receiptSeq: true },
      })
      prefix = business.receiptPrefix || 'REC'
      startSeq = business.receiptSeq - newCount + 1
    }

    const output: { loanId: string; receiptNumber: string; amount: number; createdAt: Date; updated?: boolean }[] = []
    const auditEntries: { entityId: string; oldValues: Record<string, unknown>; newValues: Record<string, unknown> }[] = []
    let newIndex = 0

    for (const entry of entries) {
      const { loanId, amount, existingPaymentId } = entry

      const loan = await tx.loan.findFirst({
        where: { id: loanId, businessId },
        include: { customer: { select: { fullName: true } } },
      })
      if (!loan) throw new Error(`Loan not found: ${loanId}`)

      const loanStartDate = parseISODate(loan.startDate)
      if (payDate < loanStartDate) {
        throw new Error(`Posting date is older than loan creation date for ${loan.loanNumber}. Please change the posting date.`)
      }

      const paidAgg = await tx.payment.aggregate({
        where: { loanId, isDeleted: false },
        _sum: { amount: true },
      })
      const alreadyPaid = paidAgg._sum.amount || 0

      if (existingPaymentId) {
        const existing = await tx.payment.findFirst({
          where: { id: existingPaymentId, loanId, businessId, isDeleted: false },
        })
        if (!existing) throw new Error(`Existing payment not found for loan ${loan.loanNumber}`)
        assertRecordEditAllowed(user, existing.createdAt)

        const effectiveOutstanding = loan.totalRepayable - (alreadyPaid - existing.amount)
        if (amount > effectiveOutstanding) {
          throw new Error(`Payment of ₹${(amount / 100).toLocaleString('en-IN')} exceeds outstanding ₹${(effectiveOutstanding / 100).toLocaleString('en-IN')} for loan ${loan.loanNumber}`)
        }

        const updated = await tx.payment.update({
          where: { id: existingPaymentId },
          data: { amount, collectorId: collector },
        })

        auditEntries.push({
          entityId: existingPaymentId,
          oldValues: { receipt: existing.receiptNumber, customer: loan.customer.fullName, loan: loan.loanNumber, amount: existing.amount, collectorId: existing.collectorId, paymentDate: existing.paymentDate },
          newValues: { receipt: updated.receiptNumber, customer: loan.customer.fullName, loan: loan.loanNumber, amount, collectorId: collector, paymentDate },
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

        output.push({
          loanId: updated.loanId,
          receiptNumber: updated.receiptNumber,
          amount: updated.amount,
          createdAt: updated.createdAt,
          updated: true,
        })
      } else {
        // Server-side duplicate check: if payment exists for same loan+date, update it
        const dupPayment = await tx.payment.findFirst({
          where: { loanId, paymentDate, businessId, isDeleted: false },
        })
        if (dupPayment) {
          assertRecordEditAllowed(user, dupPayment.createdAt)
          const effectiveOutstanding = loan.totalRepayable - (alreadyPaid - dupPayment.amount)
          if (amount > effectiveOutstanding) {
            throw new Error(`Payment of ₹${(amount / 100).toLocaleString('en-IN')} exceeds outstanding for loan ${loan.loanNumber}`)
          }
          const updated2 = await tx.payment.update({
            where: { id: dupPayment.id },
            data: { amount, collectorId: collector, note },
          })
          auditEntries.push({
            entityId: dupPayment.id,
            oldValues: { receipt: dupPayment.receiptNumber, customer: loan.customer.fullName, loan: loan.loanNumber, amount: dupPayment.amount, collectorId: dupPayment.collectorId, paymentDate: dupPayment.paymentDate },
            newValues: { receipt: updated2.receiptNumber, customer: loan.customer.fullName, loan: loan.loanNumber, amount, collectorId: collector, paymentDate },
          })
          const newTotal2 = alreadyPaid - dupPayment.amount + amount
          if (newTotal2 === loan.totalRepayable) {
            await tx.loan.update({ where: { id: loanId }, data: { status: 'COMPLETED', closedAt: paymentDate } })
          } else if (loan.status === 'COMPLETED') {
            await tx.loan.update({ where: { id: loanId }, data: { status: 'ACTIVE', closedAt: null } })
          }
          output.push({ loanId, receiptNumber: updated2.receiptNumber, amount: updated2.amount, createdAt: updated2.createdAt, updated: true })
          continue
        }

        const outstanding = loan.totalRepayable - alreadyPaid
        if (amount > outstanding) {
          throw new Error(`Payment of ₹${(amount / 100).toLocaleString('en-IN')} exceeds outstanding ₹${(outstanding / 100).toLocaleString('en-IN')} for loan ${loan.loanNumber}`)
        }

        const receiptNumber = `${prefix}-${String(startSeq + newIndex).padStart(5, '0')}`
        newIndex++

        const payment = await tx.payment.create({
          data: {
            receiptNumber,
            loanId,
            businessId,
            amount,
            paymentDate,
            collectorId: collector,
            note,
          },
        })

        if (alreadyPaid + amount === loan.totalRepayable) {
          await tx.loan.update({
            where: { id: loanId },
            data: { status: 'COMPLETED', closedAt: paymentDate },
          })
        }

        output.push({
          loanId: payment.loanId,
          receiptNumber: payment.receiptNumber,
          amount: payment.amount,
          createdAt: payment.createdAt,
        })
      }
    }

    return { output, auditEntries }
  })

  // Write audit logs outside transaction to avoid timeout
  const collectorIds = Array.from(new Set(
    results.auditEntries.flatMap(e => [e.oldValues.collectorId, e.newValues.collectorId]).filter(Boolean) as string[]
  ))
  const collectorNames = collectorIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: collectorIds } }, select: { id: true, fullName: true } })
    : []
  const nameMap = new Map(collectorNames.map(c => [c.id, c.fullName]))

  for (const entry of results.auditEntries) {
    const { collectorId: oldCId, ...oldRest } = entry.oldValues
    const { collectorId: newCId, ...newRest } = entry.newValues
    const old = { ...oldRest, collector: nameMap.get(oldCId as string) || '-' }
    const nw = { ...newRest, collector: nameMap.get(newCId as string) || '-' }
    await createAuditLog({ action: 'EDIT_PAYMENT', entityType: 'Payment', entityId: entry.entityId, oldValues: old, newValues: nw, userId: user.id, businessId })
  }

  return NextResponse.json(
    { count: results.output.length, totalAmount: results.output.reduce((s, r) => s + r.amount, 0), payments: results.output },
    { status: 201 }
  )
}
