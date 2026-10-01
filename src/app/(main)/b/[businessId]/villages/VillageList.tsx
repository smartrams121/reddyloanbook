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

export default function VillageList({ villages, businessId, canAdd, canEdit }: Props) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        {villages.map((v) => (
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
    </div>
  )
}
