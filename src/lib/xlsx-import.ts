import ExcelJS from 'exceljs'

export interface ImportedVillage {
  name: string
  isActive: boolean
}

export interface ImportedUser {
  fullName: string
  username: string
  phone: string | null
  role: 'BUSINESS_ADMIN' | 'AGENT'
  isActive: boolean
  assignedLocations: string[]
}

export interface ImportedCustomer {
  exportId: string
  fullName: string
  phone: string
  villageName: string
  status: 'ACTIVE' | 'CLOSED'
  guarantorName: string | null
  guarantorPhone: string | null
  address: string | null
}

export interface ImportedLoan {
  exportLoanNumber: string
  exportCustomerId: string
  loanAmountPaise: number
  interestAmountPaise: number
  totalRepayablePaise: number
  amountGivenPaise: number
  installmentAmountPaise: number
  numberOfInstallments: number
  collectionType: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  status: string
  agentFullName: string | null
  startDate: string
  expectedEndDate: string
  closedAt: string | null
}

export interface ImportedPayment {
  exportLoanNumber: string
  amountPaise: number
  paymentDate: string
  collectedByFullName: string
}

export interface ImportError {
  sheet: string
  row: number
  field: string
  message: string
}

export interface ImportWarning {
  sheet: string
  message: string
}

export interface SheetResult {
  name: string
  rowCount: number
  passed: boolean
  errors: ImportError[]
}

export interface ParseResult {
  villages: ImportedVillage[]
  users: ImportedUser[]
  customers: ImportedCustomer[]
  loans: ImportedLoan[]
  payments: ImportedPayment[]
  errors: ImportError[]
  warnings: ImportWarning[]
  sheetResults: SheetResult[]
}

function cellStr(row: ExcelJS.Row, col: number): string {
  const cell = row.getCell(col)
  if (cell.value === null || cell.value === undefined) return ''
  if (cell.value instanceof Date) return cell.value.toLocaleDateString('en-IN')
  return String(cell.value).trim()
}

function cellNum(row: ExcelJS.Row, col: number): number | null {
  const raw = row.getCell(col).value
  if (raw === null || raw === undefined || raw === '') return null
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''))
  return isNaN(num) ? null : num
}

function getHeaderMap(ws: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>()
  const headerRow = ws.getRow(1)
  headerRow.eachCell((cell, colNumber) => {
    if (cell.value) {
      const label = String(cell.value).trim()
        .replace(/[₹]/g, 'Rs')
        .replace(/\(Rs\)/g, '(₹)')
      map.set(String(cell.value).trim(), colNumber)
    }
  })
  return map
}

function parseDDMMYYYY(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(value).trim()
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return s
  return null
}

function rupeesToPaise(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''))
  if (isNaN(num) || num < 0) return null
  return Math.round(num * 100)
}

function parseRole(value: string): 'BUSINESS_ADMIN' | 'AGENT' | null {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_')
  if (normalized === 'BUSINESS_ADMIN') return 'BUSINESS_ADMIN'
  if (normalized === 'AGENT') return 'AGENT'
  return null
}

const VALID_LOAN_STATUSES = new Set([
  'ACTIVE', 'OVERDUE', 'COMPLETED', 'PAUSED', 'SETTLED', 'WRITTEN_OFF',
])

function findCol(headers: Map<string, number>, ...candidates: string[]): number | null {
  for (const c of candidates) {
    const exact = headers.get(c)
    if (exact) return exact
    let found: number | null = null
    headers.forEach((val, key) => {
      if (!found && key.toLowerCase().includes(c.toLowerCase())) found = val
    })
    if (found) return found
  }
  return null
}

