'use client'

import { useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface CustomerRow {
  id: string
  customerId: string
  fullName: string
  phone: string
  status: string
  village: { id: string; name: string }
  _count: { loans: number }
}

interface VillageOption {
  id: string
  name: string
}

interface Props {
  customers: CustomerRow[]
  villages: VillageOption[]
  businessId: string
  isAdminOrOwner: boolean
}

export default function CustomerList({ customers, villages, businessId, isAdminOrOwner }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'none' | 'status' | 'village'>('none')
  const [bulkStatus, setBulkStatus] = useState('ACTIVE')
  const [bulkVillage, setBulkVillage] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const allIds = customers.map(c => c.id)
  const allSelected = customers.length > 0 && selected.size === customers.length

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
    setBulkAction('none')
    setError('')
  }

  const handleBulkEdit = useCallback(async () => {
    setError('')
    const ids = Array.from(selected)

    let body: Record<string, unknown> = { customerIds: ids }
    if (bulkAction === 'status') {
      body = { ...body, action: 'changeStatus', status: bulkStatus }
    } else if (bulkAction === 'village') {
      if (!bulkVillage) { setError('Select a village'); return }
      body = { ...body, action: 'changeVillage', villageId: bulkVillage }
    } else {
      return
    }

    setProcessing(true)
    try {
      const res = await fetch(`/api/b/${businessId}/customers/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to update'); return }
      clearSelection()
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setProcessing(false)
    }
  }, [selected, bulkAction, bulkStatus, bulkVillage, businessId, router])

  const handleBulkDelete = useCallback(async () => {
    const count = selected.size
    if (!confirm(`Are you sure you want to delete ${count} customer${count > 1 ? 's' : ''}? This will also delete their closed loans and payment history. This action cannot be undone.`)) return

    setError('')
    setProcessing(true)
    try {
      const res = await fetch(`/api/b/${businessId}/customers/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: Array.from(selected) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to delete'); return }
      clearSelection()
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setProcessing(false)
    }
  }, [selected, businessId, router])

  return (
    <>
      {/* Bulk Action Bar */}
      {selected.size > 0 && isAdminOrOwner && (
        <div className="sticky top-0 z-10 bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-primary-800">
              {selected.size} customer{selected.size > 1 ? 's' : ''} selected
            </span>
            <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-700">
              Clear
            </button>
          </div>

          {error && (
            <div className="text-xs text-danger-700 bg-danger-50 px-3 py-2 rounded">{error}</div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk Edit: Status */}
            <div className="flex items-center gap-1">
              <select
                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                value={bulkAction === 'status' ? bulkStatus : ''}
                onChange={(e) => {
                  setBulkAction('status')
                  setBulkStatus(e.target.value)
                }}
              >
                <option value="" disabled>Change Status...</option>
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
                <option value="DEFAULTER">Defaulter</option>
              </select>
            </div>

            {/* Bulk Edit: Village */}
            <div className="flex items-center gap-1">
              <select
                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                value={bulkAction === 'village' ? bulkVillage : ''}
                onChange={(e) => {
                  setBulkAction('village')
                  setBulkVillage(e.target.value)
                }}
              >
                <option value="" disabled>Move to Village...</option>
                {villages.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {bulkAction !== 'none' && (
              <button
                onClick={handleBulkEdit}
                disabled={processing}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {processing ? 'Updating...' : 'Apply'}
              </button>
            )}

            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* Delete */}
            <button
              onClick={handleBulkDelete}
              disabled={processing}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-danger-600 text-white hover:bg-danger-700 disabled:opacity-50"
            >
              {processing ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Customer List */}
      <div className="space-y-2">
        {customers.length > 0 && isAdminOrOwner && (
          <div className="flex items-center gap-3 px-1 mb-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-500">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Select All
            </label>
          </div>
        )}

        {customers.map((c) => (
          <div
            key={c.id}
            className={`card p-3 flex items-center gap-3 transition-colors ${selected.has(c.id) ? 'border-primary-400 bg-primary-25' : 'hover:border-primary-300'}`}
          >
            {isAdminOrOwner && (
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggleOne(c.id)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 shrink-0"
              />
            )}
            <Link
              href={`/b/${businessId}/customers/${c.id}`}
              className="flex items-center justify-between flex-1 min-w-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-sm font-bold shrink-0">
                  {c.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.fullName}</p>
                  <p className="text-xs text-gray-500">{c.customerId} &middot; {c.phone} &middot; {c.village.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  c.status === 'ACTIVE' ? 'bg-success-50 text-success-700' :
                  c.status === 'DEFAULTER' ? 'bg-danger-50 text-danger-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {c.status}
                </span>
                <span className="text-xs text-gray-400">{c._count.loans} loans</span>
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </Link>
          </div>
        ))}

        {customers.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-gray-500 mb-4">No customers found.</p>
            {isAdminOrOwner && (
              <Link href={`/b/${businessId}/customers/new`} className="btn-primary">
                Add First Customer
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  )
}
