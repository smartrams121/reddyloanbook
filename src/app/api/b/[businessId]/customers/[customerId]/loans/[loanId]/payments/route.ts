import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'

interface Props {
  params: Promise<{ businessId: string; customerId: string; loanId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { businessId, customerId, loanId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'view_customer', businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, customerId, businessId },
    select: { id: true },
  })
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)))
  const skip = (page - 1) * limit

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { loanId, isDeleted: false },
      include: {
        collector: { select: { id: true, fullName: true } },
      },
      orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.payment.count({
      where: { loanId, isDeleted: false },
    }),
  ])

  return NextResponse.json({
    payments,
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  })
}
