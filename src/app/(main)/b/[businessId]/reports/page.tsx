'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

interface Column { key: string; label: string }

type Entity = 'customers' | 'loans' | 'villages' | 'employees' | 'payments' | 'payslips'
type RangePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom'

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

  const [preset, setPreset] = useState<RangePreset>('all')
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)
  const [entity, setEntity] = useState<Entity>('payslips')

  const [payslipDate, setPayslipDate] = useState(today)
  const [userRole, setUserRole] = useState<string>('')

  const [villages, setVillages] = useState<{ id: string; name: string }[]>([])
  const [villageId, setVillageId] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set())
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [columns, setColumns] = useState<Column[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [viewed, setViewed] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 200

  useEffect(() => {
    fetch('/api/auth/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data.role) {
          setUserRole(data.role)
          if (data.role === 'AGENT') setEntity('payslips')
          else if (entity === 'payslips') setEntity('customers')
        }
      })
      .catch(() => {})
    fetch(`/api/b/${businessId}/villages`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setVillages(data) })
      .catch(() => {})
  }, [businessId])

  function getDateRange(): { from: string; to: string } {
    if (entity === 'payslips') return { from: payslipDate, to: payslipDate }
    switch (preset) {
      case 'all':
        return { from: '2000-01-01', to: today }
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
      if (entity === 'loans' && selectedStatuses.size > 0) url += `&statuses=${Array.from(selectedStatuses).join(',')}`
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load report')
        return
      }
      setColumns(data.columns)
      setRows(data.rows)
      setCount(data.count)
      setPage(1)
      setViewed(true)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  function buildDownloadUrl(format: 'xlsx' | 'pdf') {
    const { from, to } = getDateRange()
    let url = `/api/b/${businessId}/reports/download?entity=${entity}&from=${from}&to=${to}&format=${format}`
    if (entity === 'villages' && villageId) url += `&villageId=${villageId}`
    if (entity === 'loans' && selectedStatuses.size > 0) url += `&statuses=${Array.from(selectedStatuses).join(',')}`
    return url
  }

  function handleDownload(format: 'xlsx' | 'pdf') {
    const url = buildDownloadUrl(format)
    const { from, to } = getDateRange()

    if (format === 'pdf') {
      window.open(url, '_blank')
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = `${entity}_report_${from}_${to}.xlsx`
      a.click()
    }
  }

  const [sharing, setSharing] = useState(false)

  async function handleWhatsAppShare(format: 'xlsx' | 'pdf') {
    const { from, to } = getDateRange()
    const url = buildDownloadUrl(format)

    const ext = format === 'pdf' ? 'pdf' : 'xlsx'
    const mime = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const fileName = `${entity}_report_${formatDD(from).replace(/\//g, '-')}_to_${formatDD(to).replace(/\//g, '-')}.${ext}`

    setSharing(true)
    setError('')

    try {
      const res = await fetch(url)
      if (!res.ok) { setError('Failed to generate report'); return }
      const blob = await res.blob()
      const file = new File([blob], fileName, { type: mime })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${entity.charAt(0).toUpperCase() + entity.slice(1)} Report`,
          text: `${entity.charAt(0).toUpperCase() + entity.slice(1)} Report (${formatDD(from)} – ${formatDD(to)})`,
          files: [file],
        })
      } else {
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = fileName
        a.click()
        URL.revokeObjectURL(blobUrl)

        const text = encodeURIComponent(`${entity.charAt(0).toUpperCase() + entity.slice(1)} Report (${formatDD(from)} – ${formatDD(to)})`)
        window.open(`https://wa.me/?text=${text}`, '_blank')
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError('Failed to share report')
      }
    } finally {
      setSharing(false)
    }
  }

  const presets: { value: RangePreset; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: '1 Month' },
    { value: 'custom', label: 'Custom' },
  ]

  const allEntities: { value: Entity; label: string }[] = [
    { value: 'customers', label: 'Customers' },
    { value: 'loans', label: 'Loans' },
    { value: 'payments', label: 'Payments' },
    { value: 'villages', label: 'Locations' },
    { value: 'employees', label: 'Employees' },
    { value: 'payslips', label: 'Pay Slips' },
  ]

  const entities = userRole === 'AGENT'
    ? allEntities.filter((e) => e.value === 'payslips')
    : allEntities

  const { from: rangeFrom, to: rangeTo } = getDateRange()

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Reports</h1>
      <p className="text-sm text-gray-500 mb-6">Generate and download business reports</p>

      {/* Filters */}
      <div className="card p-4 space-y-4 mb-6">
        {/* Date Range */}
        <div>
          {entity === 'payslips' ? (
            <>
              <label className="label">Collection Date</label>
              <input type="date" className="input max-w-xs" value={payslipDate} onChange={(e) => setPayslipDate(e.target.value)} />
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Entity */}
        <div>
          <label className="label">Report Type</label>
          <select
            className="input"
            value={entity}
            onChange={(e) => { setEntity(e.target.value as Entity); setViewed(false); setVillageId(''); setSelectedStatuses(new Set()) }}
          >
            {entities.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>

        {/* Status multi-select — shown when entity is Loans */}
        {entity === 'loans' && (
          <div>
            <label className="label">Status Filter</label>
            <div className="relative" ref={statusDropdownRef}>
              <button
                type="button"
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                className="input text-left flex items-center justify-between w-full"
              >
                <span className={selectedStatuses.size === 0 ? 'text-gray-400' : 'text-gray-900'}>
                  {selectedStatuses.size === 0
                    ? 'All Statuses'
                    : Array.from(selectedStatuses).map(s => s.replace(/_/g, ' ')).join(', ')}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {statusDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
                  {[
                    'ACTIVE', 'DEFAULTER', 'OVERDUE', 'COMPLETED', 'NO_LOANS',
                  ].map((s) => {
                    const checked = selectedStatuses.has(s)
                    return (
                      <label key={s} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedStatuses((prev) => {
                              const next = new Set(prev)
                              if (next.has(s)) next.delete(s)
                              else next.add(s)
                              return next
                            })
                            setViewed(false)
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-gray-700">{s.replace(/_/g, ' ')}</span>
                      </label>
                    )
                  })}
                  {selectedStatuses.size > 0 && (
                    <button
                      type="button"
                      onClick={() => { setSelectedStatuses(new Set()); setViewed(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-primary-600 hover:bg-gray-50 border-t border-gray-100"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>
            {selectedStatuses.size > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Array.from(selectedStatuses).map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700"
                  >
                    {s.replace(/_/g, ' ')}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStatuses((prev) => {
                          const next = new Set(prev)
                          next.delete(s)
                          return next
                        })
                        setViewed(false)
                      }}
                      className="text-primary-400 hover:text-primary-600"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Village selector — shown when entity is Villages */}
        {entity === 'villages' && (
          <div>
            <label className="label">Select Location</label>
            <select
              className="input"
              value={villageId}
              onChange={(e) => { setVillageId(e.target.value); setViewed(false) }}
            >
              <option value="">All Locations (Summary)</option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              {villageId ? 'Shows customers in the selected location' : 'Shows location-wise summary'}
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

        {/* WhatsApp Share */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleWhatsAppShare('pdf')}
            disabled={loading || sharing}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#25D366] text-white hover:bg-[#1da851] transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            {sharing ? 'Sharing...' : 'Share PDF'}
          </button>

          <button
            onClick={() => handleWhatsAppShare('xlsx')}
            disabled={loading || sharing}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#25D366] text-white hover:bg-[#1da851] transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            {sharing ? 'Sharing...' : 'Share XLSX'}
          </button>
        </div>
      </div>

      {/* Report Table */}
      {viewed && (() => {
        const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
        const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        const startIdx = (page - 1) * PAGE_SIZE

        return (
          <div className="card overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-900">
                  {entity === 'payslips' ? 'Pay Slips' : entity.charAt(0).toUpperCase() + entity.slice(1)} Report
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  {formatDD(rangeFrom)}{rangeFrom !== rangeTo ? ` – ${formatDD(rangeTo)}` : ''}
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
              <>
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
                      {pageRows.map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                          <td className="px-3 py-2 text-gray-400 text-xs">{startIdx + idx + 1}</td>
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, rows.length)} of {rows.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`px-2.5 py-1 text-xs rounded border ${page === p ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })()}
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
