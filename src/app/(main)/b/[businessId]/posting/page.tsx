'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatPaiseShort } from '@/lib/money'
import { formatDateDisplay } from '@/lib/date'

interface CustomerResult {
  id: string
  customerId: string
  fullName: string
  phone: string
  village: { name: string }
}

interface PaymentRow {
  id: string
  receiptNumber: string
  amount: number
  paymentDate: string
  note: string | null
  loan: { loanNumber: string; customer: { id: string; fullName: string; customerId: string } }
  collector: { id: string; fullName: string }
}

export default function PostingPage() {
  const params = useParams()
  const businessId = params.businessId as string

  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<CustomerResult[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/b/${businessId}/customers`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCustomers(data) })
      .catch(() => {})
  }, [businessId])

  const filtered = query.trim().length > 0
    ? customers.filter(c =>
        c.fullName.toLowerCase().includes(query.toLowerCase()) ||
        c.phone.includes(query) ||
        c.customerId.toLowerCase().includes(query.toLowerCase())
      )
    : []

  function selectCustomer(c: CustomerResult) {
    setSelectedCustomer(c)
    setQuery('')
    setLoadingPayments(true)
    fetch(`/api/b/${businessId}/payments?customerId=${c.id}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPayments(data) })
      .catch(() => {})
      .finally(() => setLoadingPayments(false))
  }

  function clearCustomer() {
    setSelectedCustomer(null)
    setPayments([])
    setQuery('')
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Payments</h1>
      <p className="text-sm text-gray-500 mb-6">Choose a posting method</p>

      <div className="space-y-4">
        {/* Individual Posting */}
        <Link
          href={`/b/${businessId}/posting/individual`}
          className="card p-5 flex items-center gap-4 hover:border-primary-300 transition-colors block"
        >
          <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-900">Individual Posting</h2>
            <p className="text-xs text-gray-500">Search a customer and record a single payment</p>
          </div>
          <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>

        {/* Bulk Posting */}
        <Link
          href={`/b/${businessId}/posting/bulk`}
          className="card p-5 flex items-center gap-4 hover:border-primary-300 transition-colors block"
        >
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-900">Bulk Posting</h2>
            <p className="text-xs text-gray-500">Collect payments for all customers in a location at once</p>
          </div>
          <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>

        {/* View Payments */}
        {!showSearch ? (
          <button
            onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 100) }}
            className="card p-5 flex items-center gap-4 hover:border-primary-300 transition-colors w-full text-left"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-gray-900">View Payments</h2>
              <p className="text-xs text-gray-500">Search a customer to view their payment history</p>
            </div>
            <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        ) : (
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">View Payments</h2>
              <button
                onClick={() => { setShowSearch(false); clearCustomer() }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Close
              </button>
            </div>

            {/* Customer Search */}
            {!selectedCustomer ? (
              <div className="relative">
                <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white focus-within:border-primary-400">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <input
                    ref={searchRef}
                    type="text"
                    className="flex-1 text-sm outline-none bg-transparent"
                    placeholder="Search by name, phone, or ID..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                {/* Dropdown results */}
                {filtered.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                    {filtered.slice(0, 10).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-900">{c.fullName}</p>
                        <p className="text-xs text-gray-500">{c.customerId} · {c.phone} · {c.village.name}</p>
                      </button>
                    ))}
                  </div>
                )}

                {query.trim().length > 0 && filtered.length === 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg px-3 py-3 z-20">
                    <p className="text-xs text-gray-400 text-center">No customers found</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Selected customer header */}
                <div className="flex items-center justify-between bg-primary-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedCustomer.fullName}</p>
                    <p className="text-xs text-gray-500">{selectedCustomer.customerId} · {selectedCustomer.phone}</p>
                  </div>
                  <button onClick={clearCustomer} className="text-xs text-primary-600 font-medium hover:underline">
                    Change
                  </button>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Payments</p>
                    <p className="text-sm font-bold text-gray-900">{payments.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase">Total Paid</p>
                    <p className="text-sm font-bold text-green-700">{formatPaiseShort(totalPaid)}</p>
                  </div>
                </div>

                {/* Payments list */}
                {loadingPayments ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                  </div>
                ) : payments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No payments recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-2 pr-2">Receipt</th>
                          <th className="py-2 pr-2">Date</th>
                          <th className="py-2 pr-2">Loan</th>
                          <th className="py-2 pr-2">By</th>
                          <th className="py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id} className="border-b border-gray-50">
                            <td className="py-2 pr-2 text-gray-500 font-mono">{p.receiptNumber}</td>
                            <td className="py-2 pr-2">{formatDateDisplay(p.paymentDate)}</td>
                            <td className="py-2 pr-2 text-gray-700">{p.loan.loanNumber}</td>
                            <td className="py-2 pr-2 text-gray-500">{p.collector.fullName}</td>
                            <td className="py-2 text-right font-medium text-green-700">{formatPaiseShort(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
