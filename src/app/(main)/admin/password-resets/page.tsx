'use client'

import { useState, useEffect, useCallback } from 'react'
import ResetPasswordModal from '@/components/ResetPasswordModal'

interface ResetRequest {
  id: string
  status: string
  note: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  ipAddress: string | null
  createdAt: string
  user: {
    id: string
    fullName: string
    username: string
    phone: string | null
    role: string
    isActive: boolean
  }
}

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

export default function AdminPasswordResetsPage() {
  const [requests, setRequests] = useState<ResetRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<ResetRequest | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ResetRequest | null>(null)
  const [cancelNote, setCancelNote] = useState('')
  const [toast, setToast] = useState('')

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/password-resets?${params}`)
      const data = await res.json()
      if (Array.isArray(data)) setRequests(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function daysSince(date: string) {
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  }

  async function handleReset(password: string, note: string) {
    if (!resetTarget) return
    const res = await fetch(`/api/admin/password-resets/${resetTarget.id}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: password, note }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed')
    setResetTarget(null)
    showToast(`Password reset for ${resetTarget.user.fullName}`)
    fetchRequests()
  }

  async function handleCancel() {
    if (!cancelTarget) return
    const res = await fetch(`/api/admin/password-resets/${cancelTarget.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: cancelNote }),
    })
    if (res.ok) {
      setCancelTarget(null)
      setCancelNote('')
      showToast('Request cancelled')
      fetchRequests()
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Password Reset Requests</h1>
      <p className="text-sm text-gray-500 mb-4">Owner password reset requests</p>

      {/* Search */}
      <input
        type="text"
        className="input mb-4"
        placeholder="Search by name, username, or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === tab.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No requests found</div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isExpanded = expandedId === req.id
            const stale = req.status === 'PENDING' && daysSince(req.createdAt) >= 7
            return (
              <div key={req.id} className="card">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="w-full text-left px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900">{req.user.fullName}</span>
                      <span className="text-xs text-gray-400 ml-2">@{req.user.username}</span>
                      {!req.user.isActive && (
                        <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Suspended</span>
                      )}
                      {stale && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Stale</span>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      req.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Requested: {new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {req.user.phone && ` · Phone: ${req.user.phone}`}
                  </p>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-400">Username:</span> {req.user.username}</div>
                      <div><span className="text-gray-400">Phone:</span> {req.user.phone || 'N/A'}</div>
                      <div><span className="text-gray-400">Account:</span> {req.user.isActive ? 'Active' : 'Suspended'}</div>
                      <div><span className="text-gray-400">IP:</span> {req.ipAddress || 'N/A'}</div>
                    </div>
                    {req.note && <p className="text-xs text-gray-600">Note: {req.note}</p>}
                    {req.resolvedAt && (
                      <p className="text-xs text-gray-400">
                        Resolved: {new Date(req.resolvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}

                    {req.status === 'PENDING' && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setResetTarget(req)}
                          className="btn-primary px-3 py-1.5 text-xs"
                        >
                          Reset Password
                        </button>
                        <button
                          onClick={() => { setCancelTarget(req); setCancelNote('') }}
                          className="btn-secondary px-3 py-1.5 text-xs"
                        >
                          Cancel Request
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <ResetPasswordModal
          userName={resetTarget.user.fullName}
          onConfirm={handleReset}
          onCancel={() => setResetTarget(null)}
        />
      )}

      {/* Cancel Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Cancel Request</h3>
              <p className="text-sm text-gray-500">Cancel reset request for {cancelTarget.user.fullName}</p>
            </div>
            <div className="p-6">
              <label className="label">Note (optional)</label>
              <input
                type="text"
                className="input"
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder="Reason for cancellation..."
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setCancelTarget(null)} className="btn-secondary px-4 py-2">Back</button>
              <button onClick={handleCancel} className="bg-danger-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-danger-700">Cancel Request</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
