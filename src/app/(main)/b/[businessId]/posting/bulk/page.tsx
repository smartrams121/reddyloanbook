'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

interface Agent { id: string; fullName: string; role: string }
interface Village { id: string; name: string; _count: { customers: number } }
interface LoanEntry {
  id: string; loanNumber: string; installmentAmount: number
  totalRepayable: number; totalPaid: number; outstanding: number; status: string
  agentId?: string | null; agentName?: string | null
  existingPayment?: { id: string; amount: number } | null
}
interface CustomerEntry {
  id: string; customerId: string; fullName: string; phone: string
  loans: LoanEntry[]
}
interface PaymentRow {
  customerId: string; customerName: string; phone: string
  loanId: string; loanNumber: string; installmentAmount: number
  outstanding: number; amountStr: string; status: string
  existingPaymentId?: string; existingAmountPaise?: number
}

function formatPaiseShort(paise: number): string {
  const rupees = paise / 100
  if (rupees === Math.floor(rupees)) return `₹${Math.floor(rupees).toLocaleString('en-IN')}`
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  DEFAULTER: 'bg-red-50 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
}

export default function VillageBulkPostingPage() {
  const { t } = useTranslation()
  const params = useParams()
  const searchParams = useSearchParams()
  const businessId = params.businessId as string
  const preVillageId = searchParams.get('villageId')

  const [agents, setAgents] = useState<Agent[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [selectedVillage, setSelectedVillage] = useState(preVillageId || 'all')
  const [collectorId, setCollectorId] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [showCompleted, setShowCompleted] = useState(false)
  const [showDefaulters, setShowDefaulters] = useState(false)
  const [isHoliday, setIsHoliday] = useState(false)
  const [allRows, setAllRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(false)
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

  const minDateStr = '2020-01-01'

  function formatDisplayDate(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  const [bulkPage, setBulkPage] = useState(0)
  const BULK_PAGE_SIZE = 10

  const statusFilteredRows = showDefaulters
    ? allRows.filter(r => r.status !== 'COMPLETED')
    : allRows.filter(r => r.status !== 'COMPLETED' && r.status !== 'DEFAULTER')
  const filteredRows = showCompleted
    ? statusFilteredRows.filter(r => r.existingPaymentId)
    : statusFilteredRows.filter(r => !r.existingPaymentId)

  const totalBulkPages = Math.ceil(filteredRows.length / BULK_PAGE_SIZE)
  const rows = filteredRows.slice(bulkPage * BULK_PAGE_SIZE, (bulkPage + 1) * BULK_PAGE_SIZE)

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

  const [initialLoaded, setInitialLoaded] = useState(false)

  const loadVillageData = useCallback(async (villageId: string) => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      let customers: CustomerEntry[] = []
      if (villageId === 'all') {
        const results = await Promise.all(
          villages.map(v => fetch(`/api/b/${businessId}/posting/village?villageId=${v.id}&date=${postingDate}`).then(r => r.json()))
        )
        customers = results.flat()
      } else {
        const res = await fetch(`/api/b/${businessId}/posting/village?villageId=${villageId}&date=${postingDate}`)
        if (!res.ok) {
          setError('Failed to load location data')
          setAllRows([])
          return
        }
        customers = await res.json()
      }
      const paymentRows: PaymentRow[] = []
      customers.forEach(c => {
        c.loans.forEach(l => {
          const existing = l.existingPayment
          const effectiveOutstanding = existing ? l.outstanding + existing.amount : l.outstanding
          if (effectiveOutstanding > 0 || existing) {
            paymentRows.push({
              customerId: c.customerId,
              customerName: c.fullName,
              phone: c.phone,
              loanId: l.id,
              loanNumber: l.loanNumber,
              installmentAmount: l.installmentAmount,
              outstanding: effectiveOutstanding,
              amountStr: existing ? String(existing.amount / 100) : isHoliday ? '0' : String(l.installmentAmount / 100),
              status: l.status,
              existingPaymentId: existing?.id,
              existingAmountPaise: existing?.amount,
            })
          }
        })
      })
      setAllRows(paymentRows)
      setBulkPage(0)
      // Set collector from first loan's agent
      const firstAgent = customers.find(c => c.loans.some(l => l.agentId))?.loans.find(l => l.agentId)
      if (firstAgent?.agentId) setCollectorId(firstAgent.agentId)
    } catch {
      setError('Network error loading location data')
      setAllRows([])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, postingDate, villages])

  useEffect(() => {
    if (!initialLoaded && villages.length > 0 && !preVillageId) {
      setInitialLoaded(true)
      loadVillageData('all')
    }
  }, [villages, initialLoaded, preVillageId, loadVillageData])

  const prevDateRef = useRef(postingDate)
  useEffect(() => {
    if (prevDateRef.current !== postingDate && selectedVillage) {
      loadVillageData(selectedVillage)
    }
    prevDateRef.current = postingDate
  }, [postingDate, selectedVillage, loadVillageData])

  const [preLoaded, setPreLoaded] = useState(false)
  useEffect(() => {
    if (preLoaded || !preVillageId || villages.length === 0) return
    if (villages.some(v => v.id === preVillageId)) {
      setPreLoaded(true)
      loadVillageData(preVillageId)
    }
  }, [preVillageId, villages, preLoaded, loadVillageData])

  function handleVillageChange(villageId: string) {
    setSelectedVillage(villageId)
    if (villageId && villages.length > 0) loadVillageData(villageId)
    else setAllRows([])
  }

  function handleAmountChange(index: number, value: string) {
    setAllRows(prev => {
      const row = rows[index]
      return prev.map(r => r.loanId === row.loanId ? { ...r, amountStr: value } : r)
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
    return !isNaN(amt) && amt >= 0 && r.amountStr.trim() !== ''
  })
  const totalEnteredPaise = filledRows.reduce((s, r) => s + Math.round(parseFloat(r.amountStr) * 100), 0)

  async function handleSubmit() {
    setError('')
    const payments = filledRows.map(r => ({
      loanId: r.loanId,
      amount: Math.round(parseFloat(r.amountStr) * 100),
      ...(r.existingPaymentId ? { existingPaymentId: r.existingPaymentId } : {}),
    }))

    if (payments.length === 0) {
      setError('Enter at least one payment amount')
      return
    }
    if (payments.length > 10) {
      setError(`Maximum 10 payments per submission. You have ${payments.length} filled. Clear some and submit in batches.`)
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
        body: JSON.stringify({ payments, paymentDate: postingDate, collectorId: collectorId || undefined, note: paymentMode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to post payments')
        return
      }
      setResult({ count: data.count, totalAmount: data.totalAmount })
      return true
    } catch {
      setError('Network error')
      return false
    } finally {
      setPosting(false)
    }
  }

  async function handleSubmitAndNext() {
    const ok = await handleSubmit()
    if (ok) {
      setResult(null)
      loadVillageData(selectedVillage)
    }
  }

  function handleReset() {
    setSelectedVillage('')
    setCollectorId('')
    setAllRows([])
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

  const villageName = selectedVillage === 'all' ? t('payments.all_locations') : (villages.find(v => v.id === selectedVillage)?.name || '')

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">{t('payments.bulk_posting')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('payments.collect_payments_subtitle')}</p>

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
            <h2 className="text-lg font-bold text-gray-900 mb-1">{t('payments.bulk_payment_recorded')}</h2>
            <p className="text-sm text-gray-500 mb-2">Location: <span className="font-semibold text-gray-700">{villageName}</span></p>
            <p className="text-3xl font-bold text-success-600 mb-2">{formatPaiseShort(result.totalAmount)}</p>
            <p className="text-sm text-gray-500">{result.count} payment{result.count > 1 ? 's' : ''} posted</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleNewCollection} className="btn-primary flex-1">
              Collect Again ({villageName})
            </button>
            <button onClick={handleReset} className="btn-secondary flex-1">
              {t('payments.select_location')}
            </button>
            <Link href={`/b/${businessId}/posting/view`} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg border border-teal-200 text-teal-600 hover:bg-teal-50 transition-colors text-center">
              {t('payments.view_payments')}
            </Link>
          </div>
        </div>
      )}

      {/* ─── MAIN FORM ─── */}
      {!result && (
        <>
          {/* Village Dropdown */}
          <div className="mb-5">
            <label className="label">{t('payments.select_location')} *</label>
            <select
              className="input"
              value={selectedVillage}
              onChange={(e) => handleVillageChange(e.target.value)}
            >
              <option value="all">{t('payments.all_locations')}</option>
              {villages.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v._count.customers} customers)</option>
              ))}
            </select>
          </div>

          {/* Details — collapsed by default */}
          {selectedVillage && (
            <div className="mb-5 card">
              <button type="button" onClick={() => setDetailsOpen(!detailsOpen)} className="w-full p-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('common.details')}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{formatDisplayDate(postingDate)}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </button>
              {detailsOpen && <div className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
                  <div>
                    <label className="label text-xs">{t('payments.posting_date')} *</label>
                    <input
                      type="date"
                      className="input w-full min-w-0 text-xs py-1.5"
                      value={postingDate}
                      onChange={(e) => setPostingDate(e.target.value)}
                      min={minDateStr}
                      max={todayStr}
                      required
                    />
                    {postingDate !== todayStr && (
                      <p className="text-[10px] text-amber-600 mt-1">Backdated</p>
                    )}
                  </div>
                  <div>
                    <label className="label text-xs">{t('payments.submission_date')}</label>
                    <input
                      type="text"
                      className="input w-full min-w-0 text-xs py-1.5 bg-gray-50 cursor-not-allowed"
                      value={formatDisplayDate(todayStr)}
                      disabled
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-xs">{t('payments.collected_by_question')}</label>
                  {agents.length > 0 ? (
                    <select className="input text-xs" value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
                      <option value="">Myself (logged-in employee)</option>
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
                    </select>
                  ) : (
                    <p className="text-xs text-gray-400 py-2">No agents assigned.</p>
                  )}
                </div>

                <div>
                  <label className="label text-xs">{t('payments.payment_mode')}</label>
                  <div className="flex gap-2">
                    {['Cash', 'UPI'].map((mode) => (
                      <button key={mode} type="button" onClick={() => setPaymentMode(mode)} className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors ${paymentMode === mode ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}>{mode}</button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                    <span className="text-xs text-gray-600">{t('payments.payment_completed')}</span>
                    <span className="text-xs text-gray-400">({showCompleted ? `${rows.length} paid` : `${rows.length} pending`})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showDefaulters} onChange={(e) => { setShowDefaulters(e.target.checked); setBulkPage(0) }} className="w-4 h-4 rounded border-gray-300 text-red-600" />
                    <span className="text-xs text-red-600 font-medium">{t('loans.status_defaulter')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isHoliday} onChange={(e) => {
                      const checked = e.target.checked
                      setIsHoliday(checked)
                      if (checked) {
                        setPaymentMode('Holiday')
                        setAllRows(prev => prev.map(r => ({ ...r, amountStr: '0' })))
                      } else {
                        setPaymentMode('Cash')
                        setAllRows(prev => prev.map(r => ({ ...r, amountStr: String(r.installmentAmount / 100) })))
                      }
                    }} className="w-4 h-4 rounded border-gray-300 text-red-600" />
                    <span className="text-xs text-red-600 font-medium">{t('payments.holiday')}</span>
                  </label>
                </div>
              </div>}
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
              <div className="text-sm text-gray-500 mb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Showing {bulkPage * BULK_PAGE_SIZE + 1}–{Math.min((bulkPage + 1) * BULK_PAGE_SIZE, filteredRows.length)} of {filteredRows.length} in {villageName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAllRows(prev => prev.map(r => ({
                        ...r,
                        amountStr: String(r.installmentAmount / 100),
                      })))
                    }}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700"
                  >
                    {t('common.fill_all')}
                  </button>
                </div>
                {totalBulkPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBulkPage(p => Math.max(0, p - 1))}
                      disabled={bulkPage === 0}
                      className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Prev 10
                    </button>
                    <span className="text-xs text-gray-500">Page {bulkPage + 1} of {totalBulkPages}</span>
                    <button
                      onClick={() => setBulkPage(p => Math.min(totalBulkPages - 1, p + 1))}
                      disabled={bulkPage >= totalBulkPages - 1}
                      className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Next 10
                    </button>
                    <button
                      onClick={() => loadVillageData(selectedVillage)}
                      className="px-2 py-1 text-xs rounded border border-primary-200 text-primary-600 hover:bg-primary-50"
                    >
                      {t('common.refresh')}
                    </button>
                  </div>
                )}
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
                            {row.existingPaymentId && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Paid {formatPaiseShort(row.existingAmountPaise || 0)}</span>
                            )}
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
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={posting || filledRows.length === 0}
                    className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    {posting ? 'Posting...' : `Submit ${filledRows.length}`}
                  </button>
                  <button
                    onClick={handleSubmitAndNext}
                    disabled={posting || filledRows.length === 0}
                    className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg bg-success-600 text-white hover:bg-success-700 disabled:opacity-50 transition-colors"
                  >
                    {posting ? '...' : t('payments.submit_and_next')}
                  </button>
                </div>
              </div>
            </>
          )}

          {!loading && selectedVillage && rows.length === 0 && !error && (
            <div className="card p-8 text-center text-gray-400">
              <p>{t('payments.no_active_loans_location')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
