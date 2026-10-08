import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { resolveLoanStatus, deriveCustomerStatus, getGracePeriod } from '@/lib/loan-status'
import { z } from 'zod'
import crypto from 'crypto'
import { phoneSchema } from '@/lib/validators'

interface Props {
  params: Promise<{ businessId: string; customerId: string }>
}

const updateCustomerSchema = z.object({
  customerId: z.string().optional(),
  fullName: z.string().min(2).optional(),
  age: z.number().int().min(18).max(100).optional(),
  phone: phoneSchema.optional().or(z.literal('')),
  altPhone: phoneSchema.optional().or(z.literal('')),
  address: z.string().optional(),
  jobType: z.string().optional(),
  aadhaar: z.string().regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits').optional().or(z.literal('')),
  guarantorName: z.string().optional(),
  guarantorPhone: phoneSchema.optional().or(z.literal('')),
  notes: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  photoPath: z.string().optional().nullable(),
  villageId: z.string().optional(),
  status: z.enum(['ACTIVE', 'CLOSED']).optional(),
})

export async function GET(request: Request, { params }: Props) {
  const { businessId, customerId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'view_customer', businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { gracePeriodDaily: true, gracePeriodWeekly: true, gracePeriodMonthly: true, defaulterPeriodDays: true },
  })

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    include: {
      village: { select: { id: true, name: true } },
      loans: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          loanNumber: true,
          loanAmount: true,
          amountGiven: true,
          interestAmount: true,
          totalRepayable: true,
          installmentAmount: true,
          numberOfInstallments: true,
          collectionType: true,
          statusOverride: true,
          statusOverrideDate: true,
          startDate: true,
          expectedEndDate: true,
          closedAt: true,
          writeOffReason: true,
          settlementReason: true,
          settlementAmount: true,
          status: true,
          notes: true,
          createdAt: true,
          interestModel: true,
          agent: { select: { id: true, fullName: true } },
          documents: { select: { id: true, filePath: true, originalName: true, mimeType: true } },
        },
      },
    },
  })

  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const loanIds = customer.loans.map((l) => l.id)
  const paidSums = loanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: loanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const paidMap = new Map(paidSums.map((p) => [p.loanId, p._sum.amount || 0]))

  const loansWithTotals = customer.loans.map((l) => {
    const totalPaid = paidMap.get(l.id) || 0
    const derived = resolveLoanStatus(l, totalPaid, getGracePeriod(business!, l.collectionType), l.collectionType, business!.defaulterPeriodDays)
    const outstanding = derived !== 'COMPLETED' ? l.totalRepayable - totalPaid : 0
    return { ...l, totalPaid, outstanding, derivedStatus: derived }
  })

  const loanStatuses = loansWithTotals.map((l) => l.derivedStatus)

  const summary = {
    totalLoans: customer.loans.length,
    activeLoans: loanStatuses.filter((s) => s === 'ACTIVE' || s === 'OVERDUE').length,
    completedLoans: loanStatuses.filter((s) => s === 'COMPLETED').length,
    defaulterLoans: loanStatuses.filter((s) => s === 'DEFAULTER').length,
    totalLent: customer.loans.reduce((s, l) => s + l.amountGiven, 0),
    totalRepayable: customer.loans.reduce((s, l) => s + l.totalRepayable, 0),
    totalPaid: loansWithTotals.reduce((s, l) => s + l.totalPaid, 0),
    totalOutstanding: loansWithTotals.reduce((s, l) => s + l.outstanding, 0),
    customerStatus: deriveCustomerStatus(loanStatuses),
  }

  return NextResponse.json({
    ...customer,
    loans: loansWithTotals,
    summary,
  })
}

export async function PATCH(request: Request, { params }: Props) {
  const { businessId, customerId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'edit_customer', businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } })
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const body = await request.json()
  const parsed = updateCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.customerId) {
    // Check uniqueness of new customer ID
    const existing = await prisma.customer.findFirst({
      where: { businessId, customerId: parsed.data.customerId, NOT: { id: customerId } },
    })
    if (existing) {
      return NextResponse.json({ error: `Customer ID "${parsed.data.customerId}" already exists` }, { status: 409 })
    }
    data.customerId = parsed.data.customerId
  }
  if (parsed.data.fullName) data.fullName = parsed.data.fullName
  if (parsed.data.age !== undefined) data.age = parsed.data.age
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone || null
  if (parsed.data.altPhone !== undefined) data.altPhone = parsed.data.altPhone || null
  if (parsed.data.address !== undefined) data.address = parsed.data.address || null
  if (parsed.data.jobType !== undefined) data.jobType = parsed.data.jobType || null
  if (parsed.data.aadhaar) {
    data.aadhaarHash = crypto.createHash('sha256').update(parsed.data.aadhaar).digest('hex')
    data.aadhaarLast4 = parsed.data.aadhaar.slice(-4)
  }
  if (parsed.data.guarantorName !== undefined) data.guarantorName = parsed.data.guarantorName || null
  if (parsed.data.guarantorPhone !== undefined) data.guarantorPhone = parsed.data.guarantorPhone || null
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null
  if (parsed.data.latitude !== undefined) data.latitude = parsed.data.latitude ?? null
  if (parsed.data.longitude !== undefined) data.longitude = parsed.data.longitude ?? null
  if (parsed.data.photoPath !== undefined) data.photoPath = parsed.data.photoPath || null
  if (parsed.data.status) data.status = parsed.data.status
  if (parsed.data.villageId) {
    const village = await prisma.village.findFirst({
      where: { id: parsed.data.villageId, businessId, isActive: true },
    })
    if (!village) return NextResponse.json({ error: 'Location not found' }, { status: 400 })
    data.villageId = parsed.data.villageId
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const updated = await prisma.customer.update({ where: { id: customerId }, data })
  return NextResponse.json(updated)
}
