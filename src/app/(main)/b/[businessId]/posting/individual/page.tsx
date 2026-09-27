'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'

interface Agent { id: string; fullName: string; role: string }
interface CustomerResult {
  id: string; customerId: string; fullName: string; phone: string
  village: { id: string; name: string }; status: string
}
interface LoanResult {
  id: string; loanNumber: string; totalRepayable: number; loanAmount: number
  installmentAmount: number; status: string; startDate: string
  customer: { fullName: string; customerId: string }
}
interface PaymentResult {
  _sum: { amount: number | null }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const mon = String(d.getMonth() + 1).padStart(2, '0')
  const yr = d.getFullYear()
  const hr = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${mon}/${yr} ${hr}:${min}`
}

function formatPaiseShort(paise: number): string {
  const rupees = paise / 100
  if (rupees === Math.floor(rupees)) return `₹${Math.floor(rupees).toLocaleString('en-IN')}`
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type Step = 'search' | 'selectLoan' | 'payment' | 'success'

const ACTIVE_STATUSES = ['ACTIVE', 'OVERDUE', 'IN_GRACE', 'DEFAULTER', 'FROZEN']

export default function RecordPaymentPage() {
  const params = useParams()
  const businessId = params.businessId as string

  const [step, setStep] = useState<Step>('search')
  const [agents, setAgents] = useState<Agent[]>([])
  const [customers, setCustomers] = useState<CustomerResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)

  const [customerLoans, setCustomerLoans] = useState<LoanResult[]>([])
  const [loanPaidMap, setLoanPaidMap] = useState<Record<string, number>>({})
  const [selectedLoan, setSelectedLoan] = useState<LoanResult | null>(null)
  const [loadingLoans, setLoadingLoans] = useState(false)

  const [amountStr, setAmountStr] = useState('')
  const [collectorId, setCollectorId] = useState('')
  const [note, setNote] = useState('')
  const [postingDate, setPostingDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

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

  const [receipt, setReceipt] = useState<{ receiptNumber: string; amount: number; createdAt: string; updatedAt: string } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/b/${businessId}/customers`).then(r => r.json()),
      fetch(`/api/b/${businessId}/users`).then(r => r.json()),
    ]).then(([custs, users]) => {
      if (Array.isArray(custs)) setCustomers(custs)
      if (Array.isArray(users)) setAgents(users.filter((u: Agent) => u.role === 'AGENT'))
    }).catch(() => {})
  }, [businessId])

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers.filter(c => c.status === 'ACTIVE').slice(0, 20)
    const q = searchQuery.toLowerCase()
    return customers.filter(c =>
      c.status === 'ACTIVE' && (
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.customerId.toLowerCase().includes(q)
      )
    )
  }, [customers, searchQuery])

  async function handleSelectCustomer(customer: CustomerResult) {
    setSelectedCustomer(customer)
    setLoadingLoans(true)
    setError('')
    try {
      const res = await fetch(`/api/b/${businessId}/loans?customerId=${customer.id}`)
      const loans = await res.json()
      const active = Array.isArray(loans)
        ? loans.filter((l: LoanResult) => ACTIVE_STATUSES.includes(l.status))
        : []
      setCustomerLoans(active)

      // Fetch paid amounts for each loan
      const paidMap: Record<string, number> = {}
      await Promise.all(active.map(async (loan: LoanResult) => {
        const pRes = await fetch(`/api/b/${businessId}/payments?loanId=${loan.id}`)
        const payments = await pRes.json()
        const total = Array.isArray(payments)
          ? payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
          : 0
        paidMap[loan.id] = total
      }))
      setLoanPaidMap(paidMap)

      if (active.length === 1) {
        setSelectedLoan(active[0])
        setStep('payment')
      } else if (active.length === 0) {
        setError('No active loans found for this customer')
        setStep('search')
      } else {
        setStep('selectLoan')
      }
    } catch {
      setError('Failed to load loans')
    } finally {
      setLoadingLoans(false)
    }
  }

  async function handlePostPayment(e: React.FormEvent, goNext = false) {
    e.preventDefault()
    if (!selectedLoan) return
    setError('')

    const amount = parseFloat(amountStr)
    if (!amount || amount <= 0) { setError('Enter a valid amount'); return }

    const amountPaise = Math.round(amount * 100)
    const outstanding = selectedLoan.totalRepayable - (loanPaidMap[selectedLoan.id] || 0)
    if (amountPaise > outstanding) {
      setError(`Amount exceeds outstanding balance of ${formatPaiseShort(outstanding)}`)
      return
    }

    setPosting(true)
    try {
      const res = await fetch(`/api/b/${businessId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: selectedLoan.id,
          amount: amountPaise,
          paymentDate: postingDate,
          collectorId: collectorId || undefined,
          note: note || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to post payment')
        return
      }
      if (goNext) {
        setStep('search')
        setSelectedCustomer(null)
        setSelectedLoan(null)
        setCustomerLoans([])
        setLoanPaidMap({})
        setAmountStr('')
        setCollectorId('')
        setNote('')
        setSearchQuery('')
        setError('')
      } else {
        setReceipt({ receiptNumber: data.receiptNumber, amount: data.amount, createdAt: data.createdAt, updatedAt: data.updatedAt })
        setStep('success')
      }
    } catch {
      setError('Network error')
    } finally {
      setPosting(false)
    }
  }

  function handleNewPayment() {
    setStep('search')
    setSelectedCustomer(null)
    setSelectedLoan(null)
    setCustomerLoans([])
    setLoanPaidMap({})
    setAmountStr('')
    setCollectorId('')
    setNote('')
    setReceipt(null)
    setError('')
    setSearchQuery('')
  }

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    OVERDUE: 'bg-red-100 text-red-700',
    IN_GRACE: 'bg-yellow-100 text-yellow-700',
    DEFAULTER: 'bg-red-200 text-red-800',
    FROZEN: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Record Payment</h1>
      <p className="text-sm text-gray-500 mb-6">Search a customer to record their payment</p>

      {error && (
        <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {loadingLoans && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      )}

      {/* ─── STEP 1: Search Customer ─── */}
      {step === 'search' && !loadingLoans && (
        <div className="space-y-4">
          <div>
            <label className="label">Search Customer</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                className="input pl-9"
                placeholder="Name, phone, or customer ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1 max-h-80 overflow-y-auto">
            {filteredCustomers.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectCustomer(c)}
                className="w-full text-left card p-3 flex items-center gap-3 hover:border-primary-300 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {c.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.fullName}</p>
                  <p className="text-xs text-gray-500">{c.customerId} &middot; {c.phone} &middot; {c.village.name}</p>
                </div>
              </button>
            ))}
            {filteredCustomers.length === 0 && searchQuery && (
              <p className="text-sm text-gray-400 text-center py-4">No matching customers found</p>
            )}
          </div>
        </div>
      )}

      {/* ─── STEP 2: Select Loan (if multiple) ─── */}
      {step === 'selectLoan' && selectedCustomer && (
        <div className="space-y-4">
          <div className="card p-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                  {selectedCustomer.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedCustomer.fullName}</p>
                  <p className="text-xs text-gray-500">{selectedCustomer.customerId} &middot; {selectedCustomer.phone}</p>
                </div>
              </div>
              <button onClick={handleNewPayment} className="text-xs text-gray-500">Change</button>
            </div>
          </div>

          <p className="text-sm font-medium text-gray-700">Select a loan to post payment:</p>

          <div className="space-y-2">
            {customerLoans.map((loan) => {
              const paid = loanPaidMap[loan.id] || 0
              const outstanding = loan.totalRepayable - paid
              const parts = loan.startDate.split('-')
              const dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : loan.startDate
              return (
                <button
                  key={loan.id}
                  onClick={() => { setSelectedLoan(loan); setStep('payment') }}
                  className="w-full text-left card p-3 hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">{loan.loanNumber}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[loan.status] || 'bg-gray-100 text-gray-600'}`}>
                      {loan.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Started {dateStr}</span>
                    <span className="font-semibold text-gray-900">Outstanding: {formatPaiseShort(outstanding)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── STEP 3: Enter Payment ─── */}
      {step === 'payment' && selectedCustomer && selectedLoan && (
        <form onSubmit={handlePostPayment} className="space-y-5">
          {/* Customer & Loan summary */}
          <div className="card p-3 bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                  {selectedCustomer.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedCustomer.fullName}</p>
                  <p className="text-xs text-gray-500">{selectedCustomer.customerId}</p>
                </div>
              </div>
              <button type="button" onClick={handleNewPayment} className="text-xs text-gray-500">Change</button>
            </div>
            <div className="border-t border-gray-200 pt-2 flex items-center justify-between text-sm">
              <div>
                <p className="font-semibold text-gray-900">{selectedLoan.loanNumber}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[selectedLoan.status] || 'bg-gray-100 text-gray-600'}`}>
                  {selectedLoan.status.replace(/_/g, ' ')}
                </span>
              </div>
              {customerLoans.length > 1 && (
                <button type="button" onClick={() => setStep('selectLoan')} className="text-xs text-primary-600">Change Loan</button>
              )}
            </div>
          </div>

          {/* Outstanding summary */}
          {(() => {
            const paid = loanPaidMap[selectedLoan.id] || 0
            const outstanding = selectedLoan.totalRepayable - paid
            const pctPaid = selectedLoan.totalRepayable > 0 ? Math.round((paid / selectedLoan.totalRepayable) * 100) : 0
            return (
              <div className="card p-4 space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Loan Summary</h2>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Repayable</span>
                    <span className="font-semibold text-gray-900">{formatPaiseShort(selectedLoan.totalRepayable)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Already Paid</span>
                    <span className="text-success-600 font-semibold">{formatPaiseShort(paid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold">Outstanding</span>
                    <span className="font-bold text-gray-900">{formatPaiseShort(outstanding)}</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(pctPaid, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 text-right">{pctPaid}% collected</p>

                {/* Expected installment hint */}
                <div className="bg-primary-50 rounded-lg px-3 py-2 text-xs text-primary-700">
                  Expected installment: {formatPaiseShort(selectedLoan.installmentAmount)}
                </div>
              </div>
            )
          })()}

          {/* Posting & Submission Date */}
          <div className="card p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Date</h2>
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

          {/* Collected By */}
          <div className="card p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Collected By</h2>
            <div>
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
          </div>

          {/* Payment amount */}
          <div className="card p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Payment</h2>

            <div>
              <label className="label">Amount (₹) *</label>
              <input
                type="number"
                className="input text-2xl font-bold text-center"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0"
                min={1}
                step="any"
                autoFocus
                required
              />
            </div>

            {/* Quick amount buttons */}
            {(() => {
              const paid = loanPaidMap[selectedLoan.id] || 0
              const outstanding = selectedLoan.totalRepayable - paid
              const outstandingRupees = outstanding / 100
              return (
                <div className="flex gap-2 flex-wrap">
                  {[100, 200, 500, 1000].filter(a => a * 100 <= outstanding).map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAmountStr(String(a))}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                    >
                      ₹{a.toLocaleString('en-IN')}
                    </button>
                  ))}
                  {outstandingRupees > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmountStr(String(outstandingRupees))}
                      className="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                    >
                      Full: ₹{outstandingRupees.toLocaleString('en-IN')}
                    </button>
                  )}
                </div>
              )
            })()}

            <div>
              <label className="label">Note (optional)</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid via cash" />
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={posting} className="btn-primary flex-1 btn-lg">
              {posting ? 'Posting...' : 'Post Payment'}
            </button>
            <button
              type="button"
              disabled={posting}
              onClick={(e) => handlePostPayment(e as unknown as React.FormEvent, true)}
              className="flex-1 btn-lg text-sm font-medium rounded-lg bg-success-600 text-white hover:bg-success-700 disabled:opacity-50 transition-colors"
            >
              {posting ? '...' : 'Post & Next'}
            </button>
            <button type="button" onClick={handleNewPayment} className="btn-secondary px-4">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ─── SUCCESS ─── */}
      {step === 'success' && receipt && selectedCustomer && selectedLoan && (
        <div className="text-center space-y-6">
          <div className="card p-6">
            <div className="w-16 h-16 rounded-full bg-success-100 text-success-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Payment Recorded</h2>
            <p className="text-3xl font-bold text-success-600 mb-2">{formatPaiseShort(receipt.amount)}</p>
            <div className="space-y-1 text-sm text-gray-500">
              <p>Receipt: <span className="font-mono font-semibold text-gray-700">{receipt.receiptNumber}</span></p>
              <p>Customer: <span className="font-semibold text-gray-700">{selectedCustomer.fullName}</span></p>
              <p>Loan: <span className="font-semibold text-gray-700">{selectedLoan.loanNumber}</span></p>
              <p>Posting Date: <span className="font-semibold text-gray-700">{formatDisplayDate(postingDate)}</span></p>
              {collectorId && <p>Collected By: <span className="font-semibold text-gray-700">{agents.find(a => a.id === collectorId)?.fullName}</span></p>}
              <p>Submitted: <span className="font-semibold text-gray-700">{formatDateTime(receipt.createdAt)}</span></p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleNewPayment} className="btn-primary flex-1">
              Record Another Payment
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
