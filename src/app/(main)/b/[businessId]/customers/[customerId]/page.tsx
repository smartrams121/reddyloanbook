'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatPaiseShort } from '@/lib/money'
import { formatDateDisplay } from '@/lib/date'

interface Village { id: string; name: string }
interface Agent { id: string; fullName: string }
interface LoanData {
  id: string; loanNumber: string; loanAmount: number; amountGiven: number
  interestAmount: number; totalRepayable: number; installmentAmount: number
  numberOfInstallments: number; collectionType: string; startDate: string
  expectedEndDate: string; closedAt: string | null; writeOffReason: string | null
  settlementReason: string | null; settlementAmount: number | null
  status: string; derivedStatus: string; notes: string | null; createdAt: string
  agent: Agent | null; totalPaid: number; outstanding: number
}
interface Summary {
  totalLoans: number; activeLoans: number; completedLoans: number; defaulterLoans: number
  totalLent: number; totalRepayable: number; totalPaid: number; totalOutstanding: number
  customerStatus: string
}
interface Customer {
  id: string; customerId: string; fullName: string; phone: string
  altPhone: string | null; age: number | null; address: string | null
  guarantorName: string | null; guarantorPhone: string | null
  notes: string | null; photoPath: string | null; aadhaarLast4: string | null
  jobType: string | null; status: string
  village: Village; loans: LoanData[]; summary: Summary
  createdAt: string; updatedAt: string
}
interface PaymentEntry {
  id: string; amount: number; paymentDate: string; note: string | null
  receiptNumber: string; collector: { id: string; fullName: string } | null
}
interface PaymentsResponse {
  payments: PaymentEntry[]; total: number; page: number; pageSize: number; totalPages: number
}

const COMPLETED_STATUSES = ['COMPLETED', 'DEFAULTER']

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  DEFAULTER: 'bg-red-50 text-red-700',
  COMPLETED: 'bg-blue-50 text-blue-700',
  'NO LOANS': 'bg-gray-100 text-gray-400',
}

