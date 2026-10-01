'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatPaiseShort } from '@/lib/money'
import { formatDateDisplay } from '@/lib/date'

interface Village { id: string; name: string }
interface UserInfo {
  id: string; fullName: string; phone: string; role: string; isActive: boolean
  villages: Village[]
}
interface PaymentRow {
  id: string; amount: number; paymentDate: string; note: string | null; receiptNumber: string
  loan: { loanNumber: string; customer: { id: string; fullName: string; customerId: string } }
}
interface LoanRow {
  id: string; loanNumber: string; amountGiven: number; totalRepayable: number
  startDate: string; status: string; collectionType: string
  customer: { id: string; fullName: string; customerId: string }
}
interface ActivityData {
  user: UserInfo
  collections: { payments: PaymentRow[]; totalCount: number; totalAmount: number }
  disbursements: { loans: LoanRow[]; totalCount: number; totalAmount: number }
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  DEFAULTER: 'bg-red-50 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const businessId = params.businessId as string
  const userId = params.userId as string

  const today = todayStr()
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchActivity = useCallback(async (from: string, to: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/b/${businessId}/users/${userId}/activity?from=${from}&to=${to}`)
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed to load')
        setLoading(false)
        return
      }
      setData(await res.json())
    } catch {
      setError('Network error')
    }
    setLoading(false)
  }, [businessId, userId])

  useEffect(() => { fetchActivity(fromDate, toDate) }, [fetchActivity, fromDate, toDate])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (error && !data) {
    return <div className="px-4 py-6 text-center text-gray-500">{error}</div>
  }

  if (!data) return null

  const { user, collections, disbursements } = data

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-1">
        <Link href={`/b/${businessId}/users`} className="text-primary-600 hover:underline">Employees</Link>
        <span>&rsaquo;</span>
        <span className="text-gray-700 font-medium">{user.fullName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold shrink-0">
          {user.fullName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{user.fullName}</h1>
            <Link href={`/b/${businessId}/users/${userId}/edit`} className="p-1 rounded hover:bg-gray-100 text-gray-400" aria-label="Edit employee">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </Link>
          </div>
          <p className="text-sm text-gray-500">{user.phone}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${user.role === 'AGENT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {user.role === 'BUSINESS_ADMIN' ? 'Admin' : user.role}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
            {user.villages.map(v => (
              <Link key={v.id} href={`/b/${businessId}/villages/${v.id}`} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200">
                {v.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="card p-3 mb-6">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="label text-xs">From</label>
            <input type="date" className="input text-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} max={toDate} />
          </div>
          <div className="flex-1">
            <label className="label text-xs">To</label>
            <input type="date" className="input text-sm" value={toDate} onChange={e => setToDate(e.target.value)} min={fromDate} max={today} />
          </div>
          <div className="flex gap-1">
            <button onClick={() => { setFromDate(today); setToDate(today) }} className={`text-xs px-2.5 py-2 rounded-lg border ${fromDate === today && toDate === today ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              Today
            </button>
            <button onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 7)
              setFromDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
              setToDate(today)
            }} className="text-xs px-2.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              7D
            </button>
            <button onClick={() => {
              const d = new Date(); d.setMonth(d.getMonth() - 1)
              setFromDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
              setToDate(today)
            }} className="text-xs px-2.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              30D
            </button>
          </div>
        </div>
        {fromDate !== toDate && (
          <p className="text-xs text-gray-400 mt-2">
            Showing activity from {formatDateDisplay(fromDate)} to {formatDateDisplay(toDate)}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-4 mb-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
        </div>
      )}

      {/* Section 1: Collections */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Collections</h2>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="stat-card">
            <div className="stat-value text-success-600">{formatPaiseShort(collections.totalAmount)}</div>
            <div className="stat-label">Total Collected</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{collections.totalCount}</div>
            <div className="stat-label">Payments</div>
          </div>
        </div>

        {collections.payments.length === 0 ? (
          <div className="card p-6 text-center text-gray-400 text-sm">No collections for this period</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium w-8">#</th>
                    <th className="text-left py-2 px-2 font-medium">Date</th>
                    <th className="text-left py-2 px-2 font-medium">Customer</th>
                    <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">Loan</th>
                    <th className="text-right py-2 px-2 font-medium">Amount</th>
                    <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.payments.map((p, idx) => (
                    <tr key={p.id} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                      <td className="py-2 px-2 text-gray-400">{idx + 1}</td>
                      <td className="py-2 px-2">{formatDateDisplay(p.paymentDate)}</td>
                      <td className="py-2 px-2">
                        <Link href={`/b/${businessId}/customers/${p.loan.customer.id}`} className="text-primary-600 hover:underline">
                          {p.loan.customer.fullName}
                        </Link>
                      </td>
                      <td className="py-2 px-2 text-gray-500 hidden sm:table-cell">{p.loan.loanNumber}</td>
                      <td className="py-2 px-2 text-right font-semibold text-success-700">{formatPaiseShort(p.amount)}</td>
                      <td className="py-2 px-2 text-gray-400 hidden sm:table-cell truncate max-w-[100px]">{p.note || ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-xs">
                    <td colSpan={4} className="py-2 px-2 text-gray-500">Total ({collections.totalCount})</td>
                    <td className="py-2 px-2 text-right text-success-700">{formatPaiseShort(collections.totalAmount)}</td>
                    <td className="hidden sm:table-cell"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Disbursements */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Loans Disbursed</h2>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="stat-card">
            <div className="stat-value text-primary-600">{formatPaiseShort(disbursements.totalAmount)}</div>
            <div className="stat-label">Total Disbursed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{disbursements.totalCount}</div>
            <div className="stat-label">Loans</div>
          </div>
        </div>

        {disbursements.loans.length === 0 ? (
          <div className="card p-6 text-center text-gray-400 text-sm">No loans disbursed in this period</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium w-8">#</th>
                    <th className="text-left py-2 px-2 font-medium">Date</th>
                    <th className="text-left py-2 px-2 font-medium">Customer</th>
                    <th className="text-left py-2 px-2 font-medium">Loan</th>
                    <th className="text-right py-2 px-2 font-medium">Given</th>
                    <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">Repayable</th>
                    <th className="text-left py-2 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {disbursements.loans.map((l, idx) => (
                    <tr key={l.id} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                      <td className="py-2 px-2 text-gray-400">{idx + 1}</td>
                      <td className="py-2 px-2">{formatDateDisplay(l.startDate)}</td>
                      <td className="py-2 px-2">
                        <Link href={`/b/${businessId}/customers/${l.customer.id}`} className="text-primary-600 hover:underline">
                          {l.customer.fullName}
                        </Link>
                      </td>
                      <td className="py-2 px-2 text-gray-600 font-medium">{l.loanNumber}</td>
                      <td className="py-2 px-2 text-right font-semibold text-primary-700">{formatPaiseShort(l.amountGiven)}</td>
                      <td className="py-2 px-2 text-right text-gray-500 hidden sm:table-cell">{formatPaiseShort(l.totalRepayable)}</td>
                      <td className="py-2 px-2">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColors[l.status] || 'bg-gray-100 text-gray-600'}`}>
                          {l.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-xs">
                    <td colSpan={4} className="py-2 px-2 text-gray-500">Total ({disbursements.totalCount})</td>
                    <td className="py-2 px-2 text-right text-primary-700">{formatPaiseShort(disbursements.totalAmount)}</td>
                    <td colSpan={2} className="hidden sm:table-cell"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
