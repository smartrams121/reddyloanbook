import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { z } from 'zod'
import { todayIST, parseISODate, addDays, addWeeks, addMonths, formatDateISO } from '@/lib/date'

interface Props {
  params: Promise<{ businessId: string; loanId: string }>
}

const updateLoanSchema = z.object({

  // Editable fields
  loanAmount: z.number().int().positive().optional(),
  interestAmount: z.number().int().min(0).optional(),
  interestModel: z.enum(['ADDON', 'UPFRONT']).optional(),
  collectionType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  collectionDay: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).optional().nullable(),
  installmentAmount: z.number().int().positive().optional(),
  numberOfInstallments: z.number().int().positive().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  agentId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  statusOverride: z.enum(['ACTIVE', 'OVERDUE', 'DEFAULTER', 'COMPLETED']).optional().nullable(),
  documents: z.array(z.object({
    filePath: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
  })).optional(),
})


export async function GET(request: Request, { params }: Props) {
  const { businessId, loanId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, businessId },
    include: {
      customer: { select: { id: true, fullName: true, customerId: true, phone: true, villageId: true } },
      agent: { select: { id: true, fullName: true } },
      documents: { select: { id: true, filePath: true, originalName: true, mimeType: true } },
      schedule: { orderBy: { installmentNumber: 'asc' } },
    },
  })

  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

  return NextResponse.json(loan)
}

export async function PATCH(request: Request, { params }: Props) {
  const { businessId, loanId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'edit_loan', businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const loan = await prisma.loan.findFirst({ where: { id: loanId, businessId } })
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })


  const body = await request.json()
  const parsed = updateLoanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const d = parsed.data
  const data: Record<string, unknown> = {}

  // Agent validation
  if (d.agentId !== undefined) {
    if (d.agentId) {
      const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true } })
      const isOwner = biz?.ownerId === d.agentId
      if (!isOwner) {
        const agent = await prisma.userBusinessAssignment.findFirst({
          where: { userId: d.agentId, businessId },
        })
        if (!agent) return NextResponse.json({ error: 'Agent not assigned to this business' }, { status: 400 })
      }
    }
    data.agentId = d.agentId || null
  }

  if (d.notes !== undefined) data.notes = d.notes || null

  if (d.statusOverride !== undefined) {
    if (d.statusOverride === null) {
      data.statusOverride = null
      data.statusOverrideDate = null
    } else if (d.statusOverride === 'ACTIVE') {
      data.statusOverride = 'ACTIVE'
      data.statusOverrideDate = todayIST()
    } else {
      data.statusOverride = d.statusOverride
      data.statusOverrideDate = null
    }
  }

  // Amount / schedule fields — recalculate if any changed
  const hasAmountChanges = d.loanAmount !== undefined || d.interestAmount !== undefined ||
    d.interestModel !== undefined || d.installmentAmount !== undefined || d.numberOfInstallments !== undefined ||
    d.collectionType !== undefined || d.collectionDay !== undefined || d.startDate !== undefined

  if (hasAmountChanges) {
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const loanAmount = d.loanAmount ?? loan.loanAmount
    const interestAmount = d.interestAmount ?? loan.interestAmount
    const interestModel = d.interestModel ?? (loan as Record<string, unknown>).interestModel ?? 'ADDON'
    const installmentAmount = d.installmentAmount ?? loan.installmentAmount
    const numberOfInstallments = d.numberOfInstallments ?? loan.numberOfInstallments
    const collectionType = d.collectionType ?? loan.collectionType
    const collectionDay = d.collectionDay !== undefined ? d.collectionDay : loan.collectionDay
    const startDate = d.startDate ?? loan.startDate

    const totalRepayable = loanAmount + interestAmount
    const amountGiven = loanAmount
    const lastInstallmentAmount = totalRepayable - installmentAmount * (numberOfInstallments - 1)

    if (lastInstallmentAmount <= 0) {
      return NextResponse.json({ error: 'Last installment would be zero or negative. Adjust amounts.' }, { status: 400 })
    }

    // Regenerate schedule
    const DAY_CODE_TO_JS: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
    const activeDays = new Set((business.collectionDays || 'MON,TUE,WED,THU,FRI,SAT,SUN').split(',').map(d => DAY_CODE_TO_JS[d.trim()]).filter(d => d !== undefined))

    const schedule: { installmentNumber: number; dueDate: string; amount: number }[] = []
    let currentDate = parseISODate(startDate)
    if (collectionType === 'DAILY') {
      currentDate = addDays(currentDate, 1)
    }

    for (let i = 1; i <= numberOfInstallments; i++) {
      while (!activeDays.has(currentDate.getDay())) {
        currentDate = addDays(currentDate, 1)
      }
      const amt = i === numberOfInstallments ? lastInstallmentAmount : installmentAmount
      schedule.push({ installmentNumber: i, dueDate: formatDateISO(currentDate), amount: amt })

      if (i < numberOfInstallments) {
        if (collectionType === 'DAILY') currentDate = addDays(currentDate, 1)
        else if (collectionType === 'WEEKLY') currentDate = addWeeks(currentDate, 1)
        else currentDate = addMonths(currentDate, 1)
      }
    }

    const expectedEndDate = schedule[schedule.length - 1].dueDate

    data.loanAmount = loanAmount
    data.interestAmount = interestAmount
    data.interestModel = interestModel
    data.totalRepayable = totalRepayable
    data.amountGiven = amountGiven
    data.installmentAmount = installmentAmount
    data.numberOfInstallments = numberOfInstallments
    data.lastInstallmentAmount = lastInstallmentAmount
    data.collectionType = collectionType
    data.collectionDay = collectionDay || null
    data.startDate = startDate
    data.expectedEndDate = expectedEndDate

    // Transaction: update loan + replace schedule + documents
    const updated = await prisma.$transaction(async (tx) => {
      await tx.loanScheduleEntry.deleteMany({ where: { loanId } })
      if (d.documents !== undefined) {
        await tx.document.deleteMany({ where: { loanId } })
      }
      const updatedLoan = await tx.loan.update({
        where: { id: loanId },
        data: {
          ...data,
          schedule: { create: schedule },
          ...(d.documents !== undefined && d.documents.length > 0 ? {
            documents: { create: d.documents.map(doc => ({ ...doc, type: 'LOAN_DOC', businessId })) },
          } : {}),
        },
      })
      return updatedLoan
    })

    return NextResponse.json({ id: updated.id, status: updated.status, loanNumber: updated.loanNumber })
  }

  // Handle documents separately if no amount changes
  if (d.documents !== undefined) {
    await prisma.document.deleteMany({ where: { loanId } })
    if (d.documents.length > 0) {
      await prisma.document.createMany({
        data: d.documents.map(doc => ({ ...doc, type: 'LOAN_DOC', loanId, businessId })),
      })
    }
  }

  // Simple update (status/agent/notes only)
  if (Object.keys(data).length === 0 && d.documents === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  if (Object.keys(data).length > 0) {
    await prisma.loan.update({ where: { id: loanId }, data })
  }
  return NextResponse.json({ id: loanId, status: 'updated' })
}
