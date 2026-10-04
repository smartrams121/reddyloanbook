import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { generateId, getCustomerIdConfig } from '@/lib/id-generator'

interface RouteParams { params: Promise<{ businessId: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await assertBusinessAccess(user, businessId)

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await prisma.customer.findFirst({
    where: { businessId, customerId: id },
  })

  if (!existing) {
    return NextResponse.json({ available: true })
  }

  // Find next available
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      customerSeq: true, customerIdFormat: true, customerIdPrefix: true,
      customerIdPadding: true, customerIdStart: true, customerIdMax: true,
    },
  })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const config = getCustomerIdConfig(business)
  let nextSeq = Math.max(business.customerSeq + 1, config.start)
  let nextId = generateId(config, nextSeq)

  // Check if next auto-generated ID is also taken
  for (let i = 0; i < 100; i++) {
    const taken = await prisma.customer.findFirst({
      where: { businessId, customerId: nextId },
    })
    if (!taken) break
    nextSeq++
    nextId = generateId(config, nextSeq)
  }

  return NextResponse.json({ available: false, nextAvailable: nextId, nextSeq })
}
