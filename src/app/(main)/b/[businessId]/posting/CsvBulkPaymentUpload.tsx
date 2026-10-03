'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { parseCsv } from '@/lib/csv-parse'

interface CsvRow {
  loanNumber: string; amount: string; paymentDate: string
}

interface CsvRowError { row: number; field: string; message: string }

interface Props {
  businessId: string
}

export default function CsvBulkPaymentUpload({ businessId }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvErrors, setCsvErrors] = useState<CsvRowError[]>([])
  const [csvValidCount, setCsvValidCount] = useState(0)
  const [csvValidating, setCsvValidating] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [error, setError] = useState('')
  const [csvResult, setCsvResult] = useState<{ created: number; payments: { receiptNumber: string; loanNumber: string }[] } | null>(null)

  function downloadTemplate() {
    const header = 'loanNumber,amount,paymentDate'
    const ex1 = 'SF-L00001,120,02/10/2024'
    const ex2 = 'SF-L00002,5833,02/10/2024'
    const csv = [header, ex1, ex2].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'payment_import_template.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setCsvResult(null)
    setCsvErrors([])
    setCsvValidCount(0)

    const text = await file.text()
    const rows = parseCsv<CsvRow>(text)

    if (rows.length === 0) {
      setError('No data rows found in CSV')
      return
    }
    if (rows.length > 500) {
      setError('Maximum 500 payments per import')
      return
    }

    setCsvRows(rows)
    setCsvValidating(true)

    try {
      const res = await fetch(`/api/b/${businessId}/payments/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments: rows }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Validation failed'); return }
      setCsvErrors(data.errors || [])
      setCsvValidCount(data.validCount || 0)
    } catch {
      setError('Network error during validation')
    } finally {
      setCsvValidating(false)
    }
  }

  async function handleCsvImport() {
    setCsvImporting(true)
    setError('')
    try {
      const res = await fetch(`/api/b/${businessId}/payments/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments: csvRows, confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Import failed'); return }
      setCsvResult(data)
      setCsvRows([])
      setCsvErrors([])
      setCsvValidCount(0)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch {
      setError('Network error during import')
    } finally {
      setCsvImporting(false)
    }
  }

  function reset() {
    setCsvRows([])
    setCsvErrors([])
    setCsvValidCount(0)
    setCsvResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const errorsByRow = new Map<number, string>()
  csvErrors.forEach(e => {
    const existing = errorsByRow.get(e.row) || ''
    errorsByRow.set(e.row, existing ? `${existing}; ${e.message}` : e.message)
  })

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Bulk Upload (CSV)</h2>
        <div className="flex gap-2">
          <button type="button" onClick={downloadTemplate} className="text-xs text-primary-600 font-medium border border-primary-200 rounded-lg px-3 py-1.5 hover:bg-primary-50">
            Download Template
          </button>
          <label className="text-xs font-medium text-white bg-primary-600 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-primary-700">
            Upload CSV
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
          </label>
        </div>
      </div>

      {error && <div className="bg-danger-50 text-danger-700 text-xs px-3 py-2 rounded-lg">{error}</div>}

      {csvResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm font-medium text-green-700">Successfully created {csvResult.created} payments</p>
          <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
            {csvResult.payments.map((p, i) => (
              <p key={i} className="text-xs text-green-600">{p.receiptNumber} — Loan {p.loanNumber}</p>
            ))}
          </div>
        </div>
      )}

      {csvValidating && <p className="text-xs text-gray-500">Validating...</p>}

      {csvRows.length > 0 && !csvValidating && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Loan No.</th>
                  <th className="py-1 pr-2">Amount</th>
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {csvRows.map((row, i) => {
                  const rowErr = errorsByRow.get(i + 1)
                  return (
                    <tr key={i} className={`border-b ${rowErr ? 'bg-red-50' : ''}`}>
                      <td className="py-1 pr-2 text-gray-400">{i + 1}</td>
                      <td className="py-1 pr-2">{row.loanNumber}</td>
                      <td className="py-1 pr-2">{row.amount}</td>
                      <td className="py-1 pr-2">{row.paymentDate}</td>
                      <td className="py-1">
                        {rowErr
                          ? <span className="text-danger-600" title={rowErr}>Error</span>
                          : <span className="text-green-600">Valid</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            {csvValidCount > 0 && (
              <button onClick={handleCsvImport} disabled={csvImporting} className="btn-primary text-xs px-4 py-2">
                {csvImporting ? 'Importing...' : `Import ${csvValidCount} Valid Payments`}
              </button>
            )}
            <button onClick={reset} className="btn-secondary text-xs px-4 py-2">Clear</button>
          </div>
        </>
      )}
    </div>
  )
}
