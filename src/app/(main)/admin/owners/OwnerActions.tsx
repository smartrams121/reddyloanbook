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

  async function toggleStatus() {
    const action = isActive ? 'suspend' : 'activate'
    if (!confirm(`Are you sure you want to ${action} ${ownerName}?`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/owners/${ownerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  async function resetPassword() {
    const newPass = prompt(`Enter new password for ${ownerName}:`)
    if (!newPass) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/owners/${ownerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetPassword: newPass }),
      })
      const data = await res.json()
      if (res.ok) {
        alert('Password reset successfully. Owner must change password on next login.')
        router.refresh()
      } else {
        alert(data.error || 'Failed to reset password')
      }
    } finally {
      setLoading(false)
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
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
            <button
              onClick={toggleStatus}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            >
              {isActive ? '🚫 Suspend Owner' : '✅ Activate Owner'}
            </button>
            <button
              onClick={resetPassword}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            >
              🔑 Reset Password
            </button>
          </div>
        </>
      )}
    </div>
  )
}
