'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  ownerId: string
  isActive: boolean
  ownerName: string
}

export default function OwnerActions({ ownerId, isActive, ownerName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [forceDelete, setForceDelete] = useState(false)

  async function toggleStatus() {
    const action = isActive ? 'suspend' : 'activate'
    if (!confirm(`Are you sure you want to ${action} this organization (${ownerName})?`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/owners/${ownerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      if (res.ok) router.refresh()
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  async function deleteOwner() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/owners/${ownerId}${forceDelete ? '?force=true' : ''}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to delete organization')
      }
    } finally {
      setLoading(false)
      setShowDeleteModal(false)
      setDeleteConfirm('')
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-gray-400 hover:text-gray-600 p-1"
        disabled={loading}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed right-8 z-50 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1" style={{ marginTop: '2px' }}>
            <button
              onClick={toggleStatus}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            >
              {isActive ? 'Suspend Organization' : 'Activate Organization'}
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => { setOpen(false); setShowDeleteModal(true); setDeleteConfirm('') }}
              className="w-full text-left px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
            >
              Delete Organization
            </button>
          </div>
        </>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-danger-700">Delete Organization</h3>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-700">
                Permanently delete <span className="font-semibold">{ownerName}</span> and all associated data — collections, customers, loans, payments, and employees.
              </p>
              <p className="text-sm text-danger-600 font-medium">This action cannot be undone.</p>
              <div>
                <label className="label">Type DELETE to confirm</label>
                <input
                  className="input"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={forceDelete}
                  onChange={(e) => setForceDelete(e.target.checked)}
                  className="w-4 h-4 rounded border-red-300 text-red-600"
                />
                <span className="text-xs text-red-600 font-medium">Force delete (remove all collections, customers, loans, payments)</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary px-4 py-2">Cancel</button>
              <button
                onClick={deleteOwner}
                disabled={deleteConfirm !== 'DELETE' || loading}
                className="bg-danger-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-danger-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting...' : 'Delete Organization'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
