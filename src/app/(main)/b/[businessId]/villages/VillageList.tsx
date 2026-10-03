'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Village {
  id: string
  name: string
  isActive: boolean
  customerCount: number
  agents: { id: string; fullName: string }[]
}

interface Props {
  villages: Village[]
  businessId: string
  canAdd: boolean
  canEdit: boolean
}

const PAGE_SIZES = [15, 25, 50, 100, 0] as const

export default function VillageList({ villages, businessId, canAdd, canEdit }: Props) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 15)

  const showAllPages = pageSize === 0
  const totalPages = showAllPages ? 1 : Math.ceil(villages.length / pageSize)
  const pagedVillages = showAllPages ? villages : villages.slice((page - 1) * pageSize, page * pageSize)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`/api/b/${businessId}/villages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to add location')
        setLoading(false)
        return
      }
      setNewName('')
      setShowAdd(false)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleEdit(villageId: string) {
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`/api/b/${businessId}/villages/${villageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to update location')
        setLoading(false)
        return
      }
      setEditId(null)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(villageId: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/b/${businessId}/villages/${villageId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to delete location'); return }
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(villageId: string, currentlyActive: boolean) {
    if (!confirm(`Are you sure you want to ${currentlyActive ? 'deactivate' : 'activate'} this location?`)) return

    const res = await fetch(`/api/b/${businessId}/villages/${villageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !currentlyActive }),
    })
    if (res.ok) router.refresh()
  }

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">Locations</h1>
        {canAdd && (
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary btn-sm">
            + Add Location
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">{villages.length} location(s)</p>

      {error && (
        <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="card p-4 mb-4 flex gap-2">
          <input
            type="text"
            className="input flex-1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Location name"
            autoFocus
            required
          />
          <button type="submit" disabled={loading} className="btn-primary btn-sm whitespace-nowrap">
            {loading ? '...' : 'Add'}
          </button>
          <button type="button" onClick={() => { setShowAdd(false); setNewName('') }} className="btn-secondary btn-sm">
            Cancel
          </button>
        </form>
      )}

      <div className="space-y-2">
        {pagedVillages.map((v) => (
          <div key={v.id} className={`card p-4 ${!v.isActive ? 'opacity-60' : ''}`}>
            {editId === v.id ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
                <button onClick={() => handleEdit(v.id)} disabled={loading} className="btn-primary btn-sm">
                  Save
                </button>
                <button onClick={() => setEditId(null)} className="btn-secondary btn-sm">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <Link href={`/b/${businessId}/villages/${v.id}`} className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 hover:text-primary-600 transition-colors">
                    {v.name}
                    {!v.isActive && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {v.customerCount} customers
                    {v.agents.length > 0 && <> · {v.agents.map((a, i) => (
                      <span key={a.id}>{i > 0 && ', '}<Link href={`/b/${businessId}/users/${a.id}`} className="text-primary-600 hover:underline" onClick={e => e.stopPropagation()}>{a.fullName}</Link></span>
                    ))}</>}
                  </p>
                </Link>
                {canEdit && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditId(v.id); setEditName(v.name) }}
                      className="text-xs text-primary-600 hover:underline px-2 py-1"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(v.id, v.isActive)}
                      className={`text-xs px-2 py-1 ${v.isActive ? 'text-red-600' : 'text-green-600'} hover:underline`}
                    >
                      {v.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(v.id, v.name)}
                      disabled={loading}
                      className="text-xs px-2 py-1 text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {villages.length === 0 && (
          <div className="card p-8 text-center text-gray-400">
            No locations yet. Add one to get started.
          </div>
        )}
      </div>

      {/* Pagination */}
      {villages.length > 0 && (
        <div className="flex items-center justify-between mt-3 px-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {showAllPages ? `All ${villages.length}` : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, villages.length)} of ${villages.length}`}
            </span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s === 0 ? 'All' : s}</option>)}
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
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">Next</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">Last</button>
          </div>}
        </div>
      )}
    </div>
  )
}