export async function parseBusinessXlsx(buffer: ArrayBuffer | Buffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)

  const errors: ImportError[] = []
  const warnings: ImportWarning[] = []
  const sheetResults: SheetResult[] = []

  // Parse Locations
  const villages: ImportedVillage[] = []
  const locWs = wb.getWorksheet('Locations')
  if (!locWs) {
    errors.push({ sheet: 'Locations', row: 0, field: '', message: 'Sheet "Locations" not found' })
    sheetResults.push({ name: 'Locations', rowCount: 0, passed: false, errors: [errors[errors.length - 1]] })
  } else {
    const locHeaders = getHeaderMap(locWs)
    const colName = findCol(locHeaders, 'Location Name')
    const colStatus = findCol(locHeaders, 'Status')
    const locErrors: ImportError[] = []

    if (!colName) {
      locErrors.push({ sheet: 'Locations', row: 0, field: 'Location Name', message: 'Column "Location Name" not found' })
    } else {
      locWs.eachRow((row, rowNum) => {
        if (rowNum === 1) return
        const name = cellStr(row, colName)
        if (!name || name === 'Internal Use Only') return
        const statusStr = colStatus ? cellStr(row, colStatus) : 'Active'
        villages.push({
          name,
          isActive: statusStr.toLowerCase() !== 'inactive',
        })
      })
    }
    errors.push(...locErrors)
    sheetResults.push({ name: 'Locations', rowCount: villages.length, passed: locErrors.length === 0, errors: locErrors })
  }

  // Parse Users
  const users: ImportedUser[] = []
  const userWs = wb.getWorksheet('Users')
  if (!userWs) {
    warnings.push({ sheet: 'Users', message: 'Sheet "Users" not found — no employees will be imported' })
    sheetResults.push({ name: 'Users', rowCount: 0, passed: true, errors: [] })
  } else {
    const userHeaders = getHeaderMap(userWs)
    const colFullName = findCol(userHeaders, 'Full Name')
    const colUsername = findCol(userHeaders, 'Username')
    const colPhone = findCol(userHeaders, 'Phone')
    const colRole = findCol(userHeaders, 'Role')
    const colStatus = findCol(userHeaders, 'Status')
    const colLocations = findCol(userHeaders, 'Assigned Locations')
    const userErrors: ImportError[] = []

    if (!colFullName || !colUsername) {
      userErrors.push({ sheet: 'Users', row: 0, field: 'Headers', message: 'Required columns "Full Name" and "Username" not found' })
    } else {
      userWs.eachRow((row, rowNum) => {
        if (rowNum === 1) return
        const fullName = cellStr(row, colFullName)
        if (!fullName || fullName === 'Internal Use Only') return
        const username = cellStr(row, colUsername)
        const roleStr = colRole ? cellStr(row, colRole) : 'AGENT'
        const role = parseRole(roleStr)
        if (!role) return // Skip OWNER and unknown roles

        if (!username) {
          userErrors.push({ sheet: 'Users', row: rowNum, field: 'Username', message: 'Username is required' })
          return
        }

        const statusStr = colStatus ? cellStr(row, colStatus) : 'Active'
        const locationsStr = colLocations ? cellStr(row, colLocations) : ''
        const assignedLocations = locationsStr
          ? locationsStr.split(',').map(s => s.trim()).filter(Boolean)
          : []

        users.push({
          fullName,
          username,
          phone: colPhone ? cellStr(row, colPhone) || null : null,
          role,
          isActive: statusStr.toLowerCase() !== 'inactive',
          assignedLocations,
        })
      })
    }
    errors.push(...userErrors)
    sheetResults.push({ name: 'Users', rowCount: users.length, passed: userErrors.length === 0, errors: userErrors })
  }

  // Parse Customers
  const customers: ImportedCustomer[] = []
  const custWs = wb.getWorksheet('Customers')
  if (!custWs) {
    errors.push({ sheet: 'Customers', row: 0, field: '', message: 'Sheet "Customers" not found' })
    sheetResults.push({ name: 'Customers', rowCount: 0, passed: false, errors: [errors[errors.length - 1]] })
  } else {
    const custHeaders = getHeaderMap(custWs)
    const colId = findCol(custHeaders, 'Customer ID')
    const colName = findCol(custHeaders, 'Full Name')
    const colPhone = findCol(custHeaders, 'Phone')
    const colVillage = findCol(custHeaders, 'Location')
    const colStatus = findCol(custHeaders, 'Status')
    const colGuarantor = findCol(custHeaders, 'Guarantor')
    const colGuarantorPhone = findCol(custHeaders, 'Guarantor Phone')
    const colAddress = findCol(custHeaders, 'Address')
    const custErrors: ImportError[] = []

    if (!colName || !colPhone || !colVillage) {
      custErrors.push({ sheet: 'Customers', row: 0, field: 'Headers', message: 'Required columns "Full Name", "Phone", "Location" not found' })
    } else {
      const villageNameSet = new Set(villages.map(v => v.name.toLowerCase()))

      custWs.eachRow((row, rowNum) => {
        if (rowNum === 1) return
        const fullName = cellStr(row, colName)
        if (!fullName || fullName === 'Internal Use Only') return

        const phone = cellStr(row, colPhone)
        const villageName = cellStr(row, colVillage)
        const exportId = colId ? cellStr(row, colId) : `ROW${rowNum}`

        if (!phone) {
          custErrors.push({ sheet: 'Customers', row: rowNum, field: 'Phone', message: `Phone is required for "${fullName}"` })
          return
        }
        if (!villageName) {
          custErrors.push({ sheet: 'Customers', row: rowNum, field: 'Location', message: `Location is required for "${fullName}"` })
          return
        }
        if (!villageNameSet.has(villageName.toLowerCase())) {
          custErrors.push({ sheet: 'Customers', row: rowNum, field: 'Location', message: `Location "${villageName}" not found in Locations sheet` })
          return
        }

        const statusStr = colStatus ? cellStr(row, colStatus) : 'ACTIVE'
        customers.push({
          exportId,
          fullName,
          phone,
          villageName,
          status: statusStr.toUpperCase() === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
          guarantorName: colGuarantor ? cellStr(row, colGuarantor) || null : null,
          guarantorPhone: colGuarantorPhone ? cellStr(row, colGuarantorPhone) || null : null,
          address: colAddress ? cellStr(row, colAddress) || null : null,
        })
      })
    }
    errors.push(...custErrors)
    sheetResults.push({ name: 'Customers', rowCount: customers.length, passed: custErrors.length === 0, errors: custErrors })
  }

  // Parse Loans
  const loans: ImportedLoan[] = []
  const loanWs = wb.getWorksheet('Loans')
  if (!loanWs) {
    warnings.push({ sheet: 'Loans', message: 'Sheet "Loans" not found — no loans will be imported' })
    sheetResults.push({ name: 'Loans', rowCount: 0, passed: true, errors: [] })
  } else {
    const loanHeaders = getHeaderMap(loanWs)
    const colLoanNum = findCol(loanHeaders, 'Loan Number')
    const colCustId = findCol(loanHeaders, 'Customer ID')
    const colLoanAmt = findCol(loanHeaders, 'Loan Amount')
    const colInterest = findCol(loanHeaders, 'Interest')
    const colTotal = findCol(loanHeaders, 'Total Repayable')
    const colGiven = findCol(loanHeaders, 'Amount Given')
    const colInstallment = findCol(loanHeaders, 'Installment')
    const colNumInst = findCol(loanHeaders, 'No. Installments')
    const colCollType = findCol(loanHeaders, 'Collection Type')
    const colStatus = findCol(loanHeaders, 'Status')
    const colAgent = findCol(loanHeaders, 'Assigned Agent')
    const colStart = findCol(loanHeaders, 'Start Date')
    const colEnd = findCol(loanHeaders, 'Expected End')
    const colClosed = findCol(loanHeaders, 'Closed Date')
    const loanErrors: ImportError[] = []

    if (!colCustId || !colLoanAmt || !colTotal || !colInstallment || !colNumInst || !colStart) {
      loanErrors.push({ sheet: 'Loans', row: 0, field: 'Headers', message: 'Required loan columns not found (Customer ID, Loan Amount, Total Repayable, Installment, No. Installments, Start Date)' })
    } else {
      const customerIdSet = new Set(customers.map(c => c.exportId.toUpperCase()))

      loanWs.eachRow((row, rowNum) => {
        if (rowNum === 1) return
        const custId = cellStr(row, colCustId)
        if (!custId || custId === 'Internal Use Only') return

        const exportLoanNumber = colLoanNum ? cellStr(row, colLoanNum) : `LOAN-ROW${rowNum}`

        if (!customerIdSet.has(custId.toUpperCase())) {
          loanErrors.push({ sheet: 'Loans', row: rowNum, field: 'Customer ID', message: `Customer "${custId}" not found in Customers sheet` })
          return
        }

        const loanAmt = rupeesToPaise(row.getCell(colLoanAmt).value)
        const interest = rupeesToPaise(row.getCell(colInterest || colLoanAmt).value) ?? 0
        const total = rupeesToPaise(row.getCell(colTotal).value)
        const given = rupeesToPaise(row.getCell(colGiven || colLoanAmt).value) ?? loanAmt
        const installment = rupeesToPaise(row.getCell(colInstallment).value)
        const numInst = cellNum(row, colNumInst)
        const startDate = parseDDMMYYYY(row.getCell(colStart).value)
        const endDate = colEnd ? parseDDMMYYYY(row.getCell(colEnd).value) : null
        const closedAt = colClosed ? parseDDMMYYYY(row.getCell(colClosed).value) : null
        const collType = colCollType ? cellStr(row, colCollType).toUpperCase() : 'DAILY'
        const status = colStatus ? cellStr(row, colStatus).toUpperCase() : 'ACTIVE'
        const agentName = colAgent ? cellStr(row, colAgent) || null : null

        if (loanAmt === null || loanAmt <= 0) {
          loanErrors.push({ sheet: 'Loans', row: rowNum, field: 'Loan Amount', message: `Invalid loan amount for loan "${exportLoanNumber}"` })
          return
        }
        if (total === null || total <= 0) {
          loanErrors.push({ sheet: 'Loans', row: rowNum, field: 'Total Repayable', message: `Invalid total repayable for loan "${exportLoanNumber}"` })
          return
        }
        if (installment === null || installment <= 0) {
          loanErrors.push({ sheet: 'Loans', row: rowNum, field: 'Installment', message: `Invalid installment for loan "${exportLoanNumber}"` })
          return
        }
        if (!numInst || numInst <= 0) {
          loanErrors.push({ sheet: 'Loans', row: rowNum, field: 'No. Installments', message: `Invalid installment count for loan "${exportLoanNumber}"` })
          return
        }
        if (!startDate) {
          loanErrors.push({ sheet: 'Loans', row: rowNum, field: 'Start Date', message: `Invalid start date for loan "${exportLoanNumber}"` })
          return
        }
        if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(collType)) {
          loanErrors.push({ sheet: 'Loans', row: rowNum, field: 'Collection Type', message: `Invalid collection type "${collType}" for loan "${exportLoanNumber}"` })
          return
        }
        if (!VALID_LOAN_STATUSES.has(status)) {
          loanErrors.push({ sheet: 'Loans', row: rowNum, field: 'Status', message: `Invalid status "${status}" for loan "${exportLoanNumber}"` })
          return
        }

        if (agentName) {
          const userNameSet = new Set(users.map(u => u.fullName.toLowerCase()))
          if (!userNameSet.has(agentName.toLowerCase())) {
            warnings.push({ sheet: 'Loans', message: `Row ${rowNum}: Agent "${agentName}" not found in Users sheet — will be unassigned` })
          }
        }

        loans.push({
          exportLoanNumber,
          exportCustomerId: custId,
          loanAmountPaise: loanAmt,
          interestAmountPaise: interest,
          totalRepayablePaise: total,
          amountGivenPaise: given ?? loanAmt,
          installmentAmountPaise: installment,
          numberOfInstallments: numInst,
          collectionType: collType as 'DAILY' | 'WEEKLY' | 'MONTHLY',
          status,
          agentFullName: agentName,
          startDate,
          expectedEndDate: endDate || startDate,
          closedAt,
        })
      })
    }
    errors.push(...loanErrors)
    sheetResults.push({ name: 'Loans', rowCount: loans.length, passed: loanErrors.length === 0, errors: loanErrors })
  }

  // Parse Payments
  const payments: ImportedPayment[] = []
  const payWs = wb.getWorksheet('Payments')
  if (!payWs) {
    warnings.push({ sheet: 'Payments', message: 'Sheet "Payments" not found — no payments will be imported' })
    sheetResults.push({ name: 'Payments', rowCount: 0, passed: true, errors: [] })
  } else {
    const payHeaders = getHeaderMap(payWs)
    const colLoanNum = findCol(payHeaders, 'Loan Number')
    const colAmount = findCol(payHeaders, 'Amount')
    const colDate = findCol(payHeaders, 'Payment Date')
    const colCollector = findCol(payHeaders, 'Collected By')
    const payErrors: ImportError[] = []

    if (!colLoanNum || !colAmount || !colDate) {
      payErrors.push({ sheet: 'Payments', row: 0, field: 'Headers', message: 'Required columns "Loan Number", "Amount", "Payment Date" not found' })
    } else {
      const loanNumSet = new Set(loans.map(l => l.exportLoanNumber.toUpperCase()))

      payWs.eachRow((row, rowNum) => {
        if (rowNum === 1) return
        const loanNum = cellStr(row, colLoanNum)
        if (!loanNum || loanNum === 'Internal Use Only') return

        if (!loanNumSet.has(loanNum.toUpperCase())) {
          payErrors.push({ sheet: 'Payments', row: rowNum, field: 'Loan Number', message: `Loan "${loanNum}" not found in Loans sheet` })
          return
        }

        const amount = rupeesToPaise(row.getCell(colAmount).value)
        const paymentDate = parseDDMMYYYY(row.getCell(colDate).value)
        const collectedBy = colCollector ? cellStr(row, colCollector) : ''

        if (amount === null || amount < 0) {
          payErrors.push({ sheet: 'Payments', row: rowNum, field: 'Amount', message: `Invalid payment amount at row ${rowNum}` })
          return
        }
        if (!paymentDate) {
          payErrors.push({ sheet: 'Payments', row: rowNum, field: 'Payment Date', message: `Invalid payment date at row ${rowNum}` })
          return
        }

        if (collectedBy) {
          const userNameSet = new Set(users.map(u => u.fullName.toLowerCase()))
          if (!userNameSet.has(collectedBy.toLowerCase())) {
            // Only add warning once per unique collector name
            const existing = warnings.find(w => w.message.includes(`"${collectedBy}"`))
            if (!existing) {
              warnings.push({ sheet: 'Payments', message: `Collector "${collectedBy}" not found in Users — payments will be assigned to you` })
            }
          }
        }

        payments.push({
          exportLoanNumber: loanNum,
          amountPaise: amount,
          paymentDate,
          collectedByFullName: collectedBy || '',
        })
      })
    }
    errors.push(...payErrors)
    sheetResults.push({ name: 'Payments', rowCount: payments.length, passed: payErrors.length === 0, errors: payErrors })
  }

  return { villages, users, customers, loans, payments, errors, warnings, sheetResults }
}
