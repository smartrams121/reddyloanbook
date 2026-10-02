'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatPaiseShort } from '@/lib/money'
import { formatDateDisplay } from '@/lib/date'

interface LoanData {
  id: string
  loanNumber: string
  loanAmount: number
  amountGiven: number
  totalRepayable: number
  installmentAmount: number
  collectionType: string
  startDate: string
  expectedEndDate: string
  status: string
  pausedAt: string | null
  customer: { id: string; fullName: string; customerId: string; phone: string }
  agent: { id: string; fullName: string } | null

  paid: number
}

interface LoanDetail {
  id: string
  loanNumber: string
  loanAmount: number
  interestAmount: number
  totalRepayable: number
  amountGiven: number
  interestModel: string
  collectionType: string
  collectionDay: string | null
  installmentAmount: number
  numberOfInstallments: number
  lastInstallmentAmount: number
  startDate: string
  expectedEndDate: string
  status: string
  pausedAt: string | null
  settlementAmount: number | null
  settlementReason: string | null
  writeOffReason: string | null
  closedAt: string | null
  notes: string | null
  createdAt: string
  renewedFromLoanId: string | null
  customer: { id: string; fullName: string; customerId: string; phone: string }
  agent: { id: string; fullName: string } | null
  schedule: { installmentNumber: number; dueDate: string; amount: number; status: string }[]
}

interface PaymentRecord {
  id: string
  receiptNumber: string
  amount: number
  paymentDate: string
  note: string | null
  collector: { id: string; fullName: string }
  createdAt: string
}

