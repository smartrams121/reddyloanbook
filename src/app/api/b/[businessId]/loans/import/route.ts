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
  customerId?: string
  customerPhone?: string
  loanAmount: string
  interestAmount: string
  installmentAmount: string
  numberOfInstallments: string
  startDate: string
  agentPhone?: string
  notes?: string
}

interface RowResult {
  rowNumber: number
  customerName: string
  status: 'imported' | 'skipped' | 'imported_with_warnings'
  errors: string[]
  warnings: string[]
}

interface ValidRow {
  customerId: string
  customerName: string
  loanAmountPaise: number
  interestAmountPaise: number
  installmentAmountPaise: number
  numberOfInstallments: number
  startDate: string
  agentId: string | null
  notes: string | null
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

  console.log(`[Loan Import] businessId=${businessId} rows=${loans?.length} confirm=${confirm}`)

  if (!Array.isArray(loans) || loans.length === 0) {
    return NextResponse.json({ error: 'No loan rows provided' }, { status: 400 })
  }
  if (loans.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 loans per import' }, { status: 400 })
  }

  // Filter instruction rows (loanAmount starts with REQUIRED/OPTIONAL)
  const dataRows = loans.filter(row => {
    const amt = (row.loanAmount ?? '').toString().trim()
    return !amt.startsWith('REQUIRED') && !amt.startsWith('OPTIONAL')
  })

  // Filter example rows (customerId === '__EXAMPLE__')
  const processRows = dataRows.filter(row => (row.customerId ?? '').toString().trim() !== '__EXAMPLE__')

