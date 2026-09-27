'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface Agent { id: string; fullName: string; role: string }
interface Village { id: string; name: string; _count: { customers: number } }
interface LoanEntry {
  id: string; loanNumber: string; installmentAmount: number
  totalRepayable: number; totalPaid: number; outstanding: number; status: string
}
interface CustomerEntry {
  id: string; customerId: string; fullName: string; phone: string
  loans: LoanEntry[]
}
interface PaymentRow {
  customerId: string; customerName: string; phone: string
  loanId: string; loanNumber: string; installmentAmount: number
  outstanding: number; amountStr: string
}

function formatPaiseShort(paise: number): string {
  const rupees = paise / 100
  if (rupees === Math.floor(rupees)) return `₹${Math.floor(rupees).toLocaleString('en-IN')}`
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  IN_GRACE: 'bg-yellow-100 text-yellow-700',
  DEFAULTER: 'bg-red-200 text-red-800',
  FROZEN: 'bg-blue-100 text-blue-700',
}

export default function VillageBulkPostingPage() {
  const params = useParams()
  const businessId = params.businessId as string

  const [agents, setAgents] = useState<Agent[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [selectedVillage, setSelectedVillage] = useState('')
  const [collectorId, setCollectorId] = useState('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  const [result, setResult] = useState<{ count: number; totalAmount: number } | null>(null)
  const [postingDate, setPostingDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const minDateStr = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  function formatDisplayDate(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    Promise.all([
      fetch(`/api/b/${businessId}/villages`).then(r => r.json()),
      fetch(`/api/b/${businessId}/users`).then(r => r.json()),
    ]).then(([vils, users]) => {
      if (Array.isArray(vils)) setVillages(vils)
      if (Array.isArray(users)) setAgents(users.filter((u: Agent) => u.role === 'AGENT'))
    }).catch(() => {})
  }, [businessId])

  const loadVillageData = useCallback(async (villageId: string) => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`/api/b/${businessId}/posting/village?villageId=${villageId}`)
      const customers: CustomerEntry[] = await res.json()
      if (!res.ok) {
        setError('Failed to load village data')
        setRows([])
        return
      }
      const paymentRows: PaymentRow[] = []
      customers.forEach(c => {
        c.loans.forEach(l => {
          if (l.outstanding > 0) {
            paymentRows.push({
              customerId: c.customerId,
              customerName: c.fullName,
              phone: c.phone,
              loanId: l.id,
              loanNumber: l.loanNumber,
              installmentAmount: l.installmentAmount,
              outstanding: l.outstanding,
              amountStr: '',
            })
          }
        })
      })
      setRows(paymentRows)
      inputRefs.current = new Array(paymentRows.length).fill(null)
    } catch {
      setError('Network error loading village data')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [businessId])

  function handleVillageChange(villageId: string) {
    setSelectedVillage(villageId)
    if (villageId) loadVillageData(villageId)
    else setRows([])
  }

  function handleAmountChange(index: number, value: string) {
    setRows(prev => {
      const next = [...prev]
      next[index] = { ...next[index], amountStr: value }
      return next
    })
  }

  function focusNext(index: number) {
    const nextIdx = index + 1
    if (nextIdx < rows.length && inputRefs.current[nextIdx]) {
      inputRefs.current[nextIdx]!.focus()
      inputRefs.current[nextIdx]!.select()
    }
  }

  const filledRows = rows.filter(r => {
    const amt = parseFloat(r.amountStr)
    return amt > 0
  })
  const totalEnteredPaise = filledRows.reduce((s, r) => s + Math.round(parseFloat(r.amountStr) * 100), 0)

  async function handleSubmit() {
    setError('')
    const payments = filledRows.map(r => ({
      loanId: r.loanId,
      amount: Math.round(parseFloat(r.amountStr) * 100),
    }))

    if (payments.length === 0) {
      setError('Enter at least one payment amount')
      return
    }

    // Validate amounts don't exceed outstanding
    for (const r of filledRows) {
      const amtPaise = Math.round(parseFloat(r.amountStr) * 100)
      if (amtPaise > r.outstanding) {
        setError(`₹${r.amountStr} exceeds outstanding ${formatPaiseShort(r.outstanding)} for ${r.customerName} (${r.loanNumber})`)
        return
      }
    }

    setPosting(true)
    try {
      const res = await fetch(`/api/b/${businessId}/payments/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments, paymentDate: postingDate, collectorId: collectorId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to post payments')
        return
      }
      setResult({ count: data.count, totalAmount: data.totalAmount })
    } catch {
      setError('Network error')
    } finally {
      setPosting(false)
    }
  }

  function handleReset() {
    setSelectedVillage('')
    setCollectorId('')
    setRows([])
    setResult(null)
    setError('')
  }

  function handleNewCollection() {
    if (selectedVillage) {
      setResult(null)
      setError('')
      loadVillageData(selectedVillage)
    } else {
      handleReset()
    }
  }

  const villageName = villages.find(v => v.id === selectedVillage)?.name || ''

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Village Bulk Posting</h1>
      <p className="text-sm text-gray-500 mb-6">Collect payments for all customers in a village at once</p>

      {error && (
        <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {/* ─── SUCCESS ─── */}
      {result && (
        <div className="text-center space-y-6">
          <div className="card p-6">
            <div className="w-16 h-16 rounded-full bg-success-100 text-success-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Bulk Payment Recorded</h2>
            <p className="text-sm text-gray-500 mb-2">Village: <span className="font-semibold text-gray-700">{villageName}</span></p>
            <p className="text-3xl font-bold text-success-600 mb-2">{formatPaiseShort(result.totalAmount)}</p>
            <p className="text-sm text-gray-500">{result.count} payment{result.count > 1 ? 's' : ''} posted</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleNewCollection} className="btn-primary flex-1">
              Collect Again ({villageName})
            </button>
            <button onClick={handleReset} className="btn-secondary flex-1">
              Different Village
            </button>
          </div>
        </div>
      )}

      {/* ─── MAIN FORM ─── */}
      {!result && (
        <>
          {/* Village Dropdown */}
          <div className="mb-5">
            <label className="label">Select Village *</label>
            <select
              className="input"
              value={selectedVillage}
              onChange={(e) => handleVillageChange(e.target.value)}
            >
              <option value="">— Choose a village —</option>
              {villages.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v._count.customers} customers)</option>
              ))}
            </select>
          </div>

          {/* Posting Date */}
          {selectedVillage && (
            <div className="mb-5 card p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Posting Date *</label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={postingDate}
                    onChange={(e) => setPostingDate(e.target.value)}
                    min={minDateStr}
                    max={todayStr}
                    required
                  />
                  {postingDate !== todayStr && (
                    <p className="text-[10px] text-amber-600 mt-1">Backdated to {formatDisplayDate(postingDate)}</p>
                  )}
                </div>
                <div>
                  <label className="label">Submission Date</label>
                  <input
                    type="text"
                    className="input text-sm bg-gray-50 cursor-not-allowed"
                    value={formatDisplayDate(todayStr)}
                    disabled
                  />
                </div>
              </div>
            </div>
          )}

          {/* Collected By */}
          {selectedVillage && (
            <div className="mb-5 card p-4">
              <label className="label">Who collected this payment?</label>
              {agents.length > 0 ? (
                <select className="input" value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
                  <option value="">Myself (logged-in user)</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
                </select>
              ) : (
                <p className="text-sm text-gray-400 py-2">No agents assigned to this business.</p>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
          )}

          {/* Customer Rows */}
          {!loading && rows.length > 0 && (
            <>
              <div className="text-sm text-gray-500 mb-3 flex items-center justify-between">
                <span>{rows.length} active loan{rows.length > 1 ? 's' : ''} in {villageName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setRows(prev => prev.map(r => ({
                      ...r,
                      amountStr: String(r.installmentAmount / 100),
                    })))
                  }}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  Fill All Installments
                </button>
              </div>

              <div className="space-y-2 mb-4">
                {rows.map((row, idx) => (
                  <div key={`${row.loanId}`} className="card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-mono w-5 shrink-0">{idx + 1}.</span>
                          <p className="text-sm font-semibold text-gray-900 truncate">{row.customerName}</p>
                        </div>
                        <div className="ml-7 space-y-0.5">
                          <p className="text-xs text-gray-500">{row.phone} &middot; {row.loanNumber}</p>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-500">Inst: <span className="font-semibold text-gray-700">{formatPaiseShort(row.installmentAmount)}</span></span>
                            <span className="text-gray-500">Out: <span className="font-semibold text-gray-900">{formatPaiseShort(row.outstanding)}</span></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                          <input
                            ref={el => { inputRefs.current[idx] = el }}
                            type="number"
                            className="input pl-6 pr-2 py-1.5 text-sm text-right font-semibold"
                            value={row.amountStr}
                            onChange={(e) => handleAmountChange(idx, e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusNext(idx) } }}
                            placeholder="0"
                            min={0}
                            step="any"
                          />
                        </div>
                        {idx < rows.length - 1 && (
                          <button
                            type="button"
                            onClick={() => focusNext(idx)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            aria-label="Next record"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary & Submit */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-3 pb-4 -mx-4 px-4">
                <div className="flex items-center justify-between mb-3 text-sm">
                  <span className="text-gray-500">
                    {filledRows.length} of {rows.length} payments entered
                  </span>
                  <span className="font-bold text-gray-900">
                    Total: {formatPaiseShort(totalEnteredPaise)}
                  </span>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={posting || filledRows.length === 0}
                  className="btn-primary w-full btn-lg disabled:opacity-50"
                >
                  {posting ? 'Posting...' : `Submit ${filledRows.length} Payment${filledRows.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}

          {!loading && selectedVillage && rows.length === 0 && !error && (
            <div className="card p-8 text-center text-gray-400">
              <p>No active loans with outstanding balance in this village</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
