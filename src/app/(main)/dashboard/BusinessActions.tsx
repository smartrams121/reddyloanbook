'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Props {
  businessId: string
  businessName: string
}

export default function BusinessActions({ businessId, businessName }: Props) {
  const router = useRouter()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archiveBusiness', businessId }),
      })
      if (res.ok) {
        router.refresh()
      }
    } catch { /* ignore */ } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
      <Link
        href={`/b/${businessId}/settings`}
        className="text-xs font-medium text-primary-600 px-2 py-1 rounded hover:bg-primary-50 transition-colors"
      >
        Edit
      </Link>

      {confirmRemove ? (
        <span className="flex items-center gap-1">
          <button
            onClick={handleRemove}
            disabled={removing}
            className="text-xs font-medium text-white bg-danger-600 px-2 py-1 rounded"
          >
            {removing ? '...' : `Remove "${businessName}"?`}
          </button>
          <button
            onClick={() => setConfirmRemove(false)}
            className="text-xs text-gray-500 px-2 py-1"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirmRemove(true)}
          className="text-xs font-medium text-danger-600 px-2 py-1 rounded hover:bg-danger-50 transition-colors"
        >
          Remove
        </button>
      )}
    </div>
  )
}
