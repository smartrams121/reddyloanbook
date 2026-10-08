import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { assertBusinessAccess } from '@/lib/scope'
import { generateSchedule } from '@/lib/schedule'
import { CollectionType, DayOfWeek } from '@/lib/constants'

interface RouteParams {
  params: Promise<{ businessId: string }>
}

interface LoanRow {
  customerPhone: string; loanAmount: string; interestAmount: string
  installmentAmount: string; numberOfInstallments: string; startDate: string
  agentPhone?: string; notes?: string
}

function parseDDMMYYYY(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const isoMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return value.trim()
  return null
}

function toInt(val: string): number | null {
  const n = parseFloat(val.replace(/,/g, ''))
  if (isNaN(n) || n < 0) return null
  return Math.round(n * 100)
}

export async function POST(request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { await assertBusinessAccess(user, businessId) } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }
  assertPermission(user, 'create_loan', businessId)

  const body = await request.json()
  const { loans, confirm } = body as { loans: LoanRow[]; confirm?: boolean }

  if (!Array.isArray(loans) || loans.length === 0) {
    return NextResponse.json({ error: 'No loan rows provided' }, { status: 400 })
  }
  if (loans.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 loans per import' }, { status: 400 })
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, collectionType: true, collectionDays: true, loanSeq: true, receiptPrefix: true },
  })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const customers = await prisma.customer.findMany({
    where: { businessId, status: 'ACTIVE' },
    select: { id: true, phone: true, fullName: true },
  })
  const customerByPhone = new Map(customers.map(c => [c.phone, c]))

  const agents = await prisma.userBusinessAssignment.findMany({
    where: { businessId },
    include: { user: { select: { id: true, phone: true } } },
  })
  const agentByPhone = new Map(
    agents.filter(a => a.user.phone).map(a => [a.user.phone!, a.user.id])
  )

  const errors: { row: number; field: string; message: string }[] = []
  const validRows: {
    row: LoanRow; customerId: string; customerName: string
    loanAmountPaise: number; interestAmountPaise: number; installmentAmountPaise: number
    numberOfInstallments: number; startDate: string; agentId: string | null; notes: string
  }[] = []

  loans.forEach((row, i) => {
    const rowNum = i + 1
    const phone = row.customerPhone?.trim()
    if (!phone) { errors.push({ row: rowNum, field: 'customerPhone', message: 'Customer phone is required' }); return }

    const customer = customerByPhone.get(phone)
    if (!customer) { errors.push({ row: rowNum, field: 'customerPhone', message: `No active customer with phone ${phone}` }); return }

    const loanAmt = toInt(row.loanAmount || '')
    if (!loanAmt || loanAmt <= 0) { errors.push({ row: rowNum, field: 'loanAmount', message: 'Invalid loan amount' }); return }

    const interest = toInt(row.interestAmount || '')
    if (interest === null || interest < 0) { errors.push({ row: rowNum, field: 'interestAmount', message: 'Invalid interest amount' }); return }

    const installment = toInt(row.installmentAmount || '')
    if (!installment || installment <= 0) { errors.push({ row: rowNum, field: 'installmentAmount', message: 'Invalid installment amount' }); return }

    const numInst = parseInt(row.numberOfInstallments || '')
    if (!numInst || numInst <= 0) { errors.push({ row: rowNum, field: 'numberOfInstallments', message: 'Invalid installment count' }); return }

    const startDate = parseDDMMYYYY(row.startDate || '')
    if (!startDate) { errors.push({ row: rowNum, field: 'startDate', message: 'Invalid date (use DD/MM/YYYY)' }); return }

    let agentId: string | null = null
    const agentPhone = row.agentPhone?.trim()
    if (agentPhone) {
      agentId = agentByPhone.get(agentPhone) || null
      if (!agentId) { errors.push({ row: rowNum, field: 'agentPhone', message: `No agent with phone ${agentPhone}` }); return }
    }

    validRows.push({
      row, customerId: customer.id, customerName: customer.fullName,
      loanAmountPaise: loanAmt, interestAmountPaise: interest,
      installmentAmountPaise: installment, numberOfInstallments: numInst,
      startDate, agentId, notes: row.notes?.trim() || '',
    })
  })

  if (!confirm) {
    return NextResponse.json({
      total: loans.length,
      validCount: validRows.length,
      errorCount: errors.length,
      errors,
    })
  }

  if (validRows.length === 0) {
    return NextResponse.json({ error: 'No valid rows to import' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const biz = await tx.business.update({
        where: { id: businessId },
        data: { loanSeq: { increment: validRows.length } },
        select: { loanSeq: true, receiptPrefix: true, collectionDays: true, collectionType: true },
      })

      const baseSeq = biz.loanSeq - validRows.length
      const prefix = biz.receiptPrefix || 'L'
      const created: { loanNumber: string; customerName: string }[] = []

      for (let i = 0; i < validRows.length; i++) {
        const v = validRows[i]
        const seq = baseSeq + i + 1
        const loanNumber = `${prefix}-L${String(seq).padStart(5, '0')}`

        const totalRepayable = v.loanAmountPaise + v.interestAmountPaise
        const lastInstallmentAmount = totalRepayable - v.installmentAmountPaise * (v.numberOfInstallments - 1)

        const collType = biz.collectionType as CollectionType
        const schedule = generateSchedule({
          startDate: v.startDate,
          numberOfInstallments: v.numberOfInstallments,
          installmentAmount: v.installmentAmountPaise,
          lastInstallmentAmount,
          collectionType: collType,
          collectionDay: DayOfWeek.SATURDAY,
          collectionDays: biz.collectionDays || 'MON,TUE,WED,THU,FRI,SAT,SUN',
          holidays: [],
        })

        const expectedEndDate = schedule.length > 0 ? schedule[schedule.length - 1].dueDate : v.startDate

        await tx.loan.create({
          data: {
            loanNumber,
            customerId: v.customerId,
            businessId,
            loanAmount: v.loanAmountPaise,
            interestAmount: v.interestAmountPaise,
            totalRepayable,
            amountGiven: v.loanAmountPaise,
            interestModel: 'ADDON',
            collectionType: biz.collectionType,
            installmentAmount: v.installmentAmountPaise,
            numberOfInstallments: v.numberOfInstallments,
            lastInstallmentAmount,
            startDate: v.startDate,
            expectedEndDate,
            agentId: v.agentId,
            notes: v.notes || null,
            status: 'ACTIVE',
            schedule: {
              create: schedule.map(s => ({
                installmentNumber: s.installmentNumber,
                dueDate: s.dueDate,
                amount: s.amount,
              })),
            },
          },
        })

        created.push({ loanNumber, customerName: v.customerName })
      }

      return { created: created.length, loans: created, errors }
    }, { timeout: 60000 })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('Loan import failed:', err)
    return NextResponse.json({ error: 'Import failed. Transaction rolled back.' }, { status: 500 })
  }
}
