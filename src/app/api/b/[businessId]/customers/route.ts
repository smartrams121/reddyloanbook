import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { createCustomerSchema } from '@/lib/validators'
import crypto from 'crypto'

interface Props {
  params: Promise<{ businessId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'view_customer')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const villageId = searchParams.get('villageId')
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const where: Record<string, unknown> = { businessId }
  if (villageId) where.villageId = villageId
  if (status) where.status = status
  if (search) {
    where.OR = [
      { fullName: { contains: search } },
      { phone: { contains: search } },
      { customerId: { contains: search } },
    ]
  }

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true, customerId: true, fullName: true, phone: true,
      age: true, status: true, photoPath: true, updatedAt: true,
      village: { select: { id: true, name: true } },
      _count: { select: { loans: true } },
    },
    orderBy: { fullName: 'asc' },
  })

  return NextResponse.json(customers)
}

export async function POST(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'create_customer')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const village = await prisma.village.findFirst({
    where: { id: parsed.data.villageId, businessId, isActive: true },
  })
  if (!village) {
    return NextResponse.json({ error: 'Location not found or inactive' }, { status: 400 })
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const seq = business.customerSeq + 1
  const prefix = business.receiptPrefix || 'C'
  const customerId = `${prefix}${String(seq).padStart(4, '0')}`

  let aadhaarHash: string | undefined
  let aadhaarLast4: string | undefined
  if (parsed.data.aadhaar && parsed.data.aadhaar.length === 12) {
    aadhaarHash = crypto.createHash('sha256').update(parsed.data.aadhaar).digest('hex')
    aadhaarLast4 = parsed.data.aadhaar.slice(-4)
  }

  let customer
  try {
    customer = await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: businessId },
        data: { customerSeq: seq },
      })

      return tx.customer.create({
        data: {
          customerId,
          fullName: parsed.data.fullName,
          age: parsed.data.age,
          phone: parsed.data.phone,
          altPhone: parsed.data.altPhone || null,
          address: parsed.data.address || null,
          aadhaarHash: aadhaarHash || null,
          aadhaarLast4: aadhaarLast4 || null,
          jobType: parsed.data.jobType || null,
          guarantorName: parsed.data.guarantorName || null,
          guarantorPhone: parsed.data.guarantorPhone || null,
          notes: parsed.data.notes || null,
          photoPath: parsed.data.photoPath || null,
          villageId: parsed.data.villageId,
          businessId,
        },
      })
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  return NextResponse.json(customer, { status: 201 })
}
