import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { z } from 'zod'
import { todayIST } from '@/lib/date'

interface Props {
  params: Promise<{ businessId: string }>
}

const bulkActionSchema = z.object({
  loanIds: z.array(z.string()).min(1).max(100),
  action: z.enum(['delete', 'freeze', 'inactive', 'reactivate']),
})

const TERMINAL_STATUSES = ['COMPLETED', 'COMPLETED_RENEWED', 'SETTLED', 'WRITTEN_OFF']

export async function POST(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = bulkActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { loanIds, action } = parsed.data

  const loans = await prisma.loan.findMany({
    where: { id: { in: loanIds }, businessId },
    select: { id: true, status: true, expectedEndDate: true, pausedAt: true },
  })

  if (loans.length === 0) {
    return NextResponse.json({ error: 'No matching loans found' }, { status: 404 })
  }

  const today = todayIST()

  if (action === 'delete') {
    assertPermission(user, 'delete_loan')

    await prisma.$transaction(async (tx) => {
      const ids = loans.map((l) => l.id)
      await tx.loanScheduleEntry.deleteMany({ where: { loanId: { in: ids } } })
      await tx.payment.deleteMany({ where: { loanId: { in: ids } } })
      await tx.document.deleteMany({ where: { loanId: { in: ids } } })
      await tx.loan.deleteMany({ where: { id: { in: ids } } })
    })

    return NextResponse.json({ success: true, action: 'delete', count: loans.length })
  }

  if (action === 'freeze') {
    assertPermission(user, 'freeze_loan')

    const eligible = loans.filter((l) => !TERMINAL_STATUSES.includes(l.status) && l.status !== 'FROZEN')
    if (eligible.length === 0) {
      return NextResponse.json({ error: 'No eligible loans to freeze' }, { status: 400 })
    }

    await prisma.loan.updateMany({
      where: { id: { in: eligible.map((l) => l.id) } },
      data: { status: 'FROZEN' },
    })

    return NextResponse.json({ success: true, action: 'freeze', count: eligible.length, skipped: loans.length - eligible.length })
  }

  if (action === 'inactive') {
    assertPermission(user, 'manage_loan_status')

    const eligible = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'IN_GRACE')
    if (eligible.length === 0) {
      return NextResponse.json({ error: 'No eligible loans to make inactive' }, { status: 400 })
    }

    await prisma.loan.updateMany({
      where: { id: { in: eligible.map((l) => l.id) } },
      data: { status: 'INACTIVE', pausedAt: today },
    })

    return NextResponse.json({ success: true, action: 'inactive', count: eligible.length, skipped: loans.length - eligible.length })
  }

  if (action === 'reactivate') {
    assertPermission(user, 'manage_loan_status')

    const eligible = loans.filter((l) => l.status === 'INACTIVE' && l.pausedAt)
    if (eligible.length === 0) {
      return NextResponse.json({ error: 'No inactive loans to reactivate' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      for (const loan of eligible) {
        const pausedDate = new Date(loan.pausedAt! + 'T00:00:00')
        const todayDate = new Date(today + 'T00:00:00')
        const pausedDays = Math.ceil((todayDate.getTime() - pausedDate.getTime()) / (1000 * 60 * 60 * 24))

        const endDate = new Date(loan.expectedEndDate + 'T00:00:00')
        endDate.setDate(endDate.getDate() + pausedDays)
        const newEnd = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

        await tx.loan.update({
          where: { id: loan.id },
          data: { status: 'ACTIVE', pausedAt: null, expectedEndDate: newEnd },
        })
      }
    })

    return NextResponse.json({ success: true, action: 'reactivate', count: eligible.length, skipped: loans.length - eligible.length })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