interface Props {
  loans: LoanData[]
  businessId: string
  isAdminOrOwner?: boolean
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'bg-green-100 text-green-700'
    case 'OVERDUE': return 'bg-amber-100 text-amber-700'
    case 'DEFAULTER': return 'bg-red-100 text-red-700'
    case 'COMPLETED': return 'bg-blue-50 text-blue-700'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function LoanDetailModal({ loan, businessId, onClose }: { loan: LoanDetail; businessId: string; onClose: () => void }) {
  function handleSharePdf() {
    window.open(`/api/b/${businessId}/loans/${loan.id}/pdf`, '_blank')
  }

  function handleShareWhatsApp() {
    const p = (v: number) => `Rs.${(v / 100).toLocaleString('en-IN')}`
    const lines = [
      `*Loan: ${loan.loanNumber}*`,
      `Customer: ${loan.customer.fullName} (${loan.customer.customerId})`,
      `Phone: ${loan.customer.phone}`,
      `Model: ${loan.interestModel === 'UPFRONT' ? 'Upfront' : 'Add-on'}`,
      `Principal: ${p(loan.loanAmount)}`,
      `Interest: ${p(loan.interestAmount)}`,
      `Total Repayable: ${p(loan.totalRepayable)}`,
      `Amount Given: ${p(loan.amountGiven)}`,
      `Installment: ${p(loan.installmentAmount)} x ${loan.numberOfInstallments}`,
      `Collection: ${loan.collectionType}`,
      `Start: ${formatDateDisplay(loan.startDate)}`,
      `End: ${formatDateDisplay(loan.expectedEndDate)}`,
      ...(loan.agent ? [`Agent: ${loan.agent.fullName}`] : []),
    ]
    const text = encodeURIComponent(lines.join('\n'))
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Loan Number', value: loan.loanNumber },
    { label: 'Customer', value: `${loan.customer.fullName} (${loan.customer.customerId})` },
    { label: 'Phone', value: loan.customer.phone },
    { label: 'Status', value: loan.status },
    { label: 'Interest Model', value: loan.interestModel === 'UPFRONT' ? 'Upfront' : 'Add-on' },
    { label: 'Collection Type', value: loan.collectionType },
    ...(loan.collectionDay ? [{ label: 'Collection Day', value: loan.collectionDay.charAt(0) + loan.collectionDay.slice(1).toLowerCase() }] : []),
    { label: 'Principal Amount', value: formatPaiseShort(loan.loanAmount) },
    { label: 'Interest Amount', value: formatPaiseShort(loan.interestAmount) },
    { label: 'Total Repayable', value: formatPaiseShort(loan.totalRepayable) },
    { label: 'Amount Given', value: formatPaiseShort(loan.amountGiven) },
    { label: 'Installment Amount', value: formatPaiseShort(loan.installmentAmount) },
    { label: 'Number of Installments', value: String(loan.numberOfInstallments) },
    { label: 'Last Installment', value: formatPaiseShort(loan.lastInstallmentAmount) },
    { label: 'Start Date', value: formatDateDisplay(loan.startDate) },
    { label: 'Expected End Date', value: formatDateDisplay(loan.expectedEndDate) },
    ...(loan.agent ? [{ label: 'Agent', value: loan.agent.fullName }] : []),
    ...(loan.notes ? [{ label: 'Notes', value: loan.notes }] : []),
    ...(loan.pausedAt ? [{ label: 'Paused At', value: formatDateDisplay(loan.pausedAt) }] : []),
    ...(loan.settlementAmount ? [{ label: 'Settlement Amount', value: formatPaiseShort(loan.settlementAmount) }] : []),
    ...(loan.settlementReason ? [{ label: 'Settlement Reason', value: loan.settlementReason }] : []),
    ...(loan.writeOffReason ? [{ label: 'Write-off Reason', value: loan.writeOffReason }] : []),
    ...(loan.closedAt ? [{ label: 'Closed At', value: formatDateDisplay(loan.closedAt) }] : []),
    { label: 'Created', value: new Date(loan.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-base font-bold text-gray-900">Loan Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-4 py-3 space-y-0">
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500">{r.label}</span>
              <span className="text-xs font-medium text-gray-900 text-right max-w-[60%]">{r.value}</span>
            </div>
          ))}
        </div>

        {loan.schedule && loan.schedule.length > 0 && (
          <div className="px-4 pb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Schedule ({loan.schedule.length} installments)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-2">Due Date</th>
                    <th className="py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.schedule.map((s) => (
                    <tr key={s.installmentNumber} className="border-b border-gray-50">
                      <td className="py-1.5 pr-2 text-gray-400">{s.installmentNumber}</td>
                      <td className="py-1.5 pr-2">{formatDateDisplay(s.dueDate)}</td>
                      <td className="py-1.5 text-right font-medium">{formatPaiseShort(s.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Share buttons */}
        <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
          <button
            onClick={handleSharePdf}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Share PDF
          </button>
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}

function PaymentHistoryModal({ payments, loanNumber, totalRepayable, onClose }: { payments: PaymentRecord[]; loanNumber: string; totalRepayable: number; onClose: () => void }) {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const outstanding = totalRepayable - totalPaid

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900">Payment History</h2>
            <p className="text-xs text-gray-500">{loanNumber} · {payments.length} payment{payments.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-4 py-3 bg-gray-50 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Repayable</p>
            <p className="text-sm font-bold text-gray-900">{formatPaiseShort(totalRepayable)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Paid</p>
            <p className="text-sm font-bold text-green-700">{formatPaiseShort(totalPaid)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Outstanding</p>
            <p className="text-sm font-bold text-red-700">{formatPaiseShort(outstanding)}</p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">No payments recorded yet.</div>
        ) : (
          <div className="px-4 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-2">Receipt</th>
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Collected By</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="py-2 pr-2 text-gray-500 font-mono">{p.receiptNumber}</td>
                    <td className="py-2 pr-2">{formatDateDisplay(p.paymentDate)}</td>
                    <td className="py-2 pr-2 text-gray-700">{p.collector.fullName}</td>
                    <td className="py-2 text-right font-medium text-green-700">{formatPaiseShort(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoanListClient({ loans, businessId, isAdminOrOwner = true }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [viewLoan, setViewLoan] = useState<LoanDetail | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null)
  const [paymentsLoan, setPaymentsLoan] = useState<{ loanNumber: string; totalRepayable: number } | null>(null)
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  const allIds = loans.map((l) => l.id)
  const allSelected = loans.length > 0 && selected.size === loans.length

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(allIds))
  }

  async function openViewLoan(loanId: string) {
    setViewLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/b/${businessId}/loans/${loanId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setViewLoan(data)
    } catch {
      setError('Failed to load loan details')
    } finally {
      setViewLoading(false)
    }
  }

  async function openPaymentHistory(loanId: string) {
    const loan = loans.find((l) => l.id === loanId)
    if (!loan) return
    setPaymentsLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/b/${businessId}/customers/${loan.customer.id}/loans/${loanId}/payments?limit=100`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPayments(data.payments || [])
      setPaymentsLoan({ loanNumber: loan.loanNumber, totalRepayable: loan.totalRepayable })
    } catch {
      setError('Failed to load payment history')
    } finally {
      setPaymentsLoading(false)
    }
  }

  async function executeBulk(action: 'delete') {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${selected.size} loan${selected.size > 1 ? 's' : ''}?\n\nThis will permanently remove the loans, payments, and schedule entries. This cannot be undone.`
    )
    if (!confirmed) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/b/${businessId}/loans/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanIds: Array.from(selected), action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Action failed')
        return
      }
      setSelected(new Set())
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const selectedLoanId = selected.size === 1 ? Array.from(selected)[0] : null

  return (
    <div className="space-y-2 relative">
      {/* Select All */}
      {isAdminOrOwner && loans.length > 0 && (
        <div className="flex items-center gap-2 mb-1">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-xs text-gray-500">
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </span>
        </div>
      )}

      {error && (
        <div className="bg-danger-50 text-danger-700 text-sm px-4 py-2 rounded-lg">{error}</div>
      )}

      {/* Loan Cards */}
      {loans.map((loan) => {
        const outstanding = loan.totalRepayable - loan.paid
        const progress = loan.totalRepayable > 0 ? Math.round((loan.paid / loan.totalRepayable) * 100) : 0
        const isSelected = selected.has(loan.id)

        return (
          <div
            key={loan.id}
            className={`card p-3 flex gap-3 items-start transition-colors ${isSelected ? 'ring-2 ring-primary-300 bg-primary-50/30' : ''}`}
          >
            {isAdminOrOwner && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleOne(loan.id)}
                className="w-4 h-4 mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 shrink-0"
              />
            )}
            <Link
              href={`/b/${businessId}/customers/${loan.customer.id}`}
              className="flex-1 min-w-0 block hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{loan.customer.fullName}</p>
                  <p className="text-xs text-gray-500">
                    {loan.loanNumber} &middot; {loan.customer.phone}
                    {loan.agent && <> · <span className="text-primary-600">{loan.agent.fullName}</span></>}
                  </p>
                </div>
                <div className="shrink-0 ml-2">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadgeClass(loan.status)}`}>
                    {loan.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>Lent: {formatPaiseShort(loan.amountGiven)}</span>
                <span>Repayable: {formatPaiseShort(loan.totalRepayable)}</span>
                <span>Due: {formatPaiseShort(outstanding)}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${progress >= 100 ? 'bg-success-500' : 'bg-primary-500'}`}
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">{progress}%</span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1.5">
                <span>{loan.collectionType} · {formatPaiseShort(loan.installmentAmount)}/inst</span>
                <span>Due: {formatDateDisplay(loan.expectedEndDate)} · Started {formatDateDisplay(loan.startDate)}</span>
              </div>
            </Link>
          </div>
        )
      })}

      {loans.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-gray-500 mb-4">No loans found.</p>
          {isAdminOrOwner && (
            <Link href={`/b/${businessId}/loans/new`} className="btn-primary">
              Create First Loan
            </Link>
          )}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg px-4 py-3 safe-area-inset-bottom">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">
              {selected.size} loan{selected.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              {selected.size === 1 && (
                <>
                  <button
                    onClick={() => openViewLoan(selectedLoanId!)}
                    disabled={viewLoading}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {viewLoading ? '...' : 'View'}
                  </button>
                  <button
                    onClick={() => openPaymentHistory(selectedLoanId!)}
                    disabled={paymentsLoading}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {paymentsLoading ? '...' : 'Payments'}
                  </button>
                  <button
                    onClick={() => router.push(`/b/${businessId}/loans/${selectedLoanId}/edit`)}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                  >
                    Edit
                  </button>
                </>
              )}
              <button
                onClick={() => executeBulk('delete')}
                disabled={loading}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-danger-600 text-white hover:bg-danger-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Loan Modal */}
      {viewLoan && (
        <LoanDetailModal loan={viewLoan} businessId={businessId} onClose={() => setViewLoan(null)} />
      )}

      {/* Payment History Modal */}
      {payments && paymentsLoan && (
        <PaymentHistoryModal
          payments={payments}
          loanNumber={paymentsLoan.loanNumber}
          totalRepayable={paymentsLoan.totalRepayable}
          onClose={() => { setPayments(null); setPaymentsLoan(null) }}
        />
      )}
    </div>
  )
}
