import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { z } from 'zod'

interface Props {
  params: Promise<{ businessId: string }>
}

const bulkActionSchema = z.object({
  loanIds: z.array(z.string()).min(1).max(100),
  action: z.enum(['delete']),
})

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
    select: { id: true },
  })

  if (loans.length === 0) {
    return NextResponse.json({ error: 'No matching loans found' }, { status: 404 })
  }

  if (action === 'delete') {
    assertPermission(user, 'delete_loan', businessId)

    await prisma.$transaction(async (tx) => {
      const ids = loans.map((l) => l.id)
      await tx.loanScheduleEntry.deleteMany({ where: { loanId: { in: ids } } })
      await tx.payment.deleteMany({ where: { loanId: { in: ids } } })
      await tx.document.deleteMany({ where: { loanId: { in: ids } } })
      await tx.loan.deleteMany({ where: { id: { in: ids } } })
    })

    return NextResponse.json({ success: true, action: 'delete', count: loans.length })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