const borderColors: Record<string, string> = {
  ACTIVE: 'border-l-green-500',
  OVERDUE: 'border-l-orange-500',
  DEFAULTER: 'border-l-red-400',
  COMPLETED: 'border-l-blue-400',
}

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const businessId = params.businessId as string
  const customerId = params.customerId as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null)
  const [selectedLoans, setSelectedLoans] = useState<Set<string>>(new Set())
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [showPaymentTable, setShowPaymentTable] = useState(false)
  const [userRole, setUserRole] = useState<string>('')

  const loadCustomer = useCallback(() => {
    setLoading(true)
    fetch(`/api/b/${businessId}/customers/${customerId}`)
      .then((r) => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then((data) => { setCustomer(data); setLoading(false) })
      .catch(() => { setError('Customer not found'); setLoading(false) })
  }, [businessId, customerId])

  useEffect(() => { loadCustomer() }, [loadCustomer])

  useEffect(() => {
    fetch('/api/auth/profile')
      .then(r => r.json())
      .then(d => { if (d.role) setUserRole(d.role) })
      .catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (error || !customer) {
    return <div className="px-4 py-6 text-center text-gray-500">{error || 'Customer not found'}</div>
  }

  const activeLoans = customer.loans.filter(l => !COMPLETED_STATUSES.includes(l.derivedStatus))
  const closedLoans = customer.loans.filter(l => COMPLETED_STATUSES.includes(l.derivedStatus))
  const s = customer.summary
  const overallProgress = s.totalRepayable > 0 ? Math.round((s.totalPaid / s.totalRepayable) * 100) : 0
  const isAdminOrOwner = userRole === 'OWNER' || userRole === 'BUSINESS_ADMIN'
  const canDownload = isAdminOrOwner
  const displayStatus = s.customerStatus

  function toggleLoanSelect(loanId: string) {
    setSelectedLoans(prev => {
      const next = new Set(prev)
      if (next.has(loanId)) next.delete(loanId); else next.add(loanId)
      return next
    })
  }

  function handleDownload(format: string, scope: 'selected' | 'all') {
    setShowDownloadMenu(false)
    const params = new URLSearchParams({ format })
    if (scope === 'all') params.set('all', 'true')
    else params.set('loanIds', Array.from(selectedLoans).join(','))
    const a = document.createElement('a')
    a.href = `/api/b/${businessId}/customers/${customerId}/report?${params}`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const postableSelected = customer ? customer.loans.filter(l => selectedLoans.has(l.id) && l.outstanding > 0) : []

  function handleRecordPayment() {
    if (postableSelected.length === 1) {
      router.push(`/b/${businessId}/posting/individual?customerId=${customer!.id}&loanId=${postableSelected[0].id}`)
    } else if (postableSelected.length > 1) {
      router.push(`/b/${businessId}/posting/bulk?villageId=${customer!.village.id}`)
    }
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-1">
        <Link href={`/b/${businessId}/customers`} className="text-primary-600 hover:underline">Customers</Link>
        <span>&rsaquo;</span>
        <Link href={`/b/${businessId}/villages/${customer.village.id}`} className="text-primary-600 hover:underline">{customer.village.name}</Link>
        <span>&rsaquo;</span>
        <span className="text-gray-700 font-medium">{customer.fullName}</span>
      </nav>

      {/* ─── Section 1: Customer Summary Header ─── */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden">
          {customer.photoPath ? (
            <img src={customer.photoPath} alt={customer.fullName} className="w-full h-full object-cover" />
          ) : (
            customer.fullName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{customer.fullName}</h1>
            {isAdminOrOwner && (
              <Link href={`/b/${businessId}/customers/${customerId}/edit`} className="p-1 rounded hover:bg-gray-100 text-gray-400" aria-label="Edit customer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
              </Link>
            )}
          </div>
          <p className="text-sm text-gray-500">{customer.customerId} &middot; {customer.phone} &middot; {customer.village.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[displayStatus] || 'bg-gray-100 text-gray-600'}`}>
              {displayStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-500">Total Loans</p>
          <p className="text-lg font-bold text-gray-900">{s.totalLoans}</p>
          <p className="text-[10px] text-gray-400">{s.activeLoans} active &middot; {s.completedLoans} closed</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-500">Total Loan Amount</p>
          <p className="text-lg font-bold text-gray-900">{formatPaiseShort(s.totalLent)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-500">Total Paid</p>
          <p className="text-lg font-bold text-success-600">{formatPaiseShort(s.totalPaid)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-500">Outstanding</p>
          <p className="text-lg font-bold text-gray-900">{formatPaiseShort(s.totalOutstanding)}</p>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${overallProgress >= 100 ? 'bg-success-500' : 'bg-primary-500'}`} style={{ width: `${Math.min(100, overallProgress)}%` }} />
        </div>
        <span className="text-xs text-gray-500">{overallProgress}% collected</span>
      </div>

      {/* Contact Info (collapsible) */}
      <ContactSection customer={customer} />

      {/* ─── Section 2: Loan Cards ─── */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Loans {activeLoans.length > 0 && <span className="text-sm font-normal text-gray-400">({activeLoans.length} active)</span>}
          </h2>
          {isAdminOrOwner && (
            <Link href={`/b/${businessId}/loans/new?customerId=${customer.id}`} className="text-sm text-primary-600 font-medium">
              + New Loan
            </Link>
          )}
        </div>

        {customer.loans.length === 0 && (
          <div className="card p-8 text-center text-gray-400">
            <p>No loans yet</p>
            {isAdminOrOwner && (
              <Link href={`/b/${businessId}/loans/new?customerId=${customer.id}`} className="btn-primary mt-4 inline-block">Create First Loan</Link>
            )}
          </div>
        )}

        {activeLoans.length > 0 && (
          <div className="space-y-2 mb-4">
            {activeLoans.map((loan) => (
              <LoanCardWithPanel
                key={loan.id}
                loan={loan}
                businessId={businessId}
                customerId={customerId}
                isExpanded={expandedLoan === loan.id}
                isSelected={selectedLoans.has(loan.id)}
                onToggleExpand={() => setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}
                onToggleSelect={() => toggleLoanSelect(loan.id)}
                onStatusChange={loadCustomer}
                canSelect={canDownload}
              />
            ))}
          </div>
        )}

        {closedLoans.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mt-6 mb-3">
              Completed / Closed ({closedLoans.length})
            </h3>
            <div className="space-y-2">
              {closedLoans.map((loan) => (
                <LoanCardWithPanel
                  key={loan.id}
                  loan={loan}
                  businessId={businessId}
                  customerId={customerId}
                  isExpanded={expandedLoan === loan.id}
                  isSelected={selectedLoans.has(loan.id)}
                  onToggleExpand={() => setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}
                  onToggleSelect={() => toggleLoanSelect(loan.id)}
                  onStatusChange={loadCustomer}
                  canSelect={canDownload}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── Payment Table View ─── */}
      {showPaymentTable && canDownload && selectedLoans.size > 0 && (
        <CombinedPaymentTable
          businessId={businessId}
          customerId={customerId}
          loans={customer.loans.filter(l => selectedLoans.has(l.id))}
        />
      )}

      {/* Bottom spacer when action bar is visible */}
      {canDownload && selectedLoans.size > 0 && <div className="h-16" />}

      {/* ─── Section 4: Download Action Bar ─── */}
      {canDownload && selectedLoans.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {selectedLoans.size} loan{selectedLoans.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              {postableSelected.length > 0 && (
                <button
                  onClick={handleRecordPayment}
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-success-300 bg-success-50 text-success-700 hover:bg-success-100 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  {postableSelected.length === 1 ? 'Record Payment' : 'Bulk Posting'}
                </button>
              )}
              <button
                onClick={() => { setShowPaymentTable(!showPaymentTable); setShowDownloadMenu(false) }}
                className={`px-3 py-2 text-sm font-medium rounded-lg border flex items-center gap-1.5 ${showPaymentTable ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                View
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {showDownloadMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-56 z-50">
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase">Selected Loans</p>
                    <button onClick={() => handleDownload('xlsx', 'selected')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      Excel (.xlsx)
                    </button>
                    <button onClick={() => handleDownload('pdf', 'selected')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      PDF (Print)
                    </button>
                    {customer.loans.length > 1 && (
                      <>
                        <hr className="my-1 border-gray-100" />
                        <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase">All Loans Combined</p>
                        <button onClick={() => handleDownload('xlsx', 'all')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Excel (.xlsx)
                        </button>
                        <button onClick={() => handleDownload('pdf', 'all')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          PDF (Print)
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Contact Info Section ─── */
function ContactSection({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Contact & Details</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-1.5">
          <InfoRow label="Phone" value={customer.phone} />
          {customer.altPhone && <InfoRow label="Alt Phone" value={customer.altPhone} />}
          {customer.age && <InfoRow label="Age" value={String(customer.age)} />}
          {customer.address && <InfoRow label="Address" value={customer.address} />}
          {customer.jobType && <InfoRow label="Job" value={customer.jobType} />}
          {customer.aadhaarLast4 && <InfoRow label="Aadhaar" value={`XXXX XXXX ${customer.aadhaarLast4}`} />}
          {customer.guarantorName && <InfoRow label="Guarantor" value={customer.guarantorName} />}
          {customer.guarantorPhone && <InfoRow label="Guarantor Phone" value={customer.guarantorPhone} />}
          {customer.notes && <InfoRow label="Notes" value={customer.notes} />}
          <InfoRow label="Created" value={formatDateDisplay(customer.createdAt.slice(0, 10))} />
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right max-w-[60%] break-words">{value}</span>
    </div>
  )
}

/* ─── Loan Card with inline Payment Panel ─── */
function LoanCardWithPanel({
  loan, businessId, customerId, isExpanded, isSelected, onToggleExpand, onToggleSelect, onStatusChange, canSelect,
}: {
  loan: LoanData; businessId: string; customerId: string
  isExpanded: boolean; isSelected: boolean
  onToggleExpand: () => void; onToggleSelect: () => void; onStatusChange: () => void; canSelect: boolean
}) {
  const [showActions, setShowActions] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [actionError, setActionError] = useState('')

  const isTerminal = loan.derivedStatus === 'COMPLETED'
  const progress = loan.totalRepayable > 0 ? Math.round((loan.totalPaid / loan.totalRepayable) * 100) : 0

  async function handleStatusChange(newStatus: string) {
    const labels: Record<string, string> = { ACTIVE: 'Activate' }
    if (!confirm(`Are you sure you want to ${labels[newStatus]?.toLowerCase() || 'change'} loan ${loan.loanNumber}?`)) return
    setUpdating(true); setActionError('')
    try {
      const res = await fetch(`/api/b/${businessId}/loans/${loan.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) { const d = await res.json(); setActionError(d.error || 'Failed'); return }
      setShowActions(false); onStatusChange()
    } catch { setActionError('Network error') } finally { setUpdating(false) }
  }

  return (
    <div className={`${isSelected ? 'ring-2 ring-primary-300' : ''}`}>
      <div className={`card p-3 border-l-4 ${borderColors[loan.derivedStatus] || 'border-l-gray-300'} cursor-pointer`} onClick={onToggleExpand}>
        <div className="flex items-start gap-2">
          {canSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => { e.stopPropagation(); onToggleSelect() }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-sm font-semibold text-gray-900">{loan.loanNumber}</p>
                <p className="text-xs text-gray-500">
                  Started {formatDateDisplay(loan.startDate)}
                  {loan.agent && <> · <Link href={`/b/${businessId}/users/${loan.agent.id}`} className="text-primary-600 hover:underline" onClick={e => e.stopPropagation()}>{loan.agent.fullName}</Link></>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[loan.derivedStatus] || 'bg-gray-100 text-gray-600'}`}>
                  {loan.derivedStatus}
                </span>
                {!isTerminal && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowActions(!showActions) }}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>{loan.collectionType} &middot; {formatPaiseShort(loan.installmentAmount)}/inst</span>
              <span>Repayable: {formatPaiseShort(loan.totalRepayable)}</span>
            </div>

            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-success-600 font-semibold">Paid: {formatPaiseShort(loan.totalPaid)}</span>
              <span className="text-gray-900 font-semibold">Due: {formatPaiseShort(loan.outstanding)}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${progress >= 100 ? 'bg-success-500' : 'bg-primary-500'}`} style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
              <span className="text-[10px] text-gray-400">{progress}%</span>
            </div>
          </div>
        </div>

        {showActions && !isTerminal && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2" onClick={(e) => e.stopPropagation()}>
            {actionError && <p className="text-xs text-danger-600 mb-2">{actionError}</p>}
            <Link href={`/b/${businessId}/loans/${loan.id}/edit`} className="block w-full text-center text-xs font-medium py-1.5 px-2 rounded-lg bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors">
              Edit Loan
            </Link>
          </div>
        )}
      </div>

      {/* ─── Section 3: Payment History Panel ─── */}
      {isExpanded && (
        <PaymentPanel
          businessId={businessId}
          customerId={customerId}
          loan={loan}
        />
      )}
    </div>
  )
}

/* ─── Payment History Panel ─── */
function PaymentPanel({ businessId, customerId, loan }: { businessId: string; customerId: string; loan: LoanData }) {
  const [data, setData] = useState<PaymentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const fetchPayments = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/b/${businessId}/customers/${customerId}/loans/${loan.id}/payments?page=${p}&limit=25`)
      const json = await res.json()
      setData(json)
    } catch { /* ignore */ }
    setLoading(false)
  }, [businessId, customerId, loan.id])

  useEffect(() => { fetchPayments(page) }, [fetchPayments, page])

  const isReadOnly = loan.derivedStatus === 'COMPLETED'

  return (
    <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg p-3 -mt-1">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Payment History</h3>
        <div className="flex items-center gap-2">
          {isReadOnly && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Read Only</span>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
        </div>
      )}

      {!loading && data && data.payments.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No payments recorded yet</p>
      )}

      {!loading && data && data.payments.length > 0 && (
        <>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="text-left py-1.5 px-1.5 font-medium w-8">#</th>
                  <th className="text-left py-1.5 px-1.5 font-medium">Date</th>
                  <th className="text-right py-1.5 px-1.5 font-medium">Amount</th>
                  <th className="text-left py-1.5 px-1.5 font-medium">Agent</th>
                  <th className="text-left py-1.5 px-1.5 font-medium hidden sm:table-cell">Note</th>
                  <th className="text-right py-1.5 px-1.5 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const startIdx = (data.page - 1) * data.pageSize
                  const thisPageSum = data.payments.reduce((s, p) => s + p.amount, 0)
                  const priorCumulative = page === 1 ? 0 : loan.totalPaid - thisPageSum
                  let cumulative = priorCumulative
                  return data.payments.map((p, idx) => {
                    cumulative += p.amount
                    const balance = loan.totalRepayable - cumulative
                    const rowNum = startIdx + idx + 1
                    return (
                      <tr key={p.id} className={idx % 2 === 1 ? 'bg-gray-100/50' : ''}>
                        <td className="py-1.5 px-1.5 text-gray-400">{rowNum}</td>
                        <td className="py-1.5 px-1.5">{formatDateDisplay(p.paymentDate)}</td>
                        <td className="py-1.5 px-1.5 text-right font-semibold text-success-700">{formatPaiseShort(p.amount)}</td>
                        <td className="py-1.5 px-1.5 text-gray-500">{p.collector ? <Link href={`/b/${businessId}/users/${p.collector.id}`} className="text-primary-600 hover:underline">{p.collector.fullName}</Link> : '-'}</td>
                        <td className="py-1.5 px-1.5 text-gray-400 hidden sm:table-cell truncate max-w-[100px]">{p.note || ''}</td>
                        <td className="py-1.5 px-1.5 text-right font-semibold">{formatPaiseShort(Math.max(0, balance))}</td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-xs text-primary-600 disabled:text-gray-300"
              >
                ← Previous
              </button>
              <span className="text-xs text-gray-500">Page {page} of {data.totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="text-xs text-primary-600 disabled:text-gray-300"
              >
                Next →
              </button>
            </div>
          )}

          {/* Summary Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 text-xs">
            <span className="text-gray-500">
              {data.total} payment{data.total !== 1 ? 's' : ''} total
            </span>
            <div className="flex gap-4">
              <span className="text-success-600 font-semibold">Paid: {formatPaiseShort(loan.totalPaid)}</span>
              <span className="text-gray-900 font-semibold">Outstanding: {formatPaiseShort(loan.outstanding)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Combined Payment Table (for selected loans) ─── */
function CombinedPaymentTable({ businessId, customerId, loans }: { businessId: string; customerId: string; loans: LoanData[] }) {
  const [allPayments, setAllPayments] = useState<(PaymentEntry & { loanNumber: string; loanId: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 50

  useEffect(() => {
    setLoading(true)
    setPage(1)
    if (loans.length === 0) { setAllPayments([]); setLoading(false); return }

    Promise.all(
      loans.map(loan =>
        fetch(`/api/b/${businessId}/customers/${customerId}/loans/${loan.id}/payments?page=1&limit=500`)
          .then(r => r.json())
          .then((data: PaymentsResponse) =>
            data.payments.map(p => ({ ...p, loanNumber: loan.loanNumber, loanId: loan.id }))
          )
          .catch(() => [] as (PaymentEntry & { loanNumber: string; loanId: string })[])
      )
    ).then(results => {
      const combined = results.flat().sort((a, b) => {
        const dc = a.paymentDate.localeCompare(b.paymentDate)
        if (dc !== 0) return dc
        return a.loanNumber.localeCompare(b.loanNumber)
      })
      setAllPayments(combined)
      setLoading(false)
    })
  }, [businessId, customerId, loans])

  const totalPages = Math.ceil(allPayments.length / pageSize)
  const pagedPayments = allPayments.slice((page - 1) * pageSize, page * pageSize)
  const multiLoan = loans.length > 1
  const totalAmount = allPayments.reduce((s, p) => s + p.amount, 0)

  const loanBalanceMap = new Map<string, { repayable: number; cumulative: number }>()
  for (const loan of loans) {
    loanBalanceMap.set(loan.id, { repayable: loan.totalRepayable, cumulative: 0 })
  }
  const balances: number[] = []
  for (const p of allPayments) {
    const entry = loanBalanceMap.get(p.loanId)
    if (entry) { entry.cumulative += p.amount; balances.push(entry.repayable - entry.cumulative) }
    else balances.push(0)
  }
  const startIdx = (page - 1) * pageSize
  const pagedBalances = balances.slice(startIdx, startIdx + pageSize)

  return (
    <div className="mt-6 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Payment History
          <span className="text-sm font-normal text-gray-400 ml-2">
            {loans.length} loan{loans.length > 1 ? 's' : ''} &middot; {allPayments.length} payment{allPayments.length !== 1 ? 's' : ''}
          </span>
        </h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : allPayments.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">No payments recorded for selected loans</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium w-8">#</th>
                  <th className="text-left py-2 px-2 font-medium">Date</th>
                  {multiLoan && <th className="text-left py-2 px-2 font-medium">Loan</th>}
                  <th className="text-right py-2 px-2 font-medium">Amount</th>
                  <th className="text-left py-2 px-2 font-medium">Receipt</th>
                  <th className="text-left py-2 px-2 font-medium">Agent</th>
                  <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">Note</th>
                  <th className="text-right py-2 px-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {pagedPayments.map((p, idx) => (
                  <tr key={p.id} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                    <td className="py-2 px-2 text-gray-400">{startIdx + idx + 1}</td>
                    <td className="py-2 px-2">{formatDateDisplay(p.paymentDate)}</td>
                    {multiLoan && <td className="py-2 px-2 text-gray-600 font-medium">{p.loanNumber}</td>}
                    <td className="py-2 px-2 text-right font-semibold text-success-700">{formatPaiseShort(p.amount)}</td>
                    <td className="py-2 px-2 text-gray-400">{p.receiptNumber}</td>
                    <td className="py-2 px-2 text-gray-500">{p.collector ? <Link href={`/b/${businessId}/users/${p.collector.id}`} className="text-primary-600 hover:underline">{p.collector.fullName}</Link> : '-'}</td>
                    <td className="py-2 px-2 text-gray-400 hidden sm:table-cell truncate max-w-[100px]">{p.note || ''}</td>
                    <td className="py-2 px-2 text-right font-semibold">{formatPaiseShort(Math.max(0, pagedBalances[idx]))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-xs">
                  <td colSpan={multiLoan ? 3 : 2} className="py-2 px-2 text-gray-500">Total</td>
                  <td className="py-2 px-2 text-right text-success-700">{formatPaiseShort(totalAmount)}</td>
                  <td colSpan={multiLoan ? 4 : 3} className="py-2 px-2 text-right text-gray-500">
                    Outstanding: {formatPaiseShort(loans.reduce((s, l) => s + l.outstanding, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="text-xs text-primary-600 disabled:text-gray-300">
                ← Previous
              </button>
              <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="text-xs text-primary-600 disabled:text-gray-300">
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
