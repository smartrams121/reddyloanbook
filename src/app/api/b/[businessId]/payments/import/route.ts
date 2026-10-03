import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { assertBusinessAccess } from '@/lib/scope'
import { todayIST } from '@/lib/date'

interface RouteParams {
  params: Promise<{ businessId: string }>
}

interface PaymentRow {
  loanNumber: string; amount: string; paymentDate: string
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
  assertPermission(user, 'post_payment')

  const body = await request.json()
  const { payments, confirm } = body as { payments: PaymentRow[]; confirm?: boolean }

  if (!Array.isArray(payments) || payments.length === 0) {
    return NextResponse.json({ error: 'No payment rows provided' }, { status: 400 })
  }
  if (payments.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 payments per import' }, { status: 400 })
  }

  const today = todayIST()

  const activeLoans = await prisma.loan.findMany({
    where: { businessId, status: { in: ['ACTIVE', 'OVERDUE'] } },
    select: { id: true, loanNumber: true, totalRepayable: true, startDate: true },
  })
  const loanByNumber = new Map(activeLoans.map(l => [l.loanNumber.toUpperCase(), l]))

  const loanIds = activeLoans.map(l => l.id)
  const paidSums = loanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { businessId, loanId: { in: loanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const paidMap = new Map(paidSums.map(p => [p.loanId, p._sum.amount || 0]))

  const errors: { row: number; field: string; message: string }[] = []
  const validRows: {
    loanId: string; loanNumber: string; amountPaise: number; paymentDate: string
  }[] = []

  payments.forEach((row, i) => {
    const rowNum = i + 1
    const loanNum = row.loanNumber?.trim()
    if (!loanNum) { errors.push({ row: rowNum, field: 'loanNumber', message: 'Loan number is required' }); return }

    const loan = loanByNumber.get(loanNum.toUpperCase())
    if (!loan) { errors.push({ row: rowNum, field: 'loanNumber', message: `Loan "${loanNum}" not found or not active` }); return }

    const amount = toInt(row.amount || '')
    if (!amount || amount <= 0) { errors.push({ row: rowNum, field: 'amount', message: 'Invalid amount' }); return }

    const paymentDate = parseDDMMYYYY(row.paymentDate || '')
    if (!paymentDate) { errors.push({ row: rowNum, field: 'paymentDate', message: 'Invalid date (use DD/MM/YYYY)' }); return }

    if (paymentDate > today) { errors.push({ row: rowNum, field: 'paymentDate', message: 'Date cannot be in the future' }); return }
    if (paymentDate < loan.startDate) { errors.push({ row: rowNum, field: 'paymentDate', message: 'Date cannot be before loan start' }); return }

    const alreadyPaid = paidMap.get(loan.id) || 0
    const outstanding = loan.totalRepayable - alreadyPaid
    if (amount > outstanding) {
      errors.push({ row: rowNum, field: 'amount', message: `Amount exceeds outstanding (${(outstanding / 100).toFixed(2)})` })
      return
    }

    validRows.push({ loanId: loan.id, loanNumber: loan.loanNumber, amountPaise: amount, paymentDate })
  })

  if (!confirm) {
    return NextResponse.json({
      total: payments.length,
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
        data: { receiptSeq: { increment: validRows.length } },
        select: { receiptSeq: true, receiptPrefix: true },
      })

      const baseSeq = biz.receiptSeq - validRows.length
      const prefix = biz.receiptPrefix || 'REC'
      const created: { receiptNumber: string; loanNumber: string }[] = []

      for (let i = 0; i < validRows.length; i++) {
        const v = validRows[i]
        const seq = baseSeq + i + 1
        const receiptNumber = `${prefix}-${String(seq).padStart(5, '0')}`

        await tx.payment.create({
          data: {
            receiptNumber,
            loanId: v.loanId,
            businessId,
            amount: v.amountPaise,
            paymentDate: v.paymentDate,
            collectorId: user.id,
          },
        })

        // Check if loan is fully paid and auto-complete
        const totalPaidResult = await tx.payment.aggregate({
          where: { loanId: v.loanId, isDeleted: false },
          _sum: { amount: true },
        })
        const totalPaid = totalPaidResult._sum.amount || 0
        const loan = await tx.loan.findUnique({ where: { id: v.loanId }, select: { totalRepayable: true } })
        if (loan && totalPaid >= loan.totalRepayable) {
          await tx.loan.update({
            where: { id: v.loanId },
            data: { status: 'COMPLETED', closedAt: v.paymentDate },
          })
        }

        created.push({ receiptNumber, loanNumber: v.loanNumber })
      }

      return { created: created.length, payments: created, errors }
    }, { timeout: 60000 })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('Payment import failed:', err)
    return NextResponse.json({ error: 'Import failed. Transaction rolled back.' }, { status: 500 })
  }
}
