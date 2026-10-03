import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { parseBusinessXlsx } from '@/lib/xlsx-import'
import { generateImportTemplate } from '@/lib/xlsx-import-template'
import { generateSchedule } from '@/lib/schedule'
import { CollectionType, DayOfWeek } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const buffer = await generateImportTemplate()

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Business_Import_Template.xlsx"',
    },
  })
}

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  assertPermission(user, 'create_business')

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const action = formData.get('action') as string || 'test'
  const name = formData.get('name') as string || ''
  const city = formData.get('city') as string || ''
  const receiptPrefix = formData.get('receiptPrefix') as string || ''
  const collectionType = (formData.get('collectionType') as string || 'DAILY').toUpperCase()
  const collectionDays = formData.get('collectionDays') as string || 'MON,TUE,WED,THU,FRI,SAT,SUN'

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Business name is required (min 2 characters)' }, { status: 400 })
  }
  if (!city || city.length < 2) {
    return NextResponse.json({ error: 'City is required (min 2 characters)' }, { status: 400 })
  }

  const existing = await prisma.business.findFirst({
    where: { ownerId: user.id, name },
  })
  if (existing) {
    return NextResponse.json({ error: 'You already have a business with this name' }, { status: 409 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const parsed = await parseBusinessXlsx(buffer)

  if (action === 'test') {
    return NextResponse.json({
      action: 'test',
      sheetResults: parsed.sheetResults,
      summary: {
        locations: parsed.villages.length,
        users: parsed.users.length,
        customers: parsed.customers.length,
        loans: parsed.loans.length,
        payments: parsed.payments.length,
      },
      errors: parsed.errors,
      warnings: parsed.warnings,
      passed: parsed.errors.length === 0,
    })
  }

  // action === 'import'
  if (parsed.errors.length > 0) {
    return NextResponse.json({
      error: 'Validation failed. Run test first to see errors.',
      errors: parsed.errors,
    }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Business
      const biz = await tx.business.create({
        data: {
          name,
          city,
          receiptPrefix: receiptPrefix || null,
          collectionType,
          collectionDays,
          ownerId: user.id,
        },
      })

      // 2. Create Villages
      const villageNameToId = new Map<string, string>()
      for (const v of parsed.villages) {
        const village = await tx.village.create({
          data: { name: v.name, businessId: biz.id, isActive: v.isActive },
        })
        villageNameToId.set(v.name.toLowerCase(), village.id)
      }

      // 3. Create Users
      const userNameToId = new Map<string, string>()
      const createdUsernames: string[] = []
      for (const u of parsed.users) {
        let username = u.username
        let suffix = 1
        while (await tx.user.findUnique({ where: { username } })) {
          suffix++
          username = `${u.username}_${suffix}`
        }

        const passwordHash = await hashPassword(u.username)
        const newUser = await tx.user.create({
          data: {
            fullName: u.fullName,
            username,
            passwordHash,
            phone: u.phone,
            role: u.role,
            isActive: u.isActive,
            mustChangePassword: true,
          },
        })
        userNameToId.set(u.fullName.toLowerCase(), newUser.id)
        createdUsernames.push(username)

        // 4. UserBusinessAssignment
        await tx.userBusinessAssignment.create({
          data: { userId: newUser.id, businessId: biz.id },
        })

        // 5. UserVillageAssignment
        for (const locName of u.assignedLocations) {
          const villageId = villageNameToId.get(locName.toLowerCase().trim())
          if (villageId) {
            await tx.userVillageAssignment.create({
              data: { userId: newUser.id, villageId },
            })
          }
        }
      }

      // Map the importing owner for payment collector fallback
      userNameToId.set(user.fullName.toLowerCase(), user.id)

      // 6. Create Customers
      const exportCustIdToDbId = new Map<string, string>()
      const prefix = receiptPrefix || 'CUS'
      let customerSeq = 0
      for (const c of parsed.customers) {
        customerSeq++
        const customerId = `${prefix}-C${String(customerSeq).padStart(4, '0')}`
        const villageId = villageNameToId.get(c.villageName.toLowerCase().trim())!
        const cust = await tx.customer.create({
          data: {
            customerId,
            fullName: c.fullName,
            phone: c.phone,
            villageId,
            businessId: biz.id,
            status: c.status,
            guarantorName: c.guarantorName,
            guarantorPhone: c.guarantorPhone,
            address: c.address,
          },
        })
        exportCustIdToDbId.set(c.exportId.toUpperCase(), cust.id)
      }

      // 7. Create Loans
      const exportLoanNumToDbId = new Map<string, string>()
      let loanSeq = 0
      for (const l of parsed.loans) {
        loanSeq++
        const loanNumber = `${prefix}-L${String(loanSeq).padStart(5, '0')}`
        const customerId = exportCustIdToDbId.get(l.exportCustomerId.toUpperCase())!
        const agentId = l.agentFullName
          ? userNameToId.get(l.agentFullName.toLowerCase()) || null
          : null

        const lastInstallmentAmount = l.totalRepayablePaise - l.installmentAmountPaise * (l.numberOfInstallments - 1)

        const schedule = generateSchedule({
          startDate: l.startDate,
          numberOfInstallments: l.numberOfInstallments,
          installmentAmount: l.installmentAmountPaise,
          lastInstallmentAmount,
          collectionType: l.collectionType as CollectionType,
          collectionDay: DayOfWeek.SATURDAY,
          collectionDays,
          holidays: [],
        })

        const loan = await tx.loan.create({
          data: {
            loanNumber,
            customerId,
            businessId: biz.id,
            loanAmount: l.loanAmountPaise,
            interestAmount: l.interestAmountPaise,
            totalRepayable: l.totalRepayablePaise,
            amountGiven: l.amountGivenPaise,
            interestModel: 'ADDON',
            collectionType: l.collectionType,
            installmentAmount: l.installmentAmountPaise,
            numberOfInstallments: l.numberOfInstallments,
            lastInstallmentAmount,
            startDate: l.startDate,
            expectedEndDate: l.expectedEndDate,
            agentId,
            status: l.status,
            closedAt: l.closedAt,
            schedule: {
              create: schedule.map(s => ({
                installmentNumber: s.installmentNumber,
                dueDate: s.dueDate,
                amount: s.amount,
              })),
            },
          },
        })
        exportLoanNumToDbId.set(l.exportLoanNumber.toUpperCase(), loan.id)
      }

      // 8. Create Payments
      let receiptSeq = 0
      for (const p of parsed.payments) {
        receiptSeq++
        const receiptNumber = `${prefix}-${String(receiptSeq).padStart(5, '0')}`
        const loanId = exportLoanNumToDbId.get(p.exportLoanNumber.toUpperCase())!
        const collectorId = p.collectedByFullName
          ? userNameToId.get(p.collectedByFullName.toLowerCase()) || user.id
          : user.id

        await tx.payment.create({
          data: {
            receiptNumber,
            loanId,
            businessId: biz.id,
            amount: p.amountPaise,
            paymentDate: p.paymentDate,
            collectorId,
          },
        })
      }

      // 9. Update sequence counters
      await tx.business.update({
        where: { id: biz.id },
        data: { customerSeq, loanSeq, receiptSeq },
      })

      return {
        businessId: biz.id,
        businessName: biz.name,
        counts: {
          locations: parsed.villages.length,
          users: parsed.users.length,
          customers: parsed.customers.length,
          loans: parsed.loans.length,
          payments: parsed.payments.length,
        },
        createdUsernames,
      }
    }, { timeout: 120000 })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('Business import failed:', err)
    return NextResponse.json(
      { error: 'Import failed. The transaction was rolled back. Please try again.' },
      { status: 500 }
    )
  }
}
