'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { parseCsv } from '@/lib/csv-parse'

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

interface CsvRowError { row: number; field: string; message: string }

interface RowResult {
  rowNumber: number
  customerName: string
  status: 'imported' | 'skipped' | 'imported_with_warnings'
  errors: string[]
  warnings: string[]
}

interface CsvImportResponse {
  totalRows: number
  imported: number
  skipped: number
  warnings: number
  results: RowResult[]
}

interface Props {
  businessId: string
  villageNames: string[]
}

export default function CsvBulkUpload({ businessId, villageNames }: Props) {
  const router = useRouter()
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvValidating, setCsvValidating] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [error, setError] = useState('')
  const [csvResponse, setCsvResponse] = useState<CsvImportResponse | null>(null)
  const [isImported, setIsImported] = useState(false)

  function downloadTemplate() {
    // Row 1: Headers (14 columns)
    const headers = 'customerId,fullName,villageName,phone,age,altPhone,address,aadhaar,jobType,familyMemberName,familyRelation,guarantorName,guarantorPhone,notes'

    // Row 2: Instructions
    const instructions = [
      'OPTIONAL: Leave empty to auto-generate. Must be unique if provided',
      'REQUIRED',
      'REQUIRED: Must exactly match a village name in your Collection Settings',
      'OPTIONAL: 10-digit mobile number. Must be unique if provided.',
      'OPTIONAL: Number between 1 and 120',
      'OPTIONAL: 10-digit mobile number',
      'OPTIONAL: Full address',
      'OPTIONAL: 12-digit Aadhaar number',
      'OPTIONAL: Shop / Business / Farmer / Labour / Driver / Others',
      'OPTIONAL: Name of family member',
      'OPTIONAL: Husband / Wife / Son / Daughter / Brother / Sister / Mother / Father / Father-in-law / Mother-in-law / Son-in-law / Daughter-in-law',
      'OPTIONAL: Full name of guarantor',
      'OPTIONAL: 10-digit mobile number',
      'OPTIONAL: Any notes'
    ].map(s => `"${s}"`).join(',')

    // Row 3: Example data (with __EXAMPLE__ marker)
    const example = `__EXAMPLE__,Shankar Reddy,${villageNames[0] || 'PM Palem'},9553947222,34,9553947223,Flat 401 Sai Sampath Enclave,123456789012,Business,Lakshmi,Wife,Ravi Reddy,9553947224,Good customer`

    // Rows 4-13: 10 empty rows
    const emptyRows = Array(10).fill('')

    const csv = [headers, instructions, example, ...emptyRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'customers_upload_template.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvResponse(null)
    setCsvRows([])
    setIsImported(false)
    setError('')

    const text = await file.text()
    const rows = parseCsv<CsvRow>(text)
    if (rows.length === 0) {
      setError('CSV file is empty or has no data rows')
      if (csvInputRef.current) csvInputRef.current.value = ''
      return
    }
    if (rows.length > 500) {
      setError('Maximum 500 rows per import. Please split your file.')
      if (csvInputRef.current) csvInputRef.current.value = ''
      return
    }

    setCsvRows(rows)
    setCsvValidating(true)

    try {
      const res = await fetch(`/api/b/${businessId}/customers/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers: rows }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Validation failed'); return }
      setCsvResponse(data)
      setIsImported(false)
    } catch {
      setError('Network error during validation')
    } finally {
      setCsvValidating(false)
      if (csvInputRef.current) csvInputRef.current.value = ''
    }
  }

  async function handleCsvImport() {
    setCsvImporting(true)
    setError('')
    try {
      const res = await fetch(`/api/b/${businessId}/customers/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers: csvRows, confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Import failed'); return }
      setCsvResponse(data)
      setIsImported(true)
      setCsvRows([])
      router.refresh()
    } catch {
      setError('Network error during import')
    } finally {
      setCsvImporting(false)
    }
  }

  function resetUpload() {
    setCsvResponse(null)
    setCsvRows([])
    setIsImported(false)
    setError('')
    if (csvInputRef.current) csvInputRef.current.value = ''
  }

  function downloadErrorReport() {
    if (!csvResponse) return

    // Header row
    const headers = 'rowNumber,customerId,fullName,villageName,phone,age,altPhone,address,aadhaar,jobType,familyMemberName,familyRelation,guarantorName,guarantorPhone,notes,Errors'

    // Skipped rows only
    const skippedRows = csvResponse.results.filter(r => r.status === 'skipped')
    const csvLines = [headers]

    skippedRows.forEach(result => {
      const rowNum = result.rowNumber
      const dataRow = csvRows[rowNum - 1] // 0-indexed
      if (!dataRow) return

      const errors = result.errors.join('; ')
      const line = [
        rowNum,
        dataRow.customerId || '',
        dataRow.fullName || '',
        dataRow.villageName || '',
        dataRow.phone || '',
        dataRow.age || '',
        dataRow.altPhone || '',
        dataRow.address || '',
        dataRow.aadhaar || '',
        dataRow.jobType || '',
        dataRow.familyMemberName || '',
        dataRow.familyRelation || '',
        dataRow.guarantorName || '',
        dataRow.guarantorPhone || '',
        dataRow.notes || '',
        `"${errors}"`,
      ].map(v => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v)).join(',')

      csvLines.push(line)
    })

    const csv = csvLines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'customers_upload_errors.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }

  // Calculate stats
  const allImported = csvResponse?.imported ?? 0
  const allSkipped = csvResponse?.skipped ?? 0
  const allWarnings = csvResponse?.warnings ?? 0
  const hasErrors = allSkipped > 0
  const hasWarningsOnly = !hasErrors && allWarnings > 0

  return (
    <div className="card p-4 mb-4 space-y-3 hidden md:block">
      {!csvResponse ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Bulk Upload (CSV)</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Download Template
              </button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCsvUpload}
              />
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                disabled={csvValidating || csvImporting}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {csvValidating ? 'Validating...' : 'Upload CSV'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          {csvRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">
                  {csvRows.length} rows loaded
                </p>
                <button
                  type="button"
                  onClick={() => { setCsvRows([]) }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              </div>

              <button
                type="button"
                onClick={handleCsvImport}
                disabled={csvImporting}
                className="w-full text-sm font-medium px-4 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {csvImporting ? 'Importing...' : `Import ${csvRows.length} Customer${csvRows.length > 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">
              {isImported ? 'Upload Complete' : 'Preview — Review Before Importing'}
            </h3>
            <button
              type="button"
              onClick={resetUpload}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕ Close
            </button>
          </div>

          {error && (
            <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <div className="text-lg font-bold text-gray-900">{csvResponse.totalRows}</div>
              <div className="text-xs text-gray-500">Total Rows</div>
            </div>
            <div className="bg-success-50 p-3 rounded-lg text-center">
              <div className="text-lg font-bold text-success-700">{allImported}</div>
              <div className="text-xs text-success-600">Imported ✅</div>
            </div>
            <div className="bg-danger-50 p-3 rounded-lg text-center">
              <div className="text-lg font-bold text-danger-700">{allSkipped}</div>
              <div className="text-xs text-danger-600">Skipped ❌</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg text-center">
              <div className="text-lg font-bold text-yellow-700">{allWarnings}</div>
              <div className="text-xs text-yellow-600">Warnings ⚠️</div>
            </div>
          </div>

          {/* Banner */}
          {isImported ? (
            allSkipped === 0 && allWarnings === 0 ? (
              <div className="bg-success-50 border border-success-200 p-4 rounded-lg">
                <p className="text-sm font-semibold text-success-700">All {allImported} customers imported successfully!</p>
              </div>
            ) : allSkipped > 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm font-semibold text-yellow-700">{allImported} customers imported. {allSkipped} rows skipped.</p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm font-semibold text-blue-700">{allImported} customers imported with {allWarnings} warning{allWarnings > 1 ? 's' : ''}. Please review below.</p>
              </div>
            )
          ) : (
            allSkipped === 0 ? (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm font-semibold text-blue-700">{allImported} customers ready to import{allWarnings > 0 ? ` (${allWarnings} warning${allWarnings > 1 ? 's' : ''})` : ''}. Click Confirm Import to proceed.</p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm font-semibold text-yellow-700">{allImported} customers ready to import, {allSkipped} rows will be skipped due to errors. Click Confirm Import to proceed.</p>
              </div>
            )
          )}

          {/* Detail table */}
          {(hasErrors || hasWarningsOnly) && (
            <div className="max-h-96 overflow-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Row #</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Customer Name</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {csvResponse.results
                    .filter(r => r.status !== 'imported')
                    .sort((a, b) => {
                      if (a.status === 'skipped' && b.status !== 'skipped') return -1
                      if (a.status !== 'skipped' && b.status === 'skipped') return 1
                      return 0
                    })
                    .map(result => (
                      <tr
                        key={result.rowNumber}
                        className={result.status === 'skipped' ? 'bg-red-50' : 'bg-yellow-50'}
                      >
                        <td className="px-3 py-2 text-gray-600">{result.rowNumber}</td>
                        <td className="px-3 py-2 text-gray-900">{result.customerName}</td>
                        <td className="px-3 py-2">
                          {result.status === 'skipped' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-200 text-red-800">Error</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-200 text-yellow-800">Warning</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {result.status === 'skipped'
                            ? result.errors.join('; ')
                            : result.warnings.join('; ')}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            {isImported && hasErrors && (
              <button
                type="button"
                onClick={downloadErrorReport}
                className="text-xs px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Download Error Report
              </button>
            )}
            {isImported ? (
              <button
                type="button"
                onClick={resetUpload}
                className="text-xs px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors flex-1"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={resetUpload}
                  className="text-xs px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCsvImport}
                  disabled={csvImporting || allImported === 0}
                  className="text-xs px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors flex-1"
                >
                  {csvImporting ? 'Importing...' : `Confirm Import (${allImported} customers)`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
