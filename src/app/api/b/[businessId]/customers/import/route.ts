import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { phoneSchema } from '@/lib/validators'
import crypto from 'crypto'

interface Props {
  params: Promise<{ businessId: string }>
}

interface CsvRow {
  fullName: string
  phone: string
  villageName: string
  age?: string
  altPhone?: string
  address?: string
  aadhaar?: string
  jobType?: string
  guarantorName?: string
  guarantorPhone?: string
  notes?: string
}

interface RowError {
  row: number
  field: string
  message: string
}

interface ValidatedRow {
  row: number
  data: CsvRow
  villageId: string
}

export async function POST(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
    assertPermission(user, 'create_customer', businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const { customers, confirm } = body as { customers: CsvRow[]; confirm?: boolean }

  if (!Array.isArray(customers) || customers.length === 0) {
    return NextResponse.json({ error: 'No customer data provided' }, { status: 400 })
  }
  if (customers.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 customers per import' }, { status: 400 })
  }

  const villages = await prisma.village.findMany({
    where: { businessId, isActive: true },
    select: { id: true, name: true },
  })
  const villageMap = new Map(villages.map(v => [v.name.toLowerCase().trim(), v.id]))

  const errors: RowError[] = []
  const valid: ValidatedRow[] = []

  for (let i = 0; i < customers.length; i++) {
    const row = customers[i]
    const rowNum = i + 1
    let hasError = false

    if (!row.fullName || row.fullName.trim().length < 2) {
      errors.push({ row: rowNum, field: 'fullName', message: 'Name must be at least 2 characters' })
      hasError = true
    }

    const phoneResult = phoneSchema.safeParse(row.phone?.trim())
    if (!phoneResult.success) {
      errors.push({ row: rowNum, field: 'phone', message: 'Must be a valid 10-digit Indian mobile number' })
      hasError = true
    }

    if (!row.villageName || !row.villageName.trim()) {
      errors.push({ row: rowNum, field: 'villageName', message: 'Location name is required' })
      hasError = true
    } else {
      const vId = villageMap.get(row.villageName.toLowerCase().trim())
      if (!vId) {
        errors.push({ row: rowNum, field: 'villageName', message: `Location "${row.villageName}" not found` })
        hasError = true
      } else if (!hasError) {
        if (row.altPhone && row.altPhone.trim()) {
          const altResult = phoneSchema.safeParse(row.altPhone.trim())
          if (!altResult.success) {
            errors.push({ row: rowNum, field: 'altPhone', message: 'Invalid alt phone number' })
            hasError = true
          }
        }
        if (row.guarantorPhone && row.guarantorPhone.trim()) {
          const gpResult = phoneSchema.safeParse(row.guarantorPhone.trim())
          if (!gpResult.success) {
            errors.push({ row: rowNum, field: 'guarantorPhone', message: 'Invalid guarantor phone number' })
            hasError = true
          }
        }
        if (row.age && row.age.trim()) {
          const ageNum = parseInt(row.age.trim())
          if (isNaN(ageNum) || ageNum < 18 || ageNum > 100) {
            errors.push({ row: rowNum, field: 'age', message: 'Age must be between 18 and 100' })
            hasError = true
          }
        }
        if (row.aadhaar && row.aadhaar.trim()) {
          if (!/^\d{12}$/.test(row.aadhaar.trim())) {
            errors.push({ row: rowNum, field: 'aadhaar', message: 'Aadhaar must be exactly 12 digits' })
            hasError = true
          }
        }
        if (!hasError) {
          valid.push({ row: rowNum, data: row, villageId: vId })
        }
      }
    }
  }

  if (!confirm) {
    return NextResponse.json({
      total: customers.length,
      validCount: valid.length,
      errorCount: errors.length,
      errors,
      valid: valid.map(v => ({ row: v.row, fullName: v.data.fullName, phone: v.data.phone, villageName: v.data.villageName })),
    })
  }

  if (valid.length === 0) {
    return NextResponse.json({ error: 'No valid customers to import' }, { status: 400 })
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const prefix = business.receiptPrefix || 'C'
  const startSeq = business.customerSeq + 1

  const created = await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: businessId },
      data: { customerSeq: startSeq + valid.length - 1 },
    })

    const results: { customerId: string; fullName: string }[] = []

    for (let i = 0; i < valid.length; i++) {
      const { data, villageId } = valid[i]
      const seq = startSeq + i
      const customerId = `${prefix}${String(seq).padStart(4, '0')}`

      let aadhaarHash: string | null = null
      let aadhaarLast4: string | null = null
      if (data.aadhaar && data.aadhaar.trim().length === 12) {
        aadhaarHash = crypto.createHash('sha256').update(data.aadhaar.trim()).digest('hex')
        aadhaarLast4 = data.aadhaar.trim().slice(-4)
      }

      await tx.customer.create({
        data: {
          customerId,
          fullName: data.fullName.trim(),
          phone: data.phone.trim(),
          altPhone: data.altPhone?.trim() || null,
          age: data.age?.trim() ? parseInt(data.age.trim()) : null,
          address: data.address?.trim() || null,
          aadhaarHash,
          aadhaarLast4,
          jobType: data.jobType?.trim() || null,
          guarantorName: data.guarantorName?.trim() || null,
          guarantorPhone: data.guarantorPhone?.trim() || null,
          notes: data.notes?.trim() || null,
          villageId,
          businessId,
        },
      })

      results.push({ customerId, fullName: data.fullName.trim() })
    }

    return results
  })

  return NextResponse.json({
    created: created.length,
    customers: created,
    errors,
  }, { status: 201 })
}