  if (processRows.length === 0) {
    return NextResponse.json({
      error: 'The uploaded file has no loan data. Please add rows below the header and try again.',
    }, { status: 400 })
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, collectionType: true, collectionDays: true, loanSeq: true, receiptPrefix: true },
  })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  // Load all active customers for this business (by customerId and phone)
  const customers = await prisma.customer.findMany({
    where: { businessId, status: 'ACTIVE' },
    select: { id: true, customerId: true, phone: true, fullName: true },
  })
  const customerByCustomerId = new Map(customers.map(c => [c.customerId.toLowerCase(), c]))
  const customerByPhone = new Map(
    customers.filter(c => c.phone).map(c => [c.phone, c])
  )

  // Load agents
  const agents = await prisma.userBusinessAssignment.findMany({
    where: { businessId },
    include: { user: { select: { id: true, phone: true } } },
  })
  const agentByPhone = new Map(
    agents.filter(a => a.user.phone).map(a => [a.user.phone!, a.user.id])
  )

  const results: RowResult[] = []
  const validRows: ValidRow[] = []

  for (let i = 0; i < processRows.length; i++) {
    const row = processRows[i]
    const rowNum = i + 1
    const get = (col: string) => (row[col as keyof LoanRow] ?? '').toString().trim()

    const rowResult: RowResult = {
      rowNumber: rowNum,
      customerName: '',
      status: 'imported',
      errors: [],
      warnings: [],
    }

    // Customer lookup: customerId first, then customerPhone
    const customerIdRaw = get('customerId')
    const customerPhoneRaw = get('customerPhone')

    if (!customerIdRaw && !customerPhoneRaw) {
      rowResult.errors.push('Either Customer ID or Customer Phone is required')
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }

    let customer: { id: string; customerId: string; phone: string; fullName: string } | undefined

    if (customerIdRaw) {
      customer = customerByCustomerId.get(customerIdRaw.toLowerCase())
      if (!customer) {
        rowResult.errors.push(`Customer ID '${customerIdRaw}' not found or not active`)
        rowResult.status = 'skipped'
        results.push(rowResult)
        continue
      }
    } else {
      customer = customerByPhone.get(customerPhoneRaw)
      if (!customer) {
        rowResult.errors.push(`No active customer found with phone '${customerPhoneRaw}'`)
        rowResult.status = 'skipped'
        results.push(rowResult)
        continue
      }
    }

    rowResult.customerName = customer.fullName

    // loanAmount (REQUIRED, > 0)
    const loanAmountRaw = get('loanAmount')
    if (!loanAmountRaw) {
      rowResult.errors.push('Loan Amount is required')
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }
    const loanAmountPaise = toInt(loanAmountRaw)
    if (loanAmountPaise === null || loanAmountPaise <= 0) {
      rowResult.errors.push(`Loan Amount '${loanAmountRaw}' is invalid (must be a positive number)`)
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }

    // interestAmount (REQUIRED, >= 0)
    const interestRaw = get('interestAmount')
    if (interestRaw === '') {
      rowResult.errors.push('Interest Amount is required (use 0 for no interest)')
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }
    const interestAmountPaise = toInt(interestRaw)
    if (interestAmountPaise === null) {
      rowResult.errors.push(`Interest Amount '${interestRaw}' is invalid (must be 0 or a positive number)`)
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }

    // installmentAmount (REQUIRED, > 0)
    const installmentRaw = get('installmentAmount')
    if (!installmentRaw) {
      rowResult.errors.push('Installment Amount is required')
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }
    const installmentAmountPaise = toInt(installmentRaw)
    if (installmentAmountPaise === null || installmentAmountPaise <= 0) {
      rowResult.errors.push(`Installment Amount '${installmentRaw}' is invalid (must be a positive number)`)
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }

    // numberOfInstallments (REQUIRED, > 0)
    const numInstRaw = get('numberOfInstallments')
    if (!numInstRaw) {
      rowResult.errors.push('Number of Installments is required')
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }
    const numberOfInstallments = parseInt(numInstRaw)
    if (isNaN(numberOfInstallments) || numberOfInstallments <= 0) {
      rowResult.errors.push(`Number of Installments '${numInstRaw}' is invalid (must be a positive integer)`)
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }

    // startDate (REQUIRED, DD/MM/YYYY or YYYY-MM-DD)
    const startDateRaw = get('startDate')
    if (!startDateRaw) {
      rowResult.errors.push('Start Date is required')
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }
    const startDate = parseDDMMYYYY(startDateRaw)
    if (!startDate) {
      rowResult.errors.push(`Start Date '${startDateRaw}' is invalid. Use DD/MM/YYYY format (e.g. 01/10/2024)`)
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }

    // agentPhone (OPTIONAL)
    let agentId: string | null = null
    const agentPhoneRaw = get('agentPhone')
    if (agentPhoneRaw) {
      agentId = agentByPhone.get(agentPhoneRaw) || null
      if (!agentId) {
        rowResult.warnings.push(`Agent with phone '${agentPhoneRaw}' not found. Loan will be created without an agent.`)
      }
    }

    // notes (OPTIONAL)
    const notes = get('notes') || null

    if (rowResult.errors.length > 0) {
      rowResult.status = 'skipped'
    } else if (rowResult.warnings.length > 0) {
      rowResult.status = 'imported_with_warnings'
    } else {
      rowResult.status = 'imported'
    }

    results.push(rowResult)

    if (rowResult.status !== 'skipped') {
      validRows.push({
        customerId: customer.id,
        customerName: customer.fullName,
        loanAmountPaise,
        interestAmountPaise,
        installmentAmountPaise,
        numberOfInstallments,
        startDate,
        agentId,
        notes,
      })
    }
  }

  const importedCount = results.filter(r => r.status !== 'skipped').length
  const skippedCount = results.filter(r => r.status === 'skipped').length
  const warningCount = results.reduce((sum, r) => sum + r.warnings.length, 0)

  // Validation phase
  if (!confirm) {
    return NextResponse.json({
      totalRows: processRows.length,
      imported: importedCount,
      skipped: skippedCount,
      warnings: warningCount,
      results,
    })
  }

  if (validRows.length === 0) {
    return NextResponse.json({
      totalRows: processRows.length,
      imported: 0,
      skipped: skippedCount,
      warnings: warningCount,
      results,
    })
  }

  // Import phase
  try {
    await prisma.$transaction(async (tx) => {
      const biz = await tx.business.update({
        where: { id: businessId },
        data: { loanSeq: { increment: validRows.length } },
        select: { loanSeq: true, receiptPrefix: true, collectionDays: true, collectionType: true },
      })

      const baseSeq = biz.loanSeq - validRows.length
      const prefix = biz.receiptPrefix || 'L'

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
            notes: v.notes,
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
      }
    }, { timeout: 60000 })
  } catch (error) {
    console.error('[Loan Import] Transaction failed:', error)
    return NextResponse.json({
      error: `Import failed: ${(error as Error).message}`,
      totalRows: processRows.length,
      imported: 0,
      skipped: skippedCount,
      warnings: warningCount,
      results,
    }, { status: 400 })
  }

  return NextResponse.json({
    totalRows: processRows.length,
    imported: importedCount,
    skipped: skippedCount,
    warnings: warningCount,
    results,
  }, { status: 201 })
}
