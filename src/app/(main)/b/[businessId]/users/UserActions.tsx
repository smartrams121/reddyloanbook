'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ResetPasswordModal from '@/components/ResetPasswordModal'

interface Props {
  userId: string
  businessId: string
  isActive: boolean
  userName: string
}

export default function UserActions({ userId, businessId, isActive, userName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)

  async function toggleStatus() {
    const action = isActive ? 'deactivate' : 'activate'
    if (!confirm(`Are you sure you want to ${action} ${userName}?`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/b/${businessId}/users/${userId}`, {
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

  async function handleDelete() {
    if (!confirm(`Are you sure you want to remove ${userName} from this business? Their assigned loans will be unassigned.`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/b/${businessId}/users/${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        router.refresh()
      } else {
        alert(data.error || 'Failed to delete employee')
      }
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  async function handleResetPassword(password: string, note: string) {
    const res = await fetch(`/api/b/${businessId}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetPassword: password, resetNote: note }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to reset password')
    setShowResetModal(false)
    router.refresh()
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
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
            <a
              href={`/b/${businessId}/users/${userId}/edit`}
              className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            >
              Edit
            </a>
            <button
              onClick={toggleStatus}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            >
              {isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button
              onClick={() => { setOpen(false); setShowResetModal(true) }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            >
              Reset Password
            </button>
            <button
              onClick={handleDelete}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </>
      )}

      {showResetModal && (
        <ResetPasswordModal
          userName={userName}
          onConfirm={handleResetPassword}
          onCancel={() => setShowResetModal(false)}
        />
      )}
    </div>
  )
}
