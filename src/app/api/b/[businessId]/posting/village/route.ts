import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'

interface Props {
  params: Promise<{ businessId: string }>
}

const ACTIVE_STATUSES = ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER', 'FROZEN']

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

  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      villageId,
      status: 'ACTIVE',
    },
    include: {
      loans: {
        where: { status: { in: ACTIVE_STATUSES } },
        include: {
          payments: {
            where: { isDeleted: false },
            select: { amount: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { fullName: 'asc' },
  })

  const result = customers
    .filter(c => c.loans.length > 0)
    .map(c => ({
      id: c.id,
      customerId: c.customerId,
      fullName: c.fullName,
      phone: c.phone,
      loans: c.loans.map(l => {
        const totalPaid = l.payments.reduce((s, p) => s + p.amount, 0)
        return {
          id: l.id,
          loanNumber: l.loanNumber,
          installmentAmount: l.installmentAmount,
          totalRepayable: l.totalRepayable,
          totalPaid,
          outstanding: l.totalRepayable - totalPaid,
          status: l.status,
        }
      }),
    }))

  return NextResponse.json(result)
}
