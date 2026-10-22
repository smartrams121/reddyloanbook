import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { phoneSchema } from '@/lib/validators'
import { generateId, getCustomerIdConfig } from '@/lib/id-generator'
import crypto from 'crypto'

// CSV age validation: 1-120 (different from form validation: 18-100)
// This CSV-only range allows for broader age entries during bulk import
// Form validation in other parts of the app remains 18-100

interface Props {
  params: Promise<{ businessId: string }>
}

interface CsvRow {
  customerId?: string
  fullName: string
  villageName: string
  phone?: string
  age?: string
  altPhone?: string
  address?: string
  aadhaar?: string
  jobType?: string
  familyMemberName?: string
  familyRelation?: string
  guarantorName?: string
  guarantorPhone?: string
  notes?: string
}

interface RowResult {
  rowNumber: number
  customerName: string
  status: 'imported' | 'skipped' | 'imported_with_warnings'
  errors: string[]
  warnings: string[]
  data: CustomerCreateData | null
}

interface CustomerCreateData {
  customerId: string
  fullName: string
  villageId: string
  phone: string  // Always a string (empty if not provided)
  age: number | null
  altPhone: string | null
  address: string | null
  aadhaarHash: string | null
  aadhaarLast4: string | null
  jobType: string | null
  familyMemberName: string | null
  familyRelation: string | null
  guarantorName: string | null
  guarantorPhone: string | null
  notes: string | null
}

function stripPhoneFormatting(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '')
}

