import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess, getAccessibleVillageIds } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { Role } from '@/lib/constants'
import { createLoanSchema } from '@/lib/validators'
import { parseISODate, addDays, addWeeks, addMonths, formatDateISO } from '@/lib/date'

interface Props {
  params: Promise<{ businessId: string }>
}

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
  const status = searchParams.get('status')
  const customerId = searchParams.get('customerId')
  const activeOnDate = searchParams.get('activeOnDate')

  const where: Record<string, unknown> = { businessId }

  // Agents see loans in their assigned villages
  if (user.role === Role.AGENT) {
    const agentVillageIds = await getAccessibleVillageIds(user, businessId)
    if (agentVillageIds !== 'all') {
      where.customer = { villageId: { in: agentVillageIds } }
    }
  }

  if (status) where.status = status
  if (customerId) where.customerId = customerId
  if (activeOnDate) {
    where.startDate = { lte: activeOnDate }
    where.status = { not: 'COMPLETED' }
  }

  const loans = await prisma.loan.findMany({
    where,
    select: {
      id: true, loanNumber: true, loanAmount: true, totalRepayable: true,
      installmentAmount: true, numberOfInstallments: true, status: true,
      startDate: true, expectedEndDate: true, collectionType: true,
      amountGiven: true, interestAmount: true, pausedAt: true,
      customer: { select: { id: true, fullName: true, customerId: true, phone: true, village: { select: { name: true } } } },
      agent: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(loans)
}

export async function POST(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'create_loan', businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createLoanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const {
    customerId, loanAmount, interestAmount, interestModel, collectionType, collectionDay,
    installmentAmount, numberOfInstallments, startDate, agentId, notes, renewFromLoanId,
    loanNumber: requestedLoanNumber,
    documents,
  } = parsed.data

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
  })
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 400 })
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, collectionDays: true, loanSeq: true, receiptPrefix: true, loanIdFormat: true, loanIdPrefix: true, loanIdPadding: true, loanIdStart: true, loanIdMax: true },
  })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  if (agentId) {
    const isBusinessOwner = business.ownerId === agentId
    if (!isBusinessOwner) {
      const agent = await prisma.userBusinessAssignment.findFirst({
        where: { userId: agentId, businessId },
      })
      if (!agent) {
        return NextResponse.json({ error: 'Agent not assigned to this business' }, { status: 400 })
      }
    }
  }

  const totalRepayable = loanAmount + interestAmount
  const amountGiven = loanAmount
  const lastInstallmentAmount = totalRepayable - installmentAmount * (numberOfInstallments - 1)

  // Generate schedule
  const DAY_CODE_TO_JS: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
  const activeDays = new Set((business.collectionDays || 'MON,TUE,WED,THU,FRI,SAT,SUN').split(',').map(d => DAY_CODE_TO_JS[d.trim()]).filter(d => d !== undefined))

  const schedule: { installmentNumber: number; dueDate: string; amount: number }[] = []
  let currentDate = parseISODate(startDate)
  if (collectionType === 'DAILY') {
    currentDate = addDays(currentDate, 1)
  }

  for (let i = 1; i <= numberOfInstallments; i++) {
    // Skip days not in collectionDays
    while (!activeDays.has(currentDate.getDay())) {
      currentDate = addDays(currentDate, 1)
    }

    const amt = i === numberOfInstallments ? lastInstallmentAmount : installmentAmount
    schedule.push({
      installmentNumber: i,
      dueDate: formatDateISO(currentDate),
      amount: amt,
    })

    // Advance to next due date
    if (i < numberOfInstallments) {
      if (collectionType === 'DAILY') {
        currentDate = addDays(currentDate, 1)
      } else if (collectionType === 'WEEKLY') {
        currentDate = addWeeks(currentDate, 1)
      } else {
        currentDate = addMonths(currentDate, 1)
      }
    }
  }

  const expectedEndDate = schedule[schedule.length - 1].dueDate

  const { generateId: genId, getLoanIdConfig } = require('@/lib/id-generator')
  const loanConfig = getLoanIdConfig(business)
  let seq = Math.max(business.loanSeq + 1, loanConfig.start)
  let loanNumber: string

  if (requestedLoanNumber) {
    loanNumber = requestedLoanNumber
    const exists = await prisma.loan.findFirst({ where: { businessId, loanNumber } })
    if (exists) return NextResponse.json({ error: `Loan number "${loanNumber}" already exists` }, { status: 409 })
    const numPart = parseInt(loanNumber.replace(/\D/g, ''))
    if (!isNaN(numPart) && numPart >= seq) seq = numPart
  } else {
    loanNumber = genId(loanConfig, seq)
  }

  let loan
  try {
    loan = await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: businessId },
        data: { loanSeq: seq },
      })

      if (renewFromLoanId) {
        await tx.loan.update({
          where: { id: renewFromLoanId },
          data: { status: 'COMPLETED', closedAt: startDate },
        })
      }

      const newLoan = await tx.loan.create({
        data: {
          loanNumber,
          customerId,
          businessId,
          loanAmount,
          interestAmount,
          totalRepayable,
          amountGiven,
          interestModel,
          collectionType,
          collectionDay: collectionDay || null,
          installmentAmount,
          numberOfInstallments,
          lastInstallmentAmount,
          startDate,
          expectedEndDate,
          agentId: agentId || null,
          renewedFromLoanId: renewFromLoanId || null,
          notes: notes || null,
          schedule: {
            create: schedule,
          },
        },
      })

      if (documents && documents.length > 0) {
        await tx.document.createMany({
          data: documents.map((d) => ({
            loanId: newLoan.id,
            customerId,
            businessId,
            type: 'LOAN_PROOF',
            filePath: d.filePath,
            originalName: d.originalName,
            mimeType: d.mimeType,
          })),
        })
      }

      return newLoan
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  return NextResponse.json(
    { id: loan.id, loanNumber: loan.loanNumber, totalRepayable: loan.totalRepayable },
    { status: 201 }
  )
}
