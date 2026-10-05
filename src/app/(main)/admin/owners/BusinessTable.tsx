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

const PAGE_SIZE = 10

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
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      r.ownerName.toLowerCase().includes(q) ||
      r.ownerUsername.toLowerCase().includes(q) ||
      r.ownerPhone.includes(q) ||
      r.ownerEmail.toLowerCase().includes(q) ||
      r.organizationName.toLowerCase().includes(q) ||
      r.ownerCity.toLowerCase().includes(q)
    )
  }, [rows, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

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

      <input
        type="text"
        className="input mb-4"
        placeholder="Search by organization, owner, phone, city..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0) }}
      />

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">No organizations found.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="py-2 px-2 font-medium">#</th>
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
                    <td className="py-2 px-2 text-gray-400">{page * PAGE_SIZE + i + 1}</td>
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
              <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-2 py-1.5">Page {page + 1} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
