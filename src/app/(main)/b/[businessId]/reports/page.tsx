'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface Column { key: string; label: string }

type Entity = 'customers' | 'loans' | 'villages' | 'employees' | 'payments'
type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom'

function todayISO() {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const ist = new Date(utc + 5.5 * 60 * 60 * 1000)
  const y = ist.getFullYear()
  const m = String(ist.getMonth() + 1).padStart(2, '0')
  const d = String(ist.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const ny = date.getFullYear()
  const nm = String(date.getMonth() + 1).padStart(2, '0')
  const nd = String(date.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

function formatDD(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ReportsPage() {
  const params = useParams()
  const businessId = params.businessId as string

  const today = todayISO()

  const [preset, setPreset] = useState<RangePreset>('today')
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)
  const [entity, setEntity] = useState<Entity>('customers')

  const [villages, setVillages] = useState<{ id: string; name: string }[]>([])
  const [villageId, setVillageId] = useState('')

  const [columns, setColumns] = useState<Column[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [viewed, setViewed] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/b/${businessId}/villages`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setVillages(data) })
      .catch(() => {})
  }, [businessId])

  function getDateRange(): { from: string; to: string } {
    switch (preset) {
      case 'yesterday':
        return { from: addDaysISO(today, -1), to: addDaysISO(today, -1) }
      case '7d':
        return { from: addDaysISO(today, -6), to: today }
      case '30d':
        return { from: addDaysISO(today, -29), to: today }
      case 'custom':
        return { from: customFrom, to: customTo }
      default:
        return { from: today, to: today }
    }
  }

  async function handleView() {
    setError('')
    setLoading(true)
    setViewed(false)
    const { from, to } = getDateRange()

    try {
      let url = `/api/b/${businessId}/reports?entity=${entity}&from=${from}&to=${to}`
      if (entity === 'villages' && villageId) url += `&villageId=${villageId}`
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load report')
        return
      }
      setColumns(data.columns)
      setRows(data.rows)
      setCount(data.count)
      setViewed(true)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  function handleDownload(format: 'xlsx' | 'pdf') {
    const { from, to } = getDateRange()
    let url = `/api/b/${businessId}/reports/download?entity=${entity}&from=${from}&to=${to}&format=${format}`
    if (entity === 'villages' && villageId) url += `&villageId=${villageId}`

    if (format === 'pdf') {
      window.open(url, '_blank')
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = `${entity}_report_${from}_${to}.xlsx`
      a.click()
    }
  }

  const presets: { value: RangePreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: '1 Month' },
    { value: 'custom', label: 'Custom' },
  ]

  const entities: { value: Entity; label: string }[] = [
    { value: 'customers', label: 'Customers' },
    { value: 'loans', label: 'Loans' },
    { value: 'payments', label: 'Payments' },
    { value: 'villages', label: 'Villages' },
    { value: 'employees', label: 'Employees' },
  ]

  const { from: rangeFrom, to: rangeTo } = getDateRange()

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Reports</h1>
      <p className="text-sm text-gray-500 mb-6">Generate and download business reports</p>

      {/* Filters */}
      <div className="card p-4 space-y-4 mb-6">
        {/* Date Range */}
        <div>
          <label className="label">Date Range</label>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPreset(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  preset === p.value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex gap-3 mt-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500">From</label>
                <input type="date" className="input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">To</label>
                <input type="date" className="input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Entity */}
        <div>
          <label className="label">Report Type</label>
          <select
            className="input"
            value={entity}
            onChange={(e) => { setEntity(e.target.value as Entity); setViewed(false); setVillageId('') }}
          >
            {entities.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>

        {/* Village selector — shown when entity is Villages */}
        {entity === 'villages' && (
          <div>
            <label className="label">Select Village</label>
            <select
              className="input"
              value={villageId}
              onChange={(e) => { setVillageId(e.target.value); setViewed(false) }}
            >
              <option value="">All Villages (Summary)</option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              {villageId ? 'Shows customers in the selected village' : 'Shows village-wise summary'}
            </p>
          </div>
        )}

        {error && (
          <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button onClick={handleView} disabled={loading} className="btn-primary flex-1 min-w-[120px]">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                View
              </span>
            )}
          </button>

          <button
            onClick={() => handleDownload('pdf')}
            disabled={loading}
            className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H6.75a2.25 2.25 0 0 0-2.25 2.25v16.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V14.25Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            PDF
          </button>

          <button
            onClick={() => handleDownload('xlsx')}
            disabled={loading}
            className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12c-.621 0-1.125.504-1.125 1.125M12 12c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125M12 15.375c-.621 0-1.125-.504-1.125-1.125v-1.5" />
            </svg>
            XLSX
          </button>
        </div>
      </div>

      {/* Report Table */}
      {viewed && (
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-900">
                {entity.charAt(0).toUpperCase() + entity.slice(1)} Report
              </span>
              <span className="text-xs text-gray-500 ml-2">
                {formatDD(rangeFrom)} – {formatDD(rangeTo)}
              </span>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
              {count} records
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400 text-sm">
              No records found for the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">#</th>
                    {columns.map((col) => (
                      <th key={col.key} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                      <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                      {columns.map((col) => (
                        <td key={col.key} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {formatCell(col.key, row[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatCell(key: string, value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number' && (key.includes('Amount') || key.includes('amount') || key.includes('expected') || key.includes('collected') || key.includes('pending') || key.includes('outstanding'))) {
    return `₹${value.toLocaleString('en-IN')}`
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatDD(value)
  }
  return String(value)
}
