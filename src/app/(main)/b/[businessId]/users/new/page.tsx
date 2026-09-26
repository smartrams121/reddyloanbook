'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Village {
  id: string
  name: string
  isActive: boolean
}

export default function NewUserPage() {
  const router = useRouter()
  const params = useParams()
  const businessId = params.businessId as string

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'BUSINESS_ADMIN' | 'AGENT'>('AGENT')
  const [selectedVillages, setSelectedVillages] = useState<string[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/b/${businessId}/villages`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setVillages(data.filter((v: Village) => v.isActive))
        }
      })
      .catch(() => {})
  }, [businessId])

  function toggleVillage(vid: string) {
    setSelectedVillages((prev) =>
      prev.includes(vid) ? prev.filter((v) => v !== vid) : [...prev, vid]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setLoading(true)

    try {
      const res = await fetch(`/api/b/${businessId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          phone,
          username,
          password,
          role,
          businessIds: [businessId],
          villageIds: role === 'AGENT' ? selectedVillages : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.details) setFieldErrors(data.details)
        setError(data.error || 'Failed to create user')
        setLoading(false)
        return
      }

      router.push(`/b/${businessId}/users`)
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
        <Link href={`/b/${businessId}/users`} className="text-sm text-primary-600 hover:underline">
          ← Back to Users
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Add New User</h1>
        <p className="text-sm text-gray-500">User will be required to change password on first login.</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="role" className="label">Role</label>
            <select
              id="role"
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as 'BUSINESS_ADMIN' | 'AGENT')}
            >
              <option value="AGENT">Agent (Field Collector)</option>
              <option value="BUSINESS_ADMIN">Business Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="fullName" className="label">Full Name</label>
            <input
              id="fullName"
              type="text"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ramesh Babu"
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
              placeholder="e.g. ramesh_agent"
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

          {role === 'AGENT' && villages.length > 0 && (
            <div>
              <label className="label">Assign Villages</label>
              <div className="space-y-2 mt-1">
                {villages.map((v) => (
                  <label key={v.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedVillages.includes(v.id)}
                      onChange={() => toggleVillage(v.id)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{v.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link href={`/b/${businessId}/users`} className="btn-secondary flex-1 text-center">
              Cancel
            </Link>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
