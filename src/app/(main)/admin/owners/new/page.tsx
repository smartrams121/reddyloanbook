'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewOwnerPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setLoading(true)

    try {
      const res = await fetch('/api/admin/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.details) {
          setFieldErrors(data.details)
        }
        setError(data.error || 'Failed to create owner')
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

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <div className="mb-6">
        <Link href="/admin/owners" className="text-sm text-primary-600 hover:underline">
          ← Back to Owners
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Register New Owner</h1>
        <p className="text-sm text-gray-500">Owner will be required to change password on first login.</p>
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
              placeholder="e.g. Rajesh Kumar"
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
              placeholder="e.g. rajesh_kumar"
              autoCapitalize="none"
              required
            />
            {getFieldError('username') && (
              <p className="text-xs text-danger-600 mt-1">{getFieldError('username')}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="label">Initial Password</label>
            <input
              id="password"
              type="text"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 chars, 1 uppercase, 1 number, 1 special"
              required
            />
            {getFieldError('password') && (
              <p className="text-xs text-danger-600 mt-1">{getFieldError('password')}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/admin/owners" className="btn-secondary flex-1 text-center">
              Cancel
            </Link>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create Owner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
