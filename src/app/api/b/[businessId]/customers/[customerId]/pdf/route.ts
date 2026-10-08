import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import { resolveLoanStatus, deriveCustomerStatus, getGracePeriod } from '@/lib/loan-status'
import PDFDocument from 'pdfkit'
import { readFile } from 'fs/promises'
import path from 'path'

interface Props {
  params: Promise<{ businessId: string; customerId: string }>
}

function fmtPaise(paise: number): string {
  const r = paise / 100
  if (r === Math.floor(r)) return `Rs.${Math.floor(r).toLocaleString('en-IN')}`
  return `Rs.${r.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

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

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    include: {
      village: { select: { name: true } },
      loans: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, loanNumber: true, loanAmount: true, amountGiven: true,
          interestAmount: true, totalRepayable: true, installmentAmount: true,
          numberOfInstallments: true, collectionType: true, statusOverride: true, statusOverrideDate: true, startDate: true,
          expectedEndDate: true, status: true,
          agent: { select: { fullName: true } },
        },
      },
    },
  })
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true, gracePeriodDaily: true, gracePeriodWeekly: true, gracePeriodMonthly: true, defaulterPeriodDays: true } })

  const loanIds = customer.loans.map(l => l.id)
  const paidSums = loanIds.length > 0
    ? await prisma.payment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: loanIds }, isDeleted: false },
        _sum: { amount: true },
      })
    : []
  const paidMap = new Map(paidSums.map(p => [p.loanId, p._sum.amount || 0]))

  const loansWithPaid = customer.loans.map(l => {
    const paid = paidMap.get(l.id) || 0
    const derived = resolveLoanStatus(l, paid, getGracePeriod(business!, l.collectionType), l.collectionType, business!.defaulterPeriodDays)
    return { ...l, totalPaid: paid, outstanding: l.totalRepayable - paid, derivedStatus: derived }
  })

  const loanStatuses = loansWithPaid.map(l => l.derivedStatus)
  const customerStatus = deriveCustomerStatus(loanStatuses)
  const totalLent = customer.loans.reduce((s, l) => s + l.amountGiven, 0)
  const totalRepayable = customer.loans.reduce((s, l) => s + l.totalRepayable, 0)
  const totalPaid = loansWithPaid.reduce((s, l) => s + l.totalPaid, 0)
  const totalOutstanding = loansWithPaid.reduce((s, l) => s + l.outstanding, 0)

  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  // Header
  doc.fontSize(16).font('Helvetica-Bold').text(business?.name || 'Customer Details', { align: 'center' })
  doc.moveDown(0.3)
  doc.fontSize(10).font('Helvetica').text(`Customer: ${customer.fullName} (${customer.customerId})`, { align: 'center' })
  doc.moveDown(1)

  // Customer photo (passport size: 35mm × 45mm ≈ 99 × 127 pt)
  if (customer.photoPath) {
    try {
      const uploadBase = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads')
      const relPath = customer.photoPath.replace(/^\/uploads\//, '')
      const imgPath = path.join(uploadBase, relPath)
      const imgBuf = await readFile(imgPath)
      doc.image(imgBuf, doc.x, doc.y, { width: 99, height: 127 })
      doc.y += 135
    } catch {
      // Photo file missing — skip silently
    }
  }

  // Customer info
  doc.fontSize(11).font('Helvetica-Bold').text('Customer Information')
  doc.moveDown(0.3)
  doc.fontSize(9).font('Helvetica')

  const infoRows: [string, string][] = [
    ['Name', customer.fullName],
    ['Customer ID', customer.customerId],
    ['Phone', customer.phone],
    ...(customer.altPhone ? [['Alt Phone', customer.altPhone] as [string, string]] : []),
    ['Location', customer.village.name],
    ...(customer.address ? [['Address', customer.address] as [string, string]] : []),
    ...(customer.age ? [['Age', String(customer.age)] as [string, string]] : []),
    ...(customer.jobType ? [['Occupation', customer.jobType] as [string, string]] : []),
    ...(customer.guarantorName ? [['Guarantor', customer.guarantorName] as [string, string]] : []),
    ...(customer.guarantorPhone ? [['Guarantor Phone', customer.guarantorPhone] as [string, string]] : []),
    ['Status', customerStatus],
  ]

  for (const [label, value] of infoRows) {
    doc.text(`${label}: ${value}`)
  }

  doc.moveDown(0.8)

  // Financial summary
  doc.fontSize(11).font('Helvetica-Bold').text('Financial Summary')
  doc.moveDown(0.3)
  doc.fontSize(9).font('Helvetica')
  doc.text(`Total Lent: ${fmtPaise(totalLent)}`)
  doc.text(`Total Repayable: ${fmtPaise(totalRepayable)}`)
  doc.text(`Total Paid: ${fmtPaise(totalPaid)}`)
  doc.text(`Outstanding: ${fmtPaise(totalOutstanding)}`)
  doc.text(`Total Loans: ${customer.loans.length}`)

  doc.moveDown(0.8)

  // Loans
  if (loansWithPaid.length > 0) {
    doc.fontSize(11).font('Helvetica-Bold').text(`Loans (${loansWithPaid.length})`)
    doc.moveDown(0.4)

    for (const l of loansWithPaid) {
      if (doc.y > 700) doc.addPage()
      doc.fontSize(9).font('Helvetica-Bold').text(`${l.loanNumber} — ${l.derivedStatus}`)
      doc.font('Helvetica').fontSize(8)
      doc.text(`  Lent: ${fmtPaise(l.amountGiven)}  |  Repayable: ${fmtPaise(l.totalRepayable)}  |  Paid: ${fmtPaise(l.totalPaid)}  |  Due: ${fmtPaise(l.outstanding)}`)
      doc.text(`  ${l.collectionType}  |  ${fmtDate(l.startDate)} → ${fmtDate(l.expectedEndDate)}${l.agent ? `  |  Agent: ${l.agent.fullName}` : ''}`)
      doc.moveDown(0.4)
    }
  }

  doc.end()
  const buffer = await done

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${customer.customerId}-details.pdf"`,
    },
  })
}
