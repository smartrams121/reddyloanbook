'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatDateDisplay } from '@/lib/date'

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  reason: string | null
  user: { fullName: string; username: string; role: string }
  createdAt: string
}

const ACTION_LABELS: Record<string, string> = {
  EDIT_LOAN: 'Edit Loan',
  DELETE_LOAN: 'Delete Loan',
  EDIT_CUSTOMER: 'Edit Customer',
  DELETE_CUSTOMER: 'Delete Customer',
  CUSTOMER_MERGE: 'Merge Customers',
  EDIT_PAYMENT: 'Edit Payment',
  CHANGE_PERMISSIONS: 'Change Permissions',
  SUSPEND_EMPLOYEE: 'Suspend Employee',
  ACTIVATE_EMPLOYEE: 'Activate Employee',
  DELETE_EMPLOYEE: 'Delete Employee',
  PASSWORD_RESET: 'Password Reset',
}

const ACTION_COLORS: Record<string, string> = {
  EDIT_LOAN: 'bg-amber-100 text-amber-700',
  DELETE_LOAN: 'bg-red-100 text-red-700',
  EDIT_CUSTOMER: 'bg-amber-100 text-amber-700',
  DELETE_CUSTOMER: 'bg-red-100 text-red-700',
  CUSTOMER_MERGE: 'bg-purple-100 text-purple-700',
  EDIT_PAYMENT: 'bg-orange-100 text-orange-700',
  CHANGE_PERMISSIONS: 'bg-blue-100 text-blue-700',
  SUSPEND_EMPLOYEE: 'bg-yellow-100 text-yellow-700',
  ACTIVATE_EMPLOYEE: 'bg-green-100 text-green-700',
  DELETE_EMPLOYEE: 'bg-red-100 text-red-700',
  PASSWORD_RESET: 'bg-gray-100 text-gray-700',
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') return JSON.stringify(val)
  if (typeof val === 'number' && val > 100) return `₹${(val / 100).toLocaleString('en-IN')}`
  return String(val)
}

export default function AuditLogsPage() {
  const params = useParams()
  const businessId = params.businessId as string
  const today = todayStr()

  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(daysAgo(7))
  const [toDate, setToDate] = useState(today)
  const [actionFilter, setActionFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      let url = `/api/b/${businessId}/audit-logs?from=${fromDate}&to=${toDate}`
      if (actionFilter) url += `&action=${actionFilter}`
      const res = await fetch(url)
      if (res.ok) setLogs(await res.json())
    } catch {}
    setLoading(false)
  }, [businessId, fromDate, toDate, actionFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const actions = Array.from(new Set(logs.map(l => l.action)))

  async function handleSharePdf() {
    setSharing(true)
    try {
      const url = `/api/b/${businessId}/audit-logs/pdf?from=${fromDate}&to=${toDate}${actionFilter ? `&action=${actionFilter}` : ''}`
      const res = await fetch(url)
      if (!res.ok) { setSharing(false); return }
      const blob = await res.blob()
      const file = new File([blob], `audit-logs-${fromDate}-${toDate}.pdf`, { type: 'application/pdf' })
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Audit Logs', files: [file] })
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.target = '_blank'
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(a.href), 3000)
      }
    } catch {}
    setSharing(false)
  }

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
        <button onClick={() => window.location.reload()} title="Refresh" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M2.985 19.644" />
          </svg>
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">Track all changes made by employees (retained 30 days)</p>

      {/* Filters */}
      <div className="card p-3 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Today', fn: () => { setFromDate(today); setToDate(today) } },
            { label: '7 Days', fn: () => { setFromDate(daysAgo(6)); setToDate(today) } },
            { label: '30 Days', fn: () => { setFromDate(daysAgo(29)); setToDate(today) } },
          ].map(p => (
            <button key={p.label} onClick={p.fn} className="px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label text-xs">From</label>
            <input type="date" className="input text-xs py-1.5" value={fromDate} onChange={e => setFromDate(e.target.value)} max={toDate} />
          </div>
          <div className="flex-1">
            <label className="label text-xs">To</label>
            <input type="date" className="input text-xs py-1.5" value={toDate} onChange={e => setToDate(e.target.value)} min={fromDate} max={today} />
          </div>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActionFilter('')} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${!actionFilter ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
            {Object.keys(ACTION_LABELS).map(a => (
              <button key={a} onClick={() => setActionFilter(actionFilter === a ? '' : a)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${actionFilter === a ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {ACTION_LABELS[a] || a}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        <button onClick={handleSharePdf} disabled={sharing || logs.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#25D366] text-white hover:bg-[#1da851] disabled:opacity-50 transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          {sharing ? '...' : 'Share PDF'}
        </button>
        <button onClick={() => { window.open(`/api/b/${businessId}/audit-logs/pdf?from=${fromDate}&to=${toDate}${actionFilter ? `&action=${actionFilter}` : ''}`, '_blank') }} disabled={logs.length === 0} className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H6.75a2.25 2.25 0 0 0-2.25 2.25v16.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V14.25Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          PDF
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm">No audit logs found for this period.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-2">{logs.length} entries</p>
          {logs.map(log => (
            <div key={log.id} className="card p-3">
              <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                    <span className="text-xs text-gray-500">{log.entityType} #{log.entityId.slice(-6)}</span>
                  </div>
                  <p className="text-xs text-gray-700 mt-1">
                    <span className="font-medium">{log.user.fullName}</span>
                    <span className="text-gray-400"> @{log.user.username} · {log.user.role === 'BUSINESS_ADMIN' ? 'Partner' : log.user.role}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-gray-500">{formatDateDisplay(log.createdAt.split('T')[0])}</p>
                  <p className="text-[10px] text-gray-400">{formatTime(log.createdAt)}</p>
                </div>
              </div>

              {expandedId === log.id && (log.oldValues || log.newValues) && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left py-1 pr-2 font-medium">Field</th>
                        <th className="text-left py-1 pr-2 font-medium">Before</th>
                        <th className="text-left py-1 font-medium">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const fields = Array.from(new Set(Object.keys(log.oldValues || {}).concat(Object.keys(log.newValues || {}))))
                        return fields.map(field => (
                          <tr key={field} className="border-t border-gray-50">
                            <td className="py-1.5 pr-2 font-medium text-gray-600">{field}</td>
                            <td className="py-1.5 pr-2 text-red-600">{formatValue(log.oldValues?.[field])}</td>
                            <td className="py-1.5 text-green-600">{formatValue(log.newValues?.[field])}</td>
                          </tr>
                        ))
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
