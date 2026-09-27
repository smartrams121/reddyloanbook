'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface CsvRow {
  fullName: string; phone: string; villageName: string; age?: string
  altPhone?: string; address?: string; aadhaar?: string; jobType?: string
  guarantorName?: string; guarantorPhone?: string; notes?: string
}

interface CsvRowError { row: number; field: string; message: string }

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else { current += ch }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { result.push(current); current = '' }
      else current += ch
    }
  }
  result.push(current)
  return result
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim() })
    return row as unknown as CsvRow
  })
}

interface Props {
  businessId: string
  villageNames: string[]
}

export default function CsvBulkUpload({ businessId, villageNames }: Props) {
  const router = useRouter()
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvErrors, setCsvErrors] = useState<CsvRowError[]>([])
  const [csvValidCount, setCsvValidCount] = useState(0)
  const [csvValidating, setCsvValidating] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [error, setError] = useState('')
  const [csvResult, setCsvResult] = useState<{ created: number; customers: { customerId: string; fullName: string }[] } | null>(null)

  function downloadTemplate() {
    const header = 'fullName,phone,villageName,age,altPhone,address,aadhaar,jobType,guarantorName,guarantorPhone,notes'
    const example1 = `Rajesh Kumar,9876543210,${villageNames[0] || 'Village1'},35,,Main Road Near Temple,,Shop,,,`
    const example2 = `Lakshmi Devi,8765432109,${villageNames[0] || 'Village1'},28,,,,Farmer,,Suresh Kumar,9123456789`
    const csv = [header, example1, example2].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'customer_import_template.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvResult(null)
    setCsvErrors([])
    setCsvRows([])
    setCsvValidCount(0)
    setError('')

    const text = await file.text()
    const rows = parseCsv(text)
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
      setCsvErrors(data.errors || [])
      setCsvValidCount(data.validCount || 0)
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
      setCsvResult(data)
      setCsvRows([])
      setCsvErrors([])
      setCsvValidCount(0)
      router.refresh()
    } catch {
      setError('Network error during import')
    } finally {
      setCsvImporting(false)
    }
  }

  function getRowErrors(rowNum: number) {
    return csvErrors.filter(e => e.row === rowNum)
  }

  return (
    <div className="card p-4 mb-4 space-y-3">
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

      {csvResult && (
        <div className="bg-success-50 rounded-lg p-3 space-y-2">
          <p className="text-sm font-semibold text-success-700">{csvResult.created} customers created successfully</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {csvResult.customers.map((c, i) => (
              <div key={i} className="text-xs text-success-600 flex justify-between">
                <span>{c.fullName}</span>
                <span className="font-mono">{c.customerId}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCsvResult(null)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {csvRows.length > 0 && !csvResult && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              {csvRows.length} rows &middot; <span className="text-success-600 font-medium">{csvValidCount} valid</span>
              {csvErrors.length > 0 && <> &middot; <span className="text-danger-600 font-medium">{csvErrors.length} error{csvErrors.length > 1 ? 's' : ''}</span></>}
            </p>
            <button
              type="button"
              onClick={() => { setCsvRows([]); setCsvErrors([]); setCsvValidCount(0) }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          </div>

          <div className="max-h-60 overflow-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-500">#</th>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-500">Name</th>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-500">Phone</th>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-500">Village</th>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {csvRows.map((row, idx) => {
                  const rowErrors = getRowErrors(idx + 1)
                  const isValid = rowErrors.length === 0
                  return (
                    <tr key={idx} className={isValid ? '' : 'bg-red-50'}>
                      <td className="px-2 py-1.5 text-gray-400">{idx + 1}</td>
                      <td className="px-2 py-1.5 text-gray-900">{row.fullName || '—'}</td>
                      <td className="px-2 py-1.5 text-gray-600">{row.phone || '—'}</td>
                      <td className="px-2 py-1.5 text-gray-600">{row.villageName || '—'}</td>
                      <td className="px-2 py-1.5">
                        {isValid ? (
                          <span className="text-success-600">Valid</span>
                        ) : (
                          <span className="text-danger-600" title={rowErrors.map(e => `${e.field}: ${e.message}`).join('; ')}>
                            {rowErrors[0].message}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {csvValidCount > 0 && (
            <button
              type="button"
              onClick={handleCsvImport}
              disabled={csvImporting}
              className="w-full text-sm font-medium px-4 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {csvImporting ? 'Importing...' : `Import ${csvValidCount} Valid Customer${csvValidCount > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
