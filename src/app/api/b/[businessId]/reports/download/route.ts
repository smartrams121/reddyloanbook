import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertBusinessAccess } from '@/lib/scope'
import { assertPermission } from '@/lib/permissions'
import ExcelJS from 'exceljs'

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
      assertPermission(user, 'view_all_reports')
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

  const { columns, rows } = reportData as {
    columns: { key: string; label: string }[]
    rows: Record<string, unknown>[]
  }

  if (format === 'pdf') {
    return generatePDF(businessName, entity, startDate, endDate, columns, rows)
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

function generatePDF(
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
    return Math.max(max * 7, 60)
  })
  const tableWidth = colWidths.reduce((a, b) => a + b, 0)
  const pageWidth = Math.max(tableWidth + 80, 800)

  const headerCells = columns
    .map((c, i) => `<th style="width:${colWidths[i]}px;padding:6px 8px;text-align:left;font-size:11px;color:#fff;background:#FD5108;border-bottom:2px solid #e5e7eb;">${c.label}</th>`)
    .join('')

  const dataRows = rows
    .map((row, idx) => {
      const bg = idx % 2 === 1 ? 'background:#fff5f0;' : ''
      const cells = columns
        .map((c) => `<td style="padding:5px 8px;font-size:11px;border-bottom:1px solid #f0f0f0;">${row[c.key] ?? ''}</td>`)
        .join('')
      return `<tr style="${bg}">${cells}</tr>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: landscape; margin: 20mm; }
  body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; }
  .footer { text-align: center; font-size: 9px; color: #999; margin-top: 24px; font-style: italic; }
</style>
</head>
<body>
  <h1>${businessName} — ${entityLabel} Report</h1>
  <div class="meta">Period: ${formatDD(from)} to ${formatDD(to)} &nbsp;|&nbsp; Total: ${rows.length} records &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString('en-IN')}</div>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${dataRows}</tbody>
  </table>
  <div class="footer">Internal Use Only</div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${entity}_report_${from}_${to}.html"`,
    },
  })
}

function formatDD(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
