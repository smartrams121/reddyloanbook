'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { T } from '@/lib/i18n'
import { formatPaiseShort } from '@/lib/money'

interface CollectionStat {
  business: {
    id: string
    name: string
    collectionType: string
  }
  customerCount: number
  activeLoanCount: number
  totalOutstanding: number
  todayCollection: number
  todayNewLoanCount: number
  todayDisbursed: number
}

const PAGE_SIZES = [15, 25, 50, 100, 0] as const

export default function CollectionList({ stats }: { stats: CollectionStat[] }) {
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(0)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search.trim()) return stats
    const q = search.toLowerCase()
    return stats.filter(s =>
      s.business.name.toLowerCase().includes(q) ||
      s.business.collectionType.toLowerCase().includes(q)
    )
  }, [stats, search])

  const showAll = pageSize === 0
  const totalPages = showAll ? 1 : Math.ceil(filtered.length / pageSize)
  const paged = showAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <>
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          className="input pl-9 pr-8"
          placeholder="Search by collection name, type..."
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

      <div className="space-y-2">
        {paged.map(({ business, customerCount, totalOutstanding, todayCollection }) => (
          <div key={business.id} className="card p-4 hover:border-primary-300 transition-colors">
            <Link
              href={`/b/${business.id}/dashboard`}
              className="flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{business.name}</h3>
                <p className="text-xs text-gray-500">{business.collectionType} &middot; {customerCount} <T k="dashboard.customers" /></p>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">{formatPaiseShort(totalOutstanding)}</div>
                <div className="text-xs text-success-600">+{formatPaiseShort(todayCollection)} <T k="dashboard.today_suffix" /></div>
              </div>
            </Link>
          </div>
        ))}

        {filtered.length === 0 && stats.length > 0 && (
          <div className="card p-8 text-center">
            <p className="text-gray-500">No collections match your search.</p>
          </div>
        )}

        {stats.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-gray-500 mb-4"><T k="dashboard.no_businesses" /></p>
            <Link href="/businesses/new" className="btn-primary">
              <T k="dashboard.register_first_collection" />
            </Link>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
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
      )}
    </>
  )
}
