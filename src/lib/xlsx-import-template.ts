import ExcelJS from 'exceljs'

const HEADER_COLOR = 'FD5108'

function styleHeaders(ws: ExcelJS.Worksheet, headers: string[]) {
  const row = ws.addRow(headers)
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } }
    cell.alignment = { horizontal: 'center' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'CCCCCC' } } }
  })
}

export async function generateImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Daily Finance'
  wb.created = new Date()

  // Locations sheet
  const locWs = wb.addWorksheet('Locations')
  styleHeaders(locWs, ['Location Name', 'Status', 'Customers', 'Created'])
  locWs.addRow(['PM Palem', 'Active', 25, '01/10/2024'])
  locWs.addRow(['Madhurawada', 'Active', 18, '01/10/2024'])
  locWs.columns = [{ width: 20 }, { width: 12 }, { width: 12 }, { width: 14 }]

  // Customers sheet
  const custWs = wb.addWorksheet('Customers')
  styleHeaders(custWs, ['Customer ID', 'Full Name', 'Phone', 'Location', 'Status', 'Guarantor', 'Guarantor Phone', 'Address', 'Created'])
  custWs.addRow(['SF-C0001', 'Rajesh Kumar', '9876543210', 'PM Palem', 'ACTIVE', 'Suresh Kumar', '9123456789', 'Main Road', '01/10/2024'])
  custWs.addRow(['SF-C0002', 'Lakshmi Devi', '8765432109', 'Madhurawada', 'ACTIVE', '', '', '', '01/10/2024'])
  custWs.columns = [{ width: 14 }, { width: 18 }, { width: 14 }, { width: 16 }, { width: 10 }, { width: 16 }, { width: 16 }, { width: 20 }, { width: 14 }]

  // Loans sheet
  const loanWs = wb.addWorksheet('Loans')
  styleHeaders(loanWs, [
    'Loan Number', 'Customer ID', 'Customer Name', 'Loan Amount (₹)', 'Interest (₹)',
    'Total Repayable (₹)', 'Amount Given (₹)', 'Installment (₹)', 'No. Installments',
    'Collection Type', 'Status', 'Assigned Agent', 'Start Date', 'Expected End', 'Closed Date',
  ])
  loanWs.addRow(['SF-L00001', 'SF-C0001', 'Rajesh Kumar', '10000.00', '2000.00', '12000.00', '10000.00', '120.00', 100, 'DAILY', 'ACTIVE', 'Agent One', '01/10/2024', '15/02/2025', ''])
  loanWs.addRow(['SF-L00002', 'SF-C0002', 'Lakshmi Devi', '50000.00', '20000.00', '70000.00', '50000.00', '5833.00', 12, 'MONTHLY', 'ACTIVE', '', '01/10/2024', '01/10/2025', ''])
  loanWs.columns = Array.from({ length: 15 }, () => ({ width: 16 }))

  // Payments sheet
  const payWs = wb.addWorksheet('Payments')
  styleHeaders(payWs, ['Receipt No.', 'Customer ID', 'Customer Name', 'Loan Number', 'Amount (₹)', 'Payment Date', 'Collected By', 'Created'])
  payWs.addRow(['SF-00001', 'SF-C0001', 'Rajesh Kumar', 'SF-L00001', '120.00', '02/10/2024', 'Agent One', '02/10/2024'])
  payWs.addRow(['SF-00002', 'SF-C0001', 'Rajesh Kumar', 'SF-L00001', '120.00', '03/10/2024', 'Agent One', '03/10/2024'])
  payWs.columns = [{ width: 14 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 14 }]

  // Users sheet
  const userWs = wb.addWorksheet('Users')
  styleHeaders(userWs, ['Full Name', 'Username', 'Phone', 'Role', 'Status', 'Assigned Locations'])
  userWs.addRow(['Agent One', 'agent1', '9000000001', 'AGENT', 'Active', 'PM Palem, Madhurawada'])
  userWs.addRow(['Admin User', 'admin1', '9000000002', 'BUSINESS ADMIN', 'Active', ''])
  userWs.columns = [{ width: 18 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 10 }, { width: 28 }]

  // Instructions sheet
  const instrWs = wb.addWorksheet('Instructions')
  instrWs.getColumn(1).width = 80
  const instructions = [
    'BUSINESS DATA IMPORT — FORMAT GUIDE',
    '',
    'This template shows the exact format expected for importing business data.',
    'Your exported business XLSX file should match these sheet names and column headers.',
    '',
    'SHEETS:',
    '1. Locations — Business locations/villages. Required columns: Location Name, Status.',
    '2. Customers — Customer records. Required: Full Name, Phone, Location (must match a Location name).',
    '3. Loans — Loan records. Required: Customer ID (must match Customers sheet), Loan Amount, Total Repayable, Installment, No. Installments, Start Date.',
    '4. Payments — Payment records. Required: Loan Number (must match Loans sheet), Amount, Payment Date.',
    '5. Users — Employee accounts. Required: Full Name, Username. Only AGENT and BUSINESS ADMIN roles are imported.',
    '',
    'NOTES:',
    '- Money values should be in Rupees (e.g. 10000.00). They will be converted to paise internally.',
    '- Dates should be in DD/MM/YYYY format (e.g. 01/10/2024).',
    '- Customer IDs and Loan Numbers from the file are used only for cross-referencing. New IDs will be generated on import.',
    '- Receipt numbers will be auto-generated on import.',
    '- Employee passwords will be set to their username. They must change it on first login.',
    '- The OWNER row in Users sheet is skipped — you become the owner of the imported business.',
  ]
  instructions.forEach(line => {
    const row = instrWs.addRow([line])
    if (line === instructions[0]) {
      row.getCell(1).font = { bold: true, size: 14 }
    } else if (line.startsWith('SHEETS:') || line.startsWith('NOTES:')) {
      row.getCell(1).font = { bold: true, size: 11 }
    }
  })

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
