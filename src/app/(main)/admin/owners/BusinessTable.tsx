'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import OwnerActions from './OwnerActions'

interface Row {
  id: string
  ownerId: string
  organizationName: string
  ownerName: string
  ownerUsername: string
  ownerPhone: string
  ownerEmail: string
  ownerCity: string
  ownerActive: boolean
  customers: number
  loans: number
  payments: number
  collections: number
  createdAt: string
  lastLogin: string | null
}

const PAGE_SIZES = [15, 25, 50, 100, 0] as const

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(iso: string | null) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function BusinessTable({ rows }: { rows: Row[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(0)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      r.ownerId.toLowerCase().includes(q) ||
      r.ownerName.toLowerCase().includes(q) ||
      r.ownerUsername.toLowerCase().includes(q) ||
      r.ownerPhone.includes(q) ||
      r.ownerEmail.toLowerCase().includes(q) ||
      r.organizationName.toLowerCase().includes(q) ||
      r.ownerCity.toLowerCase().includes(q)
    )
  }, [rows, search])

  const showAll = pageSize === 0
  const totalPages = showAll ? 1 : Math.ceil(filtered.length / pageSize)
  const paged = showAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Organizations</h1>
          <p className="text-sm text-gray-500">{rows.length} registered owner(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.refresh()} className="btn-secondary btn-sm">
            Refresh
          </button>
          <Link href="/register" className="btn-primary btn-sm" target="_blank">
            + Register New Business
          </Link>
        </div>
      </div>

      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          className="input pl-9 pr-8"
          placeholder="Search by OrgID, organization, owner, username, city, phone, email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setPage(1) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">No organizations found.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="py-2 px-2 font-medium">#</th>
                  <th className="py-2 px-2 font-medium">OrgID</th>
                  <th className="py-2 px-2 font-medium">Organization</th>
                  <th className="py-2 px-2 font-medium">Owner</th>
                  <th className="py-2 px-2 font-medium">City</th>
                  <th className="py-2 px-2 font-medium">Phone</th>
                  <th className="py-2 px-2 font-medium">Email</th>
                  <th className="py-2 px-2 font-medium text-right">Collections</th>
                  <th className="py-2 px-2 font-medium text-right">Customers</th>
                  <th className="py-2 px-2 font-medium text-right">Loans</th>
                  <th className="py-2 px-2 font-medium text-right">Payments</th>
                  <th className="py-2 px-2 font-medium">Created</th>
                  <th className="py-2 px-2 font-medium">Last Login</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                  <th className="py-2 px-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2 text-gray-400">{showAll ? i + 1 : (page - 1) * pageSize + i + 1}</td>
                    <td className="py-2 px-2 text-gray-400 font-mono text-[10px]">{r.ownerId}</td>
                    <td className="py-2 px-2 font-medium text-gray-900">{r.organizationName}</td>
                    <td className="py-2 px-2">
                      <div className="font-medium text-gray-900">{r.ownerName}</div>
                      <div className="text-gray-400">@{r.ownerUsername}</div>
                    </td>
                    <td className="py-2 px-2 text-gray-500">{r.ownerCity}</td>
                    <td className="py-2 px-2 text-gray-500">{r.ownerPhone}</td>
                    <td className="py-2 px-2 text-gray-500">{r.ownerEmail}</td>
                    <td className="py-2 px-2 text-right font-medium">{r.collections}</td>
                    <td className="py-2 px-2 text-right font-medium">{r.customers}</td>
                    <td className="py-2 px-2 text-right font-medium">{r.loans}</td>
                    <td className="py-2 px-2 text-right font-medium">{r.payments}</td>
                    <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{formatDateTime(r.lastLogin)}</td>
                    <td className="py-2 px-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        r.ownerActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {r.ownerActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <OwnerActions ownerId={r.ownerId} isActive={r.ownerActive} ownerName={r.ownerName} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3 px-1 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {showAll ? `All ${filtered.length}` : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length}`}
              </span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600"
              >
                {PAGE_SIZES.map(s => (
                  <option key={s} value={s}>{s === 0 ? 'All' : s}</option>
                ))}
              </select>
            </div>
            {totalPages > 1 && <div className="flex gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-xs text-gray-400">...</span>}
                    <button
                      onClick={() => setPage(p)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        p === page ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>}
          </div>
        </>
      )}
    </div>
  )
}
