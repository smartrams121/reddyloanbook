'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Village { id: string; name: string }
interface LoanSummary {
  id: string
  loanNumber: string
  loanAmount: number
  totalRepayable: number
  status: string
  startDate: string
}
interface Customer {
  id: string
  customerId: string
  fullName: string
  phone: string
  altPhone: string | null
  age: number | null
  address: string | null
  guarantorName: string | null
  guarantorPhone: string | null
  notes: string | null
  photoPath: string | null
  aadhaarLast4: string | null
  status: string
  village: Village
  loans: LoanSummary[]
  createdAt: string
  updatedAt: string
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
  if (rupees === Math.floor(rupees)) {
    return `₹${Math.floor(rupees).toLocaleString('en-IN')}`
  }
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-200 text-gray-600',
  FROZEN: 'bg-blue-100 text-blue-700',
  OVERDUE: 'bg-red-100 text-red-700',
  IN_GRACE: 'bg-yellow-100 text-yellow-700',
  DEFAULTER: 'bg-red-200 text-red-800',
  COMPLETED: 'bg-gray-100 text-gray-600',
  COMPLETED_RENEWED: 'bg-blue-100 text-blue-700',
  SETTLED: 'bg-gray-100 text-gray-600',
  WRITTEN_OFF: 'bg-gray-200 text-gray-500',
  CLOSED: 'bg-gray-100 text-gray-600',
}

const TERMINAL_STATUSES = ['COMPLETED', 'COMPLETED_RENEWED', 'SETTLED', 'WRITTEN_OFF']

export default function CustomerDetailPage() {
  const params = useParams()
  const businessId = params.businessId as string
  const customerId = params.customerId as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadCustomer = useCallback(() => {
    fetch(`/api/b/${businessId}/customers/${customerId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then((data) => { setCustomer(data); setLoading(false) })
      .catch(() => { setError('Customer not found'); setLoading(false) })
  }, [businessId, customerId])

  useEffect(() => { loadCustomer() }, [loadCustomer])

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

  const activeLoans = customer.loans.filter(l => !TERMINAL_STATUSES.includes(l.status))
  const closedLoans = customer.loans.filter(l => TERMINAL_STATUSES.includes(l.status))

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Link href={`/b/${businessId}/customers`} className="text-sm text-primary-600 hover:underline">
        &larr; All Customers
      </Link>

      {/* Customer Header */}
      <div className="mt-4 flex items-start gap-4">
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
            <Link href={`/b/${businessId}/customers/${customerId}/edit`} className="p-1 rounded hover:bg-gray-100 text-gray-400" aria-label="Edit customer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </Link>
          </div>
          <p className="text-sm text-gray-500">{customer.customerId} &middot; {customer.village.name}</p>
          <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[customer.status] || 'bg-gray-100 text-gray-600'}`}>
            {customer.status}
          </span>
        </div>
      </div>

      {/* Contact Info */}
      <div className="card p-4 mt-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Contact</h2>
        <InfoRow label="Phone" value={customer.phone} />
        {customer.altPhone && <InfoRow label="Alt Phone" value={customer.altPhone} />}
        {customer.age && <InfoRow label="Age" value={String(customer.age)} />}
        {customer.address && <InfoRow label="Address" value={customer.address} />}
        {customer.aadhaarLast4 && <InfoRow label="Aadhaar" value={`XXXX XXXX ${customer.aadhaarLast4}`} />}
        {customer.guarantorName && <InfoRow label="Guarantor" value={customer.guarantorName} />}
        {customer.guarantorPhone && <InfoRow label="Guarantor Phone" value={customer.guarantorPhone} />}
        {customer.notes && <InfoRow label="Notes" value={customer.notes} />}
        <InfoRow label="Created" value={formatDateTime(customer.createdAt)} />
        {customer.updatedAt !== customer.createdAt && <InfoRow label="Updated" value={formatDateTime(customer.updatedAt)} />}
      </div>

      {/* Active / Inactive / Frozen Loans */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Loans {activeLoans.length > 0 && <span className="text-sm font-normal text-gray-400">({activeLoans.length})</span>}
          </h2>
          <Link href={`/b/${businessId}/loans/new?customerId=${customer.id}`} className="text-sm text-primary-600 font-medium">
            + New Loan
          </Link>
        </div>

        {activeLoans.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No loans</p>
        )}

        <div className="space-y-2">
          {activeLoans.map((loan) => (
            <LoanCard key={loan.id} loan={loan} businessId={businessId} onStatusChange={loadCustomer} />
          ))}
        </div>
      </div>

      {/* Closed Loans */}
      {closedLoans.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Completed Loans <span className="text-sm font-normal text-gray-400">({closedLoans.length})</span>
          </h2>
          <div className="space-y-2">
            {closedLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} businessId={businessId} onStatusChange={loadCustomer} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value}</span>
    </div>
  )
}

function LoanCard({ loan, businessId, onStatusChange }: { loan: LoanSummary; businessId: string; onStatusChange: () => void }) {
  const [showActions, setShowActions] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [actionError, setActionError] = useState('')

  const startParts = loan.startDate.split('-')
  const dateStr = startParts.length === 3 ? `${startParts[2]}/${startParts[1]}/${startParts[0]}` : loan.startDate

  const isTerminal = TERMINAL_STATUSES.includes(loan.status)

  async function handleStatusChange(newStatus: string) {
    const labels: Record<string, string> = { ACTIVE: 'Activate', INACTIVE: 'Deactivate', FROZEN: 'Freeze' }
    if (!confirm(`Are you sure you want to ${labels[newStatus]?.toLowerCase() || 'change'} loan ${loan.loanNumber}?`)) return

    setUpdating(true)
    setActionError('')
    try {
      const res = await fetch(`/api/b/${businessId}/loans/${loan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        setActionError(data.error || 'Failed to update')
        return
      }
      setShowActions(false)
      onStatusChange()
    } catch {
      setActionError('Network error')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{loan.loanNumber}</p>
          <p className="text-xs text-gray-500">Started {dateStr}</p>
        </div>
        <div className="text-right flex items-center gap-2">
          <div>
            <p className="text-sm font-bold text-gray-900">{formatPaiseShort(loan.totalRepayable)}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[loan.status] || 'bg-gray-100 text-gray-600'}`}>
              {loan.status.replace(/_/g, ' ')}
            </span>
          </div>
          {!isTerminal && (
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400"
              aria-label="Loan actions"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {showActions && !isTerminal && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {actionError && (
            <p className="text-xs text-danger-600 mb-2">{actionError}</p>
          )}
          <Link
            href={`/b/${businessId}/loans/${loan.id}/edit`}
            className="block w-full text-center text-xs font-medium py-1.5 px-2 rounded-lg bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors"
          >
            Edit Loan Details
          </Link>
          <div className="flex gap-2">
            {loan.status !== 'ACTIVE' && (
              <button
                onClick={() => handleStatusChange('ACTIVE')}
                disabled={updating}
                className="flex-1 text-xs font-medium py-1.5 px-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                Activate
              </button>
            )}
            {loan.status !== 'INACTIVE' && (
              <button
                onClick={() => handleStatusChange('INACTIVE')}
                disabled={updating}
                className="flex-1 text-xs font-medium py-1.5 px-2 rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Inactive
              </button>
            )}
            {loan.status !== 'FROZEN' && (
              <button
                onClick={() => handleStatusChange('FROZEN')}
                disabled={updating}
                className="flex-1 text-xs font-medium py-1.5 px-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                Freeze
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
