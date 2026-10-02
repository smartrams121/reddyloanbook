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

export default function LoanListClient({ loans, businessId, isAdminOrOwner = true }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
                    {loan.agent && <> · <Link href={`/b/${businessId}/users/${loan.agent.id}`} className="text-primary-600 hover:underline" onClick={e => e.stopPropagation()}>{loan.agent.fullName}</Link></>}
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
                <button
                  onClick={() => router.push(`/b/${businessId}/loans/${Array.from(selected)[0]}/edit`)}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  Edit
                </button>
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
    </div>
  )
}
