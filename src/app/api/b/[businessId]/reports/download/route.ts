import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

interface Props {
  params: Promise<{ businessId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const entity = searchParams.get('entity') || 'customers'

  try {
    await assertBusinessAccess(user, businessId)
    if (entity !== 'payslips') {
      assertPermission(user, 'view_all_reports', businessId)
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }
  const startDate = searchParams.get('from')
  const endDate = searchParams.get('to')
  const format = searchParams.get('format') || 'xlsx'

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'from and to dates are required' }, { status: 400 })
  }

  const villageId = searchParams.get('villageId')
  const statuses = searchParams.get('statuses')
  const paymentStatus = searchParams.get('paymentStatus')

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } })
  const businessName = business?.name || 'Business'

  const origin = `http://localhost:${process.env.PORT || 3000}`
  let reportUrl = `${origin}/api/b/${businessId}/reports?entity=${entity}&from=${startDate}&to=${endDate}`
  if (villageId) reportUrl += `&villageId=${villageId}`
  if (statuses) reportUrl += `&statuses=${encodeURIComponent(statuses)}`

  const reportRes = await fetch(
    reportUrl,
    { headers: { cookie: request.headers.get('cookie') || '' } }
  )
  const reportData = await reportRes.json()

  if (!reportRes.ok) {
    return NextResponse.json(reportData, { status: reportRes.status })
  }

  let { columns, rows } = reportData as {
    columns: { key: string; label: string }[]
    rows: Record<string, unknown>[]
  }

  if (entity === 'daily_collection' && paymentStatus && paymentStatus !== 'all') {
    const target = paymentStatus === 'paid' ? 'Paid' : 'Unpaid'
    rows = rows.filter(r => r.paymentStatus === target)
  }

  if (format === 'pdf') {
    return await generatePDF(businessName, entity, startDate, endDate, columns, rows)
  }

  return generateXLSX(businessName, entity, startDate, endDate, columns, rows)
}

async function generateXLSX(
  businessName: string,
  entity: string,
  from: string,
  to: string,
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[]
) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Daily Finance'
  wb.created = new Date()

  const entityLabel = entity.charAt(0).toUpperCase() + entity.slice(1)
  const ws = wb.addWorksheet(`${entityLabel} Report`)

  // Title row
  ws.mergeCells(1, 1, 1, columns.length)
  const titleCell = ws.getCell('A1')
  titleCell.value = `${businessName} — ${entityLabel} Report`
  titleCell.font = { size: 14, bold: true }
  titleCell.alignment = { horizontal: 'center' }

  // Date range row
  ws.mergeCells(2, 1, 2, columns.length)
  const dateCell = ws.getCell('A2')
  dateCell.value = `Period: ${formatDD(from)} to ${formatDD(to)}`
  dateCell.font = { size: 10, italic: true, color: { argb: '666666' } }
  dateCell.alignment = { horizontal: 'center' }

  // Empty row
  ws.addRow([])

  // Header row
  const headerRow = ws.addRow(columns.map((c) => c.label))
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FD5108' } }
    cell.alignment = { horizontal: 'center' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
    }
  })

  // Data rows
  rows.forEach((row, idx) => {
    const dataRow = ws.addRow(columns.map((c) => row[c.key] ?? ''))
    if (idx % 2 === 1) {
      dataRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0' } }
      })
    }
  })

  // Auto-width columns
  columns.forEach((_, i) => {
    const col = ws.getColumn(i + 1)
    let maxLen = columns[i].label.length
    rows.forEach((row) => {
      const val = String(row[columns[i].key] ?? '')
      if (val.length > maxLen) maxLen = val.length
    })
    col.width = Math.min(maxLen + 4, 40)
  })

  // Footer
  const footerRowIdx = rows.length + 6
  ws.mergeCells(footerRowIdx, 1, footerRowIdx, columns.length)
  const footerCell = ws.getCell(footerRowIdx, 1)
  footerCell.value = 'Internal Use Only'
  footerCell.font = { size: 8, italic: true, color: { argb: '999999' } }
  footerCell.alignment = { horizontal: 'center' }

  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${entity}_report_${from}_${to}.xlsx"`,
    },
  })
}

async function generatePDF(
  businessName: string,
  entity: string,
  from: string,
  to: string,
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[]
) {
  const entityLabel = entity.charAt(0).toUpperCase() + entity.slice(1)

  const colWidths = columns.map((c) => {
    let max = c.label.length
    rows.forEach((r) => {
      const v = String(r[c.key] ?? '')
      if (v.length > max) max = v.length
    })
    return Math.min(Math.max(max * 6, 50), 180)
  })
  const totalColWidth = colWidths.reduce((a, b) => a + b, 0)

  const pageWidth = Math.max(totalColWidth + 80, 595)
  const pageHeight = 842
  const margin = 40

  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margins: { top: margin, bottom: margin, left: margin, right: margin },
    bufferPages: true,
  })

  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const pdfReady = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  const usableWidth = pageWidth - margin * 2
  const scale = totalColWidth > usableWidth ? usableWidth / totalColWidth : 1
  const scaledWidths = colWidths.map((w) => w * scale)

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#333333')
    .text(`${businessName} — ${entityLabel} Report`, margin, margin)

  doc.fontSize(9).font('Helvetica').fillColor('#666666')
    .text(
      `Period: ${formatDD(from)} to ${formatDD(to)}  |  Total: ${rows.length} records  |  Generated: ${new Date().toLocaleDateString('en-IN')}`,
      margin, doc.y + 4
    )

  const tableTop = doc.y + 14
  const rowHeight = 20
  const headerHeight = 24
  const fontSize = 8

  let y = tableTop

  function drawHeaderRow(yPos: number) {
    doc.rect(margin, yPos, usableWidth, headerHeight).fill('#FD5108')
    let x = margin
    doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#FFFFFF')
    columns.forEach((col, i) => {
      doc.text(col.label, x + 4, yPos + 6, { width: scaledWidths[i] - 8, ellipsis: true })
      x += scaledWidths[i]
    })
    return yPos + headerHeight
  }

  y = drawHeaderRow(y)

  doc.font('Helvetica').fillColor('#333333')

  rows.forEach((row, idx) => {
    if (y + rowHeight > pageHeight - margin - 20) {
      doc.addPage()
      y = margin
      y = drawHeaderRow(y)
      doc.font('Helvetica').fillColor('#333333')
    }

    if (idx % 2 === 1) {
      doc.rect(margin, y, usableWidth, rowHeight).fill('#FFF5F0')
      doc.fillColor('#333333')
    }

    doc.rect(margin, y, usableWidth, rowHeight).stroke('#EEEEEE')

    let x = margin
    doc.fontSize(fontSize)
    columns.forEach((col, i) => {
      const val = String(row[col.key] ?? '')
      doc.text(val, x + 4, y + 5, { width: scaledWidths[i] - 8, ellipsis: true })
      x += scaledWidths[i]
    })

    y += rowHeight
  })

  doc.fontSize(7).font('Helvetica-Oblique').fillColor('#999999')
    .text('Internal Use Only', margin, y + 16, { align: 'center', width: usableWidth })

  doc.end()

  const pdfBuffer = await pdfReady

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${entity}_report_${from}_${to}.pdf"`,
    },
  })
}

function formatDD(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
