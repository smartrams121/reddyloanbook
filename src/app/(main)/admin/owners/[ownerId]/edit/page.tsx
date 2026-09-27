'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface OwnerData {
  id: string
  fullName: string
  phone: string
  username: string
}

export default function EditOwnerPage() {
  const params = useParams()
  const router = useRouter()
  const ownerId = params.ownerId as string

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/owners/${ownerId}`)
      .then(r => r.json())
      .then((data: OwnerData) => {
        setFullName(data.fullName || '')
        setPhone(data.phone || '')
        setUsername(data.username || '')
      })
      .catch(() => setError('Failed to load owner details'))
      .finally(() => setFetching(false))
  }, [ownerId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/owners/${ownerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, username }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.details) setFieldErrors(data.details)
        setError(data.error || 'Failed to update owner')
        setLoading(false)
        return
      }

      router.push('/admin/owners')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  function getFieldError(field: string): string | undefined {
    return fieldErrors[field]?.[0]
  }

  if (fetching) {
    return (
      <div className="px-4 py-6 max-w-md mx-auto">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <div className="mb-6">
        <Link href="/admin/owners" className="text-sm text-primary-600 hover:underline">
          ← Back to Owners
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Edit Owner</h1>
        <p className="text-sm text-gray-500">Update owner details</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="label">Full Name</label>
            <input
              id="fullName"
              type="text"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            {getFieldError('fullName') && (
              <p className="text-xs text-danger-600 mt-1">{getFieldError('fullName')}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="label">Phone Number</label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              required
            />
            {getFieldError('phone') && (
              <p className="text-xs text-danger-600 mt-1">{getFieldError('phone')}</p>
            )}
          </div>

          <div>
            <label htmlFor="username" className="label">Username</label>
            <input
              id="username"
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoCapitalize="none"
              required
            />
            {getFieldError('username') && (
              <p className="text-xs text-danger-600 mt-1">{getFieldError('username')}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/admin/owners" className="btn-secondary flex-1 text-center">
              Cancel
            </Link>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
