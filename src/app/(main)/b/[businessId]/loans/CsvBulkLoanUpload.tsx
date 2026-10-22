'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { parseCsv } from '@/lib/csv-parse'

interface LoanRow {
  customerId?: string
  customerPhone?: string
  loanAmount: string
  interestAmount: string
  installmentAmount: string
  numberOfInstallments: string
  startDate: string
  agentPhone?: string
  notes?: string
}

interface RowResult {
  rowNumber: number
  customerName: string
  status: 'imported' | 'skipped' | 'imported_with_warnings'
  errors: string[]
  warnings: string[]
}

interface LoanImportResponse {
  totalRows: number
  imported: number
  skipped: number
  warnings: number
  results: RowResult[]
}

interface Props {
  businessId: string
}

export default function CsvBulkLoanUpload({ businessId }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [loanRows, setLoanRows] = useState<LoanRow[]>([])
  const [csvValidating, setCsvValidating] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [error, setError] = useState('')
  const [csvResponse, setCsvResponse] = useState<LoanImportResponse | null>(null)
  const [isImported, setIsImported] = useState(false)

  function downloadTemplate() {
    const headers = 'customerId,customerPhone,loanAmount,interestAmount,installmentAmount,numberOfInstallments,startDate,agentPhone,notes'

    const instructions = [
      'OPTIONAL: Customer ID (e.g. SDF-C0001). Leave blank to use phone',
      'OPTIONAL: 10-digit mobile. Required if Customer ID is blank',
      'REQUIRED: Loan principal amount (e.g. 10000)',
      'REQUIRED: Total interest amount (e.g. 2000). Use 0 for no interest',
      'REQUIRED: Amount per installment (e.g. 120)',
      'REQUIRED: Total number of installments (e.g. 100)',
      'REQUIRED: Start date in DD/MM/YYYY format (e.g. 01/10/2024)',
      'OPTIONAL: Agent\'s 10-digit mobile number',
      'OPTIONAL: Any notes about this loan',
    ].map(s => `"${s}"`).join(',')

    const example = '__EXAMPLE__,9553947222,10000,2000,120,100,01/10/2024,9553947223,Good customer'

    const emptyRows = Array(10).fill('')

    const csv = [headers, instructions, example, ...emptyRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'loans_upload_template.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvResponse(null)
    setLoanRows([])
    setIsImported(false)
    setError('')

    const text = await file.text()
    const rows = parseCsv<LoanRow>(text)

    if (rows.length === 0) {
      setError('CSV file is empty or has no data rows')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (rows.length > 200) {
      setError('Maximum 200 loans per import. Please split your file.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    setLoanRows(rows)
    setCsvValidating(true)

    try {
      const res = await fetch(`/api/b/${businessId}/loans/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loans: rows }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Validation failed'); return }
      setCsvResponse(data)
      setIsImported(false)
    } catch {
      setError('Network error during validation')
    } finally {
      setCsvValidating(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleCsvImport() {
    setCsvImporting(true)
    setError('')
    try {
      const res = await fetch(`/api/b/${businessId}/loans/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loans: loanRows, confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Import failed'); return }
      setCsvResponse(data)
      setIsImported(true)
      setLoanRows([])
      router.refresh()
    } catch {
      setError('Network error during import')
    } finally {
      setCsvImporting(false)
    }
  }

  function resetUpload() {
    setCsvResponse(null)
    setLoanRows([])
    setIsImported(false)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

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
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCsvUpload}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={csvValidating}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {csvValidating ? 'Validating...' : 'Upload CSV'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
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
                <p className="text-sm font-semibold text-success-700">All {allImported} loans imported successfully!</p>
              </div>
            ) : allSkipped > 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm font-semibold text-yellow-700">{allImported} loans imported. {allSkipped} rows skipped.</p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm font-semibold text-blue-700">{allImported} loans imported with {allWarnings} warning{allWarnings > 1 ? 's' : ''}.</p>
              </div>
            )
          ) : (
            allSkipped === 0 ? (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm font-semibold text-blue-700">{allImported} loans ready to import{allWarnings > 0 ? ` (${allWarnings} warning${allWarnings > 1 ? 's' : ''})` : ''}. Click Confirm Import to proceed.</p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm font-semibold text-yellow-700">{allImported} loans ready to import, {allSkipped} rows will be skipped due to errors. Click Confirm Import to proceed.</p>
              </div>
            )
          )}

          {/* Detail table for errors/warnings */}
          {(hasErrors || hasWarningsOnly) && (
            <div className="max-h-96 overflow-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Row #</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Customer</th>
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
                        <td className="px-3 py-2 text-gray-900">{result.customerName || '—'}</td>
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
                  {csvImporting ? 'Importing...' : `Confirm Import (${allImported} loan${allImported !== 1 ? 's' : ''})`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
