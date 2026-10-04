import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { generateId, getLoanIdConfig } from '@/lib/id-generator'

interface RouteParams { params: Promise<{ businessId: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await assertBusinessAccess(user, businessId)

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      loanSeq: true, loanIdFormat: true, loanIdPrefix: true,
      loanIdPadding: true, loanIdStart: true, loanIdMax: true,
    },
  })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const config = getLoanIdConfig(business)
  const nextSeq = Math.max(business.loanSeq + 1, config.start)
  const nextId = generateId(config, nextSeq)

  return NextResponse.json({ nextSeq, nextId, config })
}
