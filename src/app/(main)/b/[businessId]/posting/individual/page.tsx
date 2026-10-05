'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

interface Agent { id: string; fullName: string; role: string }
interface CustomerResult {
  id: string; customerId: string; fullName: string; phone: string
  village: { id: string; name: string }; status: string
  _count?: { loans: number }
}
interface LoanResult {
  id: string; loanNumber: string; totalRepayable: number; loanAmount: number
  installmentAmount: number; status: string; startDate: string
  customer: { fullName: string; customerId: string }
  agent?: { id: string; fullName: string } | null
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


export default function RecordPaymentPage() {
  const { t } = useTranslation()
  const params = useParams()
  const searchParams = useSearchParams()
  const businessId = params.businessId as string
  const preCustomerId = searchParams.get('customerId')
  const preLoanId = searchParams.get('loanId')

  const [step, setStep] = useState<Step>('search')
  const [agents, setAgents] = useState<Agent[]>([])
  const [customers, setCustomers] = useState<CustomerResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
  const [filterDate, setFilterDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [showCompleted, setShowCompleted] = useState(false)
  const [paidCustomerIds, setPaidCustomerIds] = useState<Set<string>>(new Set())
  const [eligibleCustomerIds, setEligibleCustomerIds] = useState<Set<string> | null>(null)

  const [customerLoans, setCustomerLoans] = useState<LoanResult[]>([])
  const [loanPaidMap, setLoanPaidMap] = useState<Record<string, number>>({})
  const [selectedLoan, setSelectedLoan] = useState<LoanResult | null>(null)
  const [loadingLoans, setLoadingLoans] = useState(false)

  const [amountStr, setAmountStr] = useState('')
  const [collectorId, setCollectorId] = useState('')
  const [note, setNote] = useState('Cash')
  const [postingDate, setPostingDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [loanSummaryOpen, setLoanSummaryOpen] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const minDateStr = '2020-01-01'

  function formatDisplayDate(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  const [existingPaymentId, setExistingPaymentId] = useState<string | null>(null)
  const [existingAmountPaise, setExistingAmountPaise] = useState(0)
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

  useEffect(() => {
    Promise.all([
      fetch(`/api/b/${businessId}/payments?date=${filterDate}`).then(r => r.json()),
      fetch(`/api/b/${businessId}/loans?activeOnDate=${filterDate}`).then(r => r.json()),
    ]).then(([payments, loans]) => {
      if (Array.isArray(payments)) {
        setPaidCustomerIds(new Set(payments.map((p: { loan: { customer: { id: string } } }) => p.loan.customer.id)))
      }
      if (Array.isArray(loans)) {
        setEligibleCustomerIds(new Set(loans.map((l: { customer: { id: string } }) => l.customer.id)))
      }
    }).catch(() => {})
  }, [businessId, filterDate])

  const [preSelected, setPreSelected] = useState(false)
  useEffect(() => {
    if (preSelected || !preCustomerId || customers.length === 0) return
    const c = customers.find(cu => cu.id === preCustomerId)
    if (c) { setPreSelected(true); handleSelectCustomer(c) }
  }, [customers, preCustomerId, preSelected])

  useEffect(() => {
    if (!preLoanId || customerLoans.length === 0 || step !== 'selectLoan') return
    const loan = customerLoans.find(l => l.id === preLoanId)
    if (loan) { setSelectedLoan(loan); if (loan.agent) setCollectorId(loan.agent.id); setAmountStr(String(loan.installmentAmount / 100)); setStep('payment') }
  }, [customerLoans, preLoanId, step])

  const filteredCustomers = useMemo(() => {
    let list = customers.filter(c => c.status === 'ACTIVE' && (c._count?.loans || 0) > 0)

    // Only show customers with loans that started on or before filterDate
    if (eligibleCustomerIds) {
      list = list.filter(c => eligibleCustomerIds.has(c.id))
    }

    // Filter by payment status on filterDate
    list = list.filter(c =>
      showCompleted ? paidCustomerIds.has(c.id) : !paidCustomerIds.has(c.id)
    )

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(c =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.customerId.toLowerCase().includes(q)
      )
    }

    return list
  }, [customers, searchQuery, showCompleted, paidCustomerIds, eligibleCustomerIds])

  const checkExistingPayment = useCallback(async (loanId: string, date: string) => {
    try {
      const res = await fetch(`/api/b/${businessId}/payments?loanId=${loanId}&date=${date}`)
      const payments = await res.json()
      if (Array.isArray(payments) && payments.length > 0) {
        const p = payments[0]
        setExistingPaymentId(p.id)
        setExistingAmountPaise(p.amount)
        setAmountStr(String(p.amount / 100))
      } else {
        setExistingPaymentId(null)
        setExistingAmountPaise(0)
      }
    } catch {
      setExistingPaymentId(null)
      setExistingAmountPaise(0)
    }
  }, [businessId])

  useEffect(() => {
    if (selectedLoan && postingDate && step === 'payment') {
      checkExistingPayment(selectedLoan.id, postingDate)
    }
  }, [selectedLoan, postingDate, step, checkExistingPayment])

  async function handleSelectCustomer(customer: CustomerResult) {
    setSelectedCustomer(customer)
    setPostingDate(filterDate)
    setLoadingLoans(true)
    setError('')
    try {
      const res = await fetch(`/api/b/${businessId}/loans?customerId=${customer.id}`)
      const loans = await res.json()
      const active = Array.isArray(loans)
        ? loans.filter((l: LoanResult) => l.startDate <= postingDate)
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
        if (active[0].agent) setCollectorId(active[0].agent.id)
        setAmountStr(String(active[0].installmentAmount / 100))
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

  async function handlePostPayment(e: React.FormEvent, mode: 'receipt' | 'next' | 'nextDay' = 'receipt') {
    e.preventDefault()
    if (!selectedLoan) return
    setError('')

    const amount = parseFloat(amountStr)
    if (isNaN(amount) || amount < 0) { setError('Enter a valid amount'); return }

    const amountPaise = Math.round(amount * 100)
    const rawOutstanding = selectedLoan.totalRepayable - (loanPaidMap[selectedLoan.id] || 0)
    const effectiveOutstanding = rawOutstanding + existingAmountPaise
    if (amountPaise > effectiveOutstanding) {
      setError(`Amount exceeds outstanding balance of ${formatPaiseShort(effectiveOutstanding)}`)
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
          ...(existingPaymentId ? { existingPaymentId } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to post payment')
        return
      }
      if (mode === 'next') {
        // Mark current customer as paid and find next unpaid customer
        const currentId = selectedCustomer?.id
        setPaidCustomerIds(prev => {
          const next = new Set(prev)
          if (currentId) next.add(currentId)
          return next
        })

        // Find next unpaid customer from filtered list
        const pendingList = customers.filter(c =>
          c.status === 'ACTIVE' && (c._count?.loans || 0) > 0 &&
          !paidCustomerIds.has(c.id) && c.id !== currentId &&
          (!eligibleCustomerIds || eligibleCustomerIds.has(c.id))
        )

        if (pendingList.length > 0) {
          // Auto-select next customer
          const nextCust = pendingList[0]
          setSelectedCustomer(null)
          setSelectedLoan(null)
          setCustomerLoans([])
          setLoanPaidMap({})
          setAmountStr('')
          setCollectorId('')
          setNote('Cash')
          setError('')
          setExistingPaymentId(null)
          setExistingAmountPaise(0)
          // Trigger customer selection
          setTimeout(() => handleSelectCustomer(nextCust), 100)
        } else {
          // No more pending — go back to search
          setStep('search')
          setSelectedCustomer(null)
          setSelectedLoan(null)
          setCustomerLoans([])
          setLoanPaidMap({})
          setAmountStr('')
          setCollectorId('')
          setNote('Cash')
          setSearchQuery('')
          setError('')
          setExistingPaymentId(null)
          setExistingAmountPaise(0)
        }
      } else if (mode === 'nextDay') {
        // Advance posting date by 1 day, stay on same customer + loan
        const d = new Date(postingDate + 'T00:00:00')
        d.setDate(d.getDate() + 1)
        const nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        setPostingDate(nextDate)
        setAmountStr(String(selectedLoan.installmentAmount / 100))
        setExistingPaymentId(null)
        setExistingAmountPaise(0)
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
    setExistingPaymentId(null)
    setExistingAmountPaise(0)
  }

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    OVERDUE: 'bg-red-100 text-red-700',
    DEFAULTER: 'bg-red-50 text-red-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">{t('payments.record_payment')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('payments.search_payment_subtitle')}</p>

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
          {/* Date + Payment filter */}
          <div className="card p-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Date:</label>
              <input
                type="date"
                className="input text-xs py-1.5 w-auto"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                max={todayStr}
                min={minDateStr}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600"
              />
              <span className="text-xs text-gray-600">{t('payments.payment_completed')}</span>
            </label>
            <span className="text-xs text-gray-400">
              {showCompleted ? `${filteredCustomers.length} paid` : `${filteredCustomers.length} pending`}
            </span>
            <button
              type="button"
              onClick={() => {
                Promise.all([
                  fetch(`/api/b/${businessId}/payments?date=${filterDate}`).then(r => r.json()),
                  fetch(`/api/b/${businessId}/loans?activeOnDate=${filterDate}`).then(r => r.json()),
                ]).then(([payments, loans]) => {
                  if (Array.isArray(payments)) setPaidCustomerIds(new Set(payments.map((p: { loan: { customer: { id: string } } }) => p.loan.customer.id)))
                  if (Array.isArray(loans)) setEligibleCustomerIds(new Set(loans.map((l: { customer: { id: string } }) => l.customer.id)))
                }).catch(() => {})
              }}
              className="px-2 py-1 text-xs rounded border border-primary-200 text-primary-600 hover:bg-primary-50"
            >
              {t('common.refresh')}
            </button>
          </div>

          <div>
            <label className="label">{t('payments.search_customers')}</label>
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
              <button onClick={handleNewPayment} className="text-xs text-gray-500">{t('common.change')}</button>
            </div>
          </div>

          <p className="text-sm font-medium text-gray-700">{t('payments.select_location')}</p>

          <div className="space-y-2">
            {customerLoans.map((loan) => {
              const paid = loanPaidMap[loan.id] || 0
              const outstanding = loan.totalRepayable - paid
              const parts = loan.startDate.split('-')
              const dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : loan.startDate
              return (
                <button
                  key={loan.id}
                  onClick={() => { setSelectedLoan(loan); if (loan.agent) setCollectorId(loan.agent.id); setAmountStr(String(loan.installmentAmount / 100)); setStep('payment') }}
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
              <button type="button" onClick={handleNewPayment} className="text-xs text-gray-500">{t('common.change')}</button>
            </div>
            <div className="border-t border-gray-200 pt-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">{selectedLoan.loanNumber}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[selectedLoan.status] || 'bg-gray-100 text-gray-600'}`}>
                  {selectedLoan.status.replace(/_/g, ' ')}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${existingPaymentId ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {existingPaymentId ? 'Completed' : 'In Progress'}
                </span>
              </div>
              {customerLoans.length > 1 && (
                <button type="button" onClick={() => setStep('selectLoan')} className="text-xs text-primary-600">{t('common.change')}</button>
              )}
            </div>
          </div>

          {/* Loan Summary (collapsed by default, includes dates) */}
          {(() => {
            const paid = loanPaidMap[selectedLoan.id] || 0
            const outstanding = selectedLoan.totalRepayable - paid + existingAmountPaise
            const pctPaid = selectedLoan.totalRepayable > 0 ? Math.round(((paid - existingAmountPaise) / selectedLoan.totalRepayable) * 100) : 0
            return (
              <div className="card">
                <button type="button" onClick={() => setLoanSummaryOpen(!loanSummaryOpen)} className="w-full p-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('loans.loan_summary')}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">Outstanding: {formatPaiseShort(outstanding)}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${loanSummaryOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>
                {loanSummaryOpen && <div className="px-4 pb-4 space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('loans.total_repayable')}</span>
                      <span className="font-semibold text-gray-900">{formatPaiseShort(selectedLoan.totalRepayable)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('loans.total_paid')}</span>
                      <span className="text-success-600 font-semibold">{formatPaiseShort(paid)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-semibold">{t('loans.outstanding')}</span>
                      <span className="font-bold text-gray-900">{formatPaiseShort(outstanding)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(pctPaid, 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 text-right">{pctPaid}% collected</p>

                  <div className="bg-primary-50 rounded-lg px-3 py-2 text-xs text-primary-700">
                    Expected installment: {formatPaiseShort(selectedLoan.installmentAmount)}
                  </div>

                  {existingPaymentId && (
                    <div className="bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700">
                      Existing payment of {formatPaiseShort(existingAmountPaise)} found for {formatDisplayDate(postingDate)} — editing will update it
                    </div>
                  )}

                  {/* Agent Name */}
                  <div className="pt-2">
                    <label className="label">{t('payments.agent_name')}</label>
                    {agents.length > 0 ? (
                      <select className="input" value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
                        <option value="">Myself (logged-in employee)</option>
                        {agents.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-400 py-2">No agents assigned to this business.</p>
                    )}
                  </div>
                </div>}
              </div>
            )
          })()}

          {/* Payment */}
          <div className="card p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('payments.payments')}</h2>

            <div>
              <label className="label">{t('payments.posting_date')} *</label>
              <input
                type="date"
                className="input text-xs py-1.5"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
                min={selectedLoan.startDate > minDateStr ? selectedLoan.startDate : minDateStr}
                max={todayStr}
                required
              />
              {postingDate !== todayStr && (
                <p className="text-[10px] text-amber-600 mt-1">Backdated to {formatDisplayDate(postingDate)}</p>
              )}
            </div>

            <div>
              <label className="label">{t('payments.amount_rs')} *</label>
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
              const outstanding = selectedLoan.totalRepayable - paid + existingAmountPaise
              const outstandingRupees = outstanding / 100
              return (
                <div className="flex gap-2 flex-wrap">
                  {[0, 100, 200, 500, 1000].filter(a => a * 100 <= outstanding).map(a => (
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
              <label className="label">{t('payments.payment_mode')}</label>
              <div className="flex gap-2">
                {['Cash', 'UPI'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setNote(mode)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      note === mode
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={posting} className="btn-primary flex-1 text-sm font-medium rounded-lg px-3 py-2.5">
              {posting ? '...' : existingPaymentId ? t('common.update') : t('payments.post')}
            </button>
            <button
              type="button"
              disabled={posting}
              onClick={(e) => handlePostPayment(e as unknown as React.FormEvent, 'next')}
              className="flex-1 text-sm font-medium rounded-lg px-3 py-2.5 bg-success-600 text-white hover:bg-success-700 disabled:opacity-50 transition-colors"
            >
              {posting ? '...' : t('payments.post_and_new')}
            </button>
            <button
              type="button"
              disabled={posting}
              onClick={(e) => handlePostPayment(e as unknown as React.FormEvent, 'nextDay')}
              className="flex-1 text-sm font-medium rounded-lg px-3 py-2.5 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {posting ? '...' : t('payments.post_and_next_day')}
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
            <h2 className="text-lg font-bold text-gray-900 mb-1">{t('payments.payment_recorded')}</h2>
            <p className="text-3xl font-bold text-success-600 mb-2">{formatPaiseShort(receipt.amount)}</p>
            <div className="space-y-1 text-sm text-gray-500">
              <p>Receipt: <span className="font-mono font-semibold text-gray-700">{receipt.receiptNumber}</span></p>
              <p>Customer: <span className="font-semibold text-gray-700">{selectedCustomer.fullName}</span></p>
              <p>Loan: <span className="font-semibold text-gray-700">{selectedLoan.loanNumber}</span></p>
              <p>Posting Date: <span className="font-semibold text-gray-700">{formatDisplayDate(postingDate)}</span></p>
              {collectorId && <p>Collected By: <Link href={`/b/${businessId}/users/${collectorId}`} className="font-semibold text-primary-600 hover:underline">{agents.find(a => a.id === collectorId)?.fullName}</Link></p>}
              <p>Submitted: <span className="font-semibold text-gray-700">{formatDateTime(receipt.createdAt)}</span></p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleNewPayment} className="btn-primary flex-1">
              {t('payments.record_another_payment')}
            </button>
            <Link href={`/b/${businessId}/posting/view`} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg border border-teal-200 text-teal-600 hover:bg-teal-50 transition-colors text-center">
              {t('payments.view_payments')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
