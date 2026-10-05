'use client'

import { useState, useEffect, useCallback } from 'react'

interface RegistrationRequest {
  id: string
  fullName: string
  phone: string
  email: string | null
  username: string
  businessName: string
  city: string
  villages: string[]
  collectionType: string
  defaultCollectionDay: string | null
  status: string
  rejectionReason: string | null
  reviewedAt: string | null
  createdAt: string
  duplicatePhone: boolean
}

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'

export default function RegistrationRequestsPage() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RegistrationRequest | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState('')

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/admin/registration-requests?${params}`)
      const data = await res.json()
      if (Array.isArray(data)) setRequests(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  async function handleApprove(id: string) {
    if (!confirm('Approve this registration? This will create the Owner account and business.')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/registration-requests/${id}/approve`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || 'Registration approved')
        setSelected(null)
        fetchRequests()
      } else {
        showToast(data.error || 'Approval failed')
      }
    } catch {
      showToast('Network error')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/registration-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Registration rejected')
        setSelected(null)
        setRejectModal(false)
        setRejectReason('')
        fetchRequests()
      } else {
        showToast(data.error || 'Rejection failed')
      }
    } catch {
      showToast('Network error')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this rejected request permanently?')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/registration-requests/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Request deleted')
        setSelected(null)
        fetchRequests()
      } else {
        const data = await res.json()
        showToast(data.error || 'Delete failed')
      }
    } catch {
      showToast('Network error')
    } finally {
      setActionLoading(false)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    )
  }

  const tabs: StatusFilter[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED']

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Registration Requests</h1>
      <p className="text-sm text-gray-500 mb-4">Review and manage owner registration requests</p>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg max-w-xs">
          {toast}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <input
          className="input flex-1 text-sm"
          placeholder="Search by name, username, phone, or business..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No registration requests found</div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              onClick={() => setSelected(selected?.id === req.id ? null : req)}
              className={`card p-4 cursor-pointer transition-colors hover:ring-1 hover:ring-primary-200 ${
                selected?.id === req.id ? 'ring-2 ring-primary-500' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{req.fullName}</p>
                    {statusBadge(req.status)}
                    {req.duplicatePhone && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        Duplicate Phone
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    @{req.username} &middot; {req.phone} &middot; {req.businessName}, {req.city}
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 whitespace-nowrap">{formatDate(req.createdAt)}</p>
              </div>

              {/* Detail panel */}
              {selected?.id === req.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs">Full Name</p>
                      <p className="text-gray-900">{req.fullName}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Username</p>
                      <p className="text-gray-900">@{req.username}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Phone</p>
                      <p className="text-gray-900">{req.phone}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Email</p>
                      <p className="text-gray-900">{req.email || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Business Name</p>
                      <p className="text-gray-900">{req.businessName}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">City</p>
                      <p className="text-gray-900">{req.city}</p>
                    </div>
                  </div>

                  {req.rejectionReason && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-600 font-medium">Rejection Reason</p>
                      <p className="text-sm text-red-800 mt-0.5">{req.rejectionReason}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    {req.status === 'PENDING' && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(req.id) }}
                          disabled={actionLoading}
                          className="btn-primary text-sm px-4 py-2"
                        >
                          {actionLoading ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRejectModal(true); setRejectReason('') }}
                          disabled={actionLoading}
                          className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {req.status === 'REJECTED' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(req.id) }}
                        disabled={actionLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && selected && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setRejectModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Reject Registration</h3>
              <p className="text-sm text-gray-500 mb-4">
                Provide a reason for rejecting {selected.fullName}&apos;s registration request.
              </p>
              <textarea
                className="input w-full"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                autoFocus
              />
              <div className="flex gap-2 mt-4 justify-end">
                <button
                  onClick={() => setRejectModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(selected.id)}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
