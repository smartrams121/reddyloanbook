import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { resolveLoanStatus, getGracePeriod } from '@/lib/loan-status'

interface Props {
  params: Promise<{ businessId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'post_payment')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const villageId = searchParams.get('villageId')
  if (!villageId) {
    return NextResponse.json({ error: 'villageId is required' }, { status: 400 })
  }

  const date = searchParams.get('date')

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { gracePeriodDaily: true, gracePeriodWeekly: true, gracePeriodMonthly: true, defaulterPeriodDays: true },
  })

  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      villageId,
    },
    include: {
      loans: {
        select: {
          id: true, loanNumber: true, installmentAmount: true,
          totalRepayable: true, status: true, startDate: true, createdAt: true,
          expectedEndDate: true, numberOfInstallments: true, collectionType: true,
          statusOverride: true, statusOverrideDate: true,
          agent: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { fullName: 'asc' },
  })

  const allLoanIds = customers.flatMap((c) => c.loans.map((l) => l.id))
  const paidSums = allLoanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: allLoanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const paidMap = new Map(paidSums.map((p) => [p.loanId, p._sum.amount || 0]))

  let existingPaymentMap = new Map<string, { id: string; amount: number }>()
  if (date && allLoanIds.length > 0) {
    const existingPayments = await prisma.payment.findMany({
      where: {
        loanId: { in: allLoanIds },
        paymentDate: date,
        isDeleted: false,
        amount: { gt: 0 },
      },
      select: { id: true, loanId: true, amount: true },
      orderBy: { createdAt: 'desc' },
    })
    for (const p of existingPayments) {
      if (!existingPaymentMap.has(p.loanId)) {
        existingPaymentMap.set(p.loanId, { id: p.id, amount: p.amount })
      }
    }
  }

  const filteredCustomers = date
    ? customers.map(c => ({
        ...c,
        loans: c.loans.filter(l => l.startDate <= date),
      }))
    : customers

  const result = filteredCustomers
    .map(c => ({
      id: c.id,
      customerId: c.customerId,
      fullName: c.fullName,
      phone: c.phone,
      loans: c.loans
        .map(l => {
          const totalPaid = paidMap.get(l.id) || 0
          const outstanding = l.totalRepayable - totalPaid
          const existing = existingPaymentMap.get(l.id) || null
          return {
            id: l.id,
            loanNumber: l.loanNumber,
            installmentAmount: l.installmentAmount,
            totalRepayable: l.totalRepayable,
            totalPaid,
            outstanding,
            status: business ? resolveLoanStatus(l, totalPaid, getGracePeriod(business, l.collectionType), l.collectionType, business.defaulterPeriodDays) : l.status,
            agentId: l.agent?.id || null,
            agentName: l.agent?.fullName || null,
            existingPayment: existing,
          }
        })
        .filter(l => l.outstanding > 0),
    }))
    .filter(c => c.loans.length > 0)

  return NextResponse.json(result)
}