function hashAadhaar(aadhaar: string): { hash: string; last4: string } {
  const trimmed = aadhaar.trim()
  return {
    hash: crypto.createHash('sha256').update(trimmed).digest('hex'),
    last4: trimmed.slice(-4),
  }
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
  console.log(`[CSV Import] businessId=${businessId} rows=${customers?.length} confirm=${confirm}`)

  if (!Array.isArray(customers) || customers.length === 0) {
    return NextResponse.json({ error: 'No customer data provided' }, { status: 400 })
  }
  if (customers.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 customers per import' }, { status: 400 })
  }

  // Filter out instruction row (where fullName starts with "REQUIRED" or "OPTIONAL")
  const dataRows = customers.filter(row => {
    const fullName = (row.fullName ?? '').toString().trim()
    return !fullName.startsWith('REQUIRED') && !fullName.startsWith('OPTIONAL')
  })

  // Filter out example rows (where customerId === "__EXAMPLE__")
  const processRows = dataRows.filter(row => (row.customerId ?? '').toString().trim() !== '__EXAMPLE__')

  if (processRows.length === 0) {
    return NextResponse.json({
      error: 'The uploaded file has no customer data. Please add customer rows below the header row and try again.',
    }, { status: 400 })
  }

  // Load villages
  const villages = await prisma.village.findMany({
    where: { businessId, isActive: true },
    select: { id: true, name: true },
  })
  const villageMap = new Map(villages.map(v => [v.name.toLowerCase().trim(), v.id]))

  // Load valid jobTypes (static + existing custom ones from this business)
  const STATIC_JOB_TYPES = ['Shop', 'Business', 'Farmer', 'Labour', 'Driver', 'Others']
  const existingCustomers = await prisma.customer.findMany({
    where: { businessId },
    select: { jobType: true },
  })
  const customJobTypesSet = new Set(
    existingCustomers
      .filter(c => c.jobType && !STATIC_JOB_TYPES.includes(c.jobType))
      .map(c => c.jobType!)
  )
  const validJobTypes = [...STATIC_JOB_TYPES, ...Array.from(customJobTypesSet)]

  // Valid family relations
  const VALID_RELATIONS = [
    'Husband', 'Wife', 'Son', 'Daughter', 'Brother', 'Sister',
    'Mother', 'Father', 'Father-in-law', 'Mother-in-law',
    'Son-in-law', 'Daughter-in-law',
  ]

  // Get business for ID generation
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      customerSeq: true, customerIdFormat: true, customerIdPrefix: true,
      customerIdPadding: true, customerIdStart: true, customerIdMax: true,
    },
  })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const idConfig = getCustomerIdConfig(business)

  // Process each row
  const results: RowResult[] = []
  let autoSeq = Math.max(business.customerSeq, idConfig.start - 1)

  for (let i = 0; i < processRows.length; i++) {
    const row = processRows[i]
    const rowNum = i + 1
    const rowResult: RowResult = {
      rowNumber: rowNum,
      customerName: '',
      status: 'imported',
      errors: [],
      warnings: [],
      data: null,
    }

    const get = (col: string) => (row[col as keyof CsvRow] ?? '').toString().trim()

    // fullName (REQUIRED)
    const fullName = get('fullName')
    if (!fullName) {
      rowResult.errors.push('Full Name is required')
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }
    rowResult.customerName = fullName

    // villageName (REQUIRED)
    const villageName = get('villageName')
    if (!villageName) {
      rowResult.errors.push('Village/Location is required')
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }

    const villageId = villageMap.get(villageName.toLowerCase())
    if (!villageId) {
      rowResult.errors.push(`Village '${villageName}' not found. Add it in Collection Settings first.`)
      rowResult.status = 'skipped'
      results.push(rowResult)
      continue
    }

    // customerId (OPTIONAL, auto-generate if empty)
    let customerId: string
    const customIdRaw = get('customerId')
    if (!customIdRaw) {
      autoSeq++
      customerId = generateId(idConfig, autoSeq)
    } else {
      // Check uniqueness
      const existing = await prisma.customer.findFirst({
        where: { customerId: customIdRaw, businessId },
      })
      if (existing) {
        rowResult.errors.push(
          `Customer ID '${customIdRaw}' already exists. Leave blank to auto-generate or use a different ID.`
        )
        rowResult.status = 'skipped'
        results.push(rowResult)
        continue
      }
      customerId = customIdRaw
    }

    // phone (OPTIONAL - but stored as empty string if not provided since DB field is NOT nullable)
    let phone: string = ''
    const phoneRaw = get('phone')
    if (phoneRaw) {
      const stripped = stripPhoneFormatting(phoneRaw)
      if (stripped.length !== 10 || !/^\d+$/.test(stripped)) {
        rowResult.warnings.push(`Phone '${phoneRaw}' is not 10 digits. Phone set to empty.`)
        phone = ''
      } else {
        const duplicate = await prisma.customer.findFirst({
          where: { phone: stripped, businessId },
        })
        if (duplicate) {
          rowResult.warnings.push(
            `Phone ${stripped} already exists for customer ${duplicate.fullName}. Phone set to empty.`
          )
          phone = ''
        } else {
          phone = stripped
        }
      }
    }

    // age (OPTIONAL, 1-120 for CSV)
    let age: number | null = null
    const ageRaw = get('age')
    if (ageRaw) {
      const n = parseInt(ageRaw)
      if (isNaN(n) || n < 1 || n > 120) {
        rowResult.warnings.push(`Age '${ageRaw}' is invalid (must be 1-120). Age set to empty.`)
        age = null
      } else {
        age = n
      }
    }

    // altPhone (OPTIONAL)
    let altPhone: string | null = null
    const altPhoneRaw = get('altPhone')
    if (altPhoneRaw) {
      const stripped = stripPhoneFormatting(altPhoneRaw)
      if (stripped.length !== 10 || !/^\d+$/.test(stripped)) {
        rowResult.warnings.push(`Alt Phone '${altPhoneRaw}' is not 10 digits. Alt Phone set to empty.`)
        altPhone = null
      } else {
        altPhone = stripped
      }
    }

    // address (OPTIONAL)
    const address = get('address') || null

    // aadhaar (OPTIONAL, 12 digits)
    let aadhaarHash: string | null = null
    let aadhaarLast4: string | null = null
    const aadhaarRaw = get('aadhaar')
    if (aadhaarRaw) {
      const stripped = aadhaarRaw.replace(/\s/g, '')
      if (stripped.length !== 12 || !/^\d+$/.test(stripped)) {
        rowResult.warnings.push(`Aadhaar '${aadhaarRaw}' is not 12 digits. Aadhaar set to empty.`)
      } else {
        const hashed = hashAadhaar(stripped)
        aadhaarHash = hashed.hash
        aadhaarLast4 = hashed.last4
      }
    }

    // jobType (OPTIONAL)
    let jobType: string | null = null
    const jobTypeRaw = get('jobType')
    if (jobTypeRaw) {
      const match = validJobTypes.find(j => j.toLowerCase() === jobTypeRaw.toLowerCase())
      if (!match) {
        rowResult.warnings.push(
          `Job Type '${jobTypeRaw}' is not valid. Valid values: ${validJobTypes.join(', ')}. Job Type set to empty.`
        )
        jobType = null
      } else {
        jobType = match
      }
    }

    // familyMemberName (OPTIONAL)
    const familyMemberName = get('familyMemberName') || null

    // familyRelation (OPTIONAL)
    let familyRelation: string | null = null
    const familyRelationRaw = get('familyRelation')
    if (familyRelationRaw) {
      const match = VALID_RELATIONS.find(r => r.toLowerCase() === familyRelationRaw.toLowerCase())
      if (!match) {
        rowResult.warnings.push(
          `Relation '${familyRelationRaw}' is not valid. Valid values: ${VALID_RELATIONS.join(', ')}. Relation set to empty.`
        )
        familyRelation = null
      } else {
        familyRelation = match
      }
    }

    // guarantorName (OPTIONAL)
    const guarantorName = get('guarantorName') || null

    // guarantorPhone (OPTIONAL)
    let guarantorPhone: string | null = null
    const guarantorPhoneRaw = get('guarantorPhone')
    if (guarantorPhoneRaw) {
      const stripped = stripPhoneFormatting(guarantorPhoneRaw)
      if (stripped.length !== 10 || !/^\d+$/.test(stripped)) {
        rowResult.warnings.push(`Guarantor Phone '${guarantorPhoneRaw}' is not 10 digits. Guarantor Phone set to empty.`)
        guarantorPhone = null
      } else {
        guarantorPhone = stripped
      }
    }

    // notes (OPTIONAL)
    const notes = get('notes') || null

    // Determine status
    if (rowResult.errors.length > 0) {
      rowResult.status = 'skipped'
      rowResult.data = null
    } else if (rowResult.warnings.length > 0) {
      rowResult.status = 'imported_with_warnings'
      rowResult.data = {
        customerId,
        fullName,
        villageId,
        phone,
        age,
        altPhone,
        address,
        aadhaarHash,
        aadhaarLast4,
        jobType,
        familyMemberName,
        familyRelation,
        guarantorName,
        guarantorPhone,
        notes,
      }
    } else {
      rowResult.status = 'imported'
      rowResult.data = {
        customerId,
        fullName,
        villageId,
        phone,
        age,
        altPhone,
        address,
        aadhaarHash,
        aadhaarLast4,
        jobType,
        familyMemberName,
        familyRelation,
        guarantorName,
        guarantorPhone,
        notes,
      }
    }

    results.push(rowResult)
  }

  // Validation phase (no confirm)
  if (!confirm) {
    return NextResponse.json({
      totalRows: processRows.length,
      imported: results.filter(r => r.status !== 'skipped').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      warnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
      results,
    })
  }

  // Import phase (with confirm)
  const toImport = results.filter(r => r.status !== 'skipped' && r.data)

  if (toImport.length === 0) {
    return NextResponse.json({
      totalRows: processRows.length,
      imported: 0,
      skipped: results.filter(r => r.status === 'skipped').length,
      warnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
      results,
    })
  }

  // Batch insert
  try {
    await prisma.$transaction(async (tx) => {
      // Update sequence to the highest auto-generated value
      if (autoSeq > business.customerSeq) {
        await tx.business.update({
          where: { id: businessId },
          data: { customerSeq: autoSeq },
        })
      }

      // Insert customers in batches
      const batchSize = 100
      for (let i = 0; i < toImport.length; i += batchSize) {
        const batch = toImport.slice(i, i + batchSize)
        await tx.customer.createMany({
          data: batch.map(r => ({
            customerId: r.data!.customerId,
            fullName: r.data!.fullName,
            villageId: r.data!.villageId,
            phone: r.data!.phone,
            altPhone: r.data!.altPhone,
            age: r.data!.age,
            address: r.data!.address,
            aadhaarHash: r.data!.aadhaarHash,
            aadhaarLast4: r.data!.aadhaarLast4,
            jobType: r.data!.jobType,
            familyMemberName: r.data!.familyMemberName,
            familyRelation: r.data!.familyRelation,
            guarantorName: r.data!.guarantorName,
            guarantorPhone: r.data!.guarantorPhone,
            notes: r.data!.notes,
            businessId,
          })),
        })
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: `Import failed: ${(error as Error).message}`,
      totalRows: processRows.length,
      imported: 0,
      skipped: results.filter(r => r.status === 'skipped').length,
      warnings: 0,
      results,
    }, { status: 400 })
  }

  return NextResponse.json({
    totalRows: processRows.length,
    imported: toImport.length,
    skipped: results.filter(r => r.status === 'skipped').length,
    warnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
    results,
  }, { status: 201 })
}
