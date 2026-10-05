'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatPaiseShort } from '@/lib/money'
import { formatDateDisplay } from '@/lib/date'
import { useTranslation } from '@/lib/i18n'

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

function statusLabel(status: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    ACTIVE: t('loans.status_active'),
    OVERDUE: t('loans.status_overdue'),
    COMPLETED: t('loans.status_completed'),
    DEFAULTER: t('loans.status_defaulter'),
    PAUSED: t('loans.status_paused'),
    SETTLED: t('loans.status_settled'),
    WRITTEN_OFF: t('loans.status_written_off'),
    RENEWED: t('loans.status_renewed'),
  }
  return map[status] || status.replace(/_/g, ' ')
}

function LoanDetailModal({ loan, businessId, onClose }: { loan: LoanDetail; businessId: string; onClose: () => void }) {
  const { t } = useTranslation()

  function handleSharePdf() {
    const a = document.createElement('a')
    a.href = `/api/b/${businessId}/loans/${loan.id}/pdf`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
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
    const a = document.createElement('a')
    a.href = `https://wa.me/?text=${text}`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const rows: { label: string; value: string }[] = [
    { label: t('loans.loan_number'), value: loan.loanNumber },
    { label: t('customers.customer_name'), value: `${loan.customer.fullName} (${loan.customer.customerId})` },
    { label: t('common.phone'), value: loan.customer.phone },
    { label: t('common.status'), value: statusLabel(loan.status, t) },
    { label: t('loans.interest_model'), value: loan.interestModel === 'UPFRONT' ? t('loans.interest_model_upfront') : t('loans.interest_model_added') },
    { label: t('loans.collection_type'), value: loan.collectionType },
    ...(loan.collectionDay ? [{ label: t('loans.collection_day'), value: loan.collectionDay.charAt(0) + loan.collectionDay.slice(1).toLowerCase() }] : []),
    { label: t('loans.principal_amount'), value: formatPaiseShort(loan.loanAmount) },
    { label: t('loans.interest_amount'), value: formatPaiseShort(loan.interestAmount) },
    { label: t('loans.total_repayable'), value: formatPaiseShort(loan.totalRepayable) },
    { label: t('loans.amount_given'), value: formatPaiseShort(loan.amountGiven) },
    { label: t('loans.installment'), value: formatPaiseShort(loan.installmentAmount) },
    { label: t('loans.num_installments'), value: String(loan.numberOfInstallments) },
    { label: t('loans.last_installment'), value: formatPaiseShort(loan.lastInstallmentAmount) },
    { label: t('loans.start_date'), value: formatDateDisplay(loan.startDate) },
    { label: t('loans.end_date'), value: formatDateDisplay(loan.expectedEndDate) },
    ...(loan.agent ? [{ label: t('loans.agent'), value: loan.agent.fullName }] : []),
    ...(loan.notes ? [{ label: t('common.notes'), value: loan.notes }] : []),
    ...(loan.pausedAt ? [{ label: t('common.paused_at'), value: formatDateDisplay(loan.pausedAt) }] : []),
    ...(loan.settlementAmount ? [{ label: t('loans.settlement_amount'), value: formatPaiseShort(loan.settlementAmount) }] : []),
    ...(loan.settlementReason ? [{ label: t('loans.settlement_reason'), value: loan.settlementReason }] : []),
    ...(loan.writeOffReason ? [{ label: t('loans.write_off_reason'), value: loan.writeOffReason }] : []),
    ...(loan.closedAt ? [{ label: t('common.closed_at'), value: formatDateDisplay(loan.closedAt) }] : []),
    { label: t('common.created'), value: new Date(loan.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-base font-bold text-gray-900">{t('loans.loan_details')}</h2>
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
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('loans.repayment_schedule')} ({loan.schedule.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-2">{t('loans.due_date')}</th>
                    <th className="py-1.5 text-right">{t('common.amount')}</th>
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
  const { t } = useTranslation()
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
            <h2 className="text-base font-bold text-gray-900">{t('payments.view_payments')}</h2>
            <p className="text-xs text-gray-500">{loanNumber} · {payments.length}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-4 py-3 bg-gray-50 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-gray-500 uppercase">{t('loans.total_repayable')}</p>
            <p className="text-sm font-bold text-gray-900">{formatPaiseShort(totalRepayable)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">{t('payments.paid')}</p>
            <p className="text-sm font-bold text-green-700">{formatPaiseShort(totalPaid)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">{t('loans.outstanding')}</p>
            <p className="text-sm font-bold text-red-700">{formatPaiseShort(outstanding)}</p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">{t('payments.no_payments')}</div>
        ) : (
          <div className="px-4 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-2">{t('common.receipt')}</th>
                  <th className="py-2 pr-2">{t('common.date')}</th>
                  <th className="py-2 pr-2">{t('payments.collected_by')}</th>
                  <th className="py-2 text-right">{t('common.amount')}</th>
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

const PAGE_SIZES = [15, 25, 50, 100, 0] as const

export default function LoanListClient({ loans, businessId, isAdminOrOwner = true }: Props) {
  const router = useRouter()
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 15)
  const [sortField, setSortField] = useState<string>('customer')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [viewLoan, setViewLoan] = useState<LoanDetail | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null)
  const [paymentsLoan, setPaymentsLoan] = useState<{ loanNumber: string; totalRepayable: number } | null>(null)
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  function toggleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }
  const sortIcon = (field: string) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const sorted = [...loans].sort((a, b) => {
    let va: string | number = '', vb: string | number = ''
    switch (sortField) {
      case 'customer': va = a.customer.fullName; vb = b.customer.fullName; break
      case 'loanNumber': va = a.loanNumber; vb = b.loanNumber; break
      case 'startDate': va = a.startDate; vb = b.startDate; break
      case 'lent': va = a.amountGiven; vb = b.amountGiven; break
      case 'due': va = a.totalRepayable - a.paid; vb = b.totalRepayable - b.paid; break
      case 'agent': va = a.agent?.fullName || ''; vb = b.agent?.fullName || ''; break
      case 'status': va = a.status; vb = b.status; break
    }
    if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va
    return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })

  const showAll = pageSize === 0
  const totalPages = showAll ? 1 : Math.ceil(sorted.length / pageSize)
  const pagedLoans = showAll ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize)

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
    <div className="relative">
      {error && (
        <div className="bg-danger-50 text-danger-700 text-sm px-4 py-2 rounded-lg mb-2">{error}</div>
      )}

      {/* Loan Table */}
      {loans.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 mb-4">{t('loans.no_loans')}</p>
          {isAdminOrOwner && (
            <Link href={`/b/${businessId}/loans/new`} className="btn-primary">
              {t('loans.new_loan_btn')}
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-gray-500 bg-gray-50">
                {isAdminOrOwner && (
                  <th className="py-2 px-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                  </th>
                )}
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('loanNumber')}>{t('loans.loan_number_short')}{sortIcon('loanNumber')}</th>
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('customer')}>{t('customers.customer_name')}{sortIcon('customer')}</th>
                <th className="py-2 px-2 hidden md:table-cell cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort('startDate')}>{t('common.date')}{sortIcon('startDate')}</th>
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs text-right" onClick={() => toggleSort('lent')}>{t('loans.loan_short')}{sortIcon('lent')}</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('due')}>{t('loans.outstanding')}{sortIcon('due')}</th>
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('agent')}>{t('loans.agent')}{sortIcon('agent')}</th>
                <th className="py-2 px-2 hidden md:table-cell cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort('status')}>{t('common.status')}{sortIcon('status')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedLoans.map((loan) => {
                const outstanding = loan.totalRepayable - loan.paid
                return (
                  <tr key={loan.id} className={`border-b border-gray-50 hover:bg-gray-50 ${selected.has(loan.id) ? 'bg-primary-50/30' : ''}`}>
                    {isAdminOrOwner && (
                      <td className="py-2 px-3">
                        <input type="checkbox" checked={selected.has(loan.id)} onChange={() => toggleOne(loan.id)} className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                      </td>
                    )}
                    <td className="py-2 px-2 text-gray-500 font-mono text-[10px] md:text-xs">{loan.loanNumber}</td>
                    <td className="py-2 px-2">
                      <Link href={`/b/${businessId}/customers/${loan.customer.id}`} className="font-medium text-primary-600 hover:underline text-[11px] md:text-xs">{loan.customer.fullName}</Link>
                    </td>
                    <td className="py-2 px-2 text-gray-500 hidden md:table-cell">{formatDateDisplay(loan.startDate)}</td>
                    <td className="py-2 px-2 text-right text-gray-700 text-[10px] md:text-xs">{formatPaiseShort(loan.amountGiven)}</td>
                    <td className="py-2 px-2 text-right font-semibold text-gray-900 text-[10px] md:text-xs">{formatPaiseShort(outstanding)}</td>
                    <td className="py-2 px-2 text-[10px] md:text-xs">{loan.agent ? <Link href={`/b/${businessId}/users/${loan.agent.id}`} className="text-primary-600 hover:underline">{loan.agent.fullName}</Link> : '-'}</td>
                    <td className="py-2 px-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadgeClass(loan.status)}`}>
                        {statusLabel(loan.status, t)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {loans.length > 0 && (
        <div className="flex items-center justify-between mt-3 px-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {showAll ? `All ${loans.length}` : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, loans.length)} of ${loans.length}`}
            </span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s === 0 ? t('common.all') : s}</option>)}
            </select>
          </div>
          {totalPages > 1 && <div className="flex gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">First</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
              <span key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-xs text-gray-400">...</span>}
                <button onClick={() => setPage(p)} className={`px-2.5 py-1 text-xs rounded border transition-colors ${p === page ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{p}</button>
              </span>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">{t('common.next')}</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">Last</button>
          </div>}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg px-4 py-3 safe-area-inset-bottom">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">
              {selected.size} {t('loans.loans')}
            </span>
            <div className="flex gap-2">
              {selected.size === 1 && (
                <>
                  <button
                    onClick={() => openViewLoan(selectedLoanId!)}
                    disabled={viewLoading}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {viewLoading ? '...' : t('common.view')}
                  </button>
                  <button
                    onClick={() => openPaymentHistory(selectedLoanId!)}
                    disabled={paymentsLoading}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {paymentsLoading ? '...' : t('payments.payments')}
                  </button>
                  <button
                    onClick={() => router.push(`/b/${businessId}/loans/${selectedLoanId}/edit`)}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                  >
                    {t('common.edit')}
                  </button>
                </>
              )}
              <button
                onClick={() => executeBulk('delete')}
                disabled={loading}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-danger-600 text-white hover:bg-danger-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '...' : t('common.delete')}
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
