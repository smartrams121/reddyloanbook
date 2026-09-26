'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Village {
  id: string
  name: string
  isActive: boolean
}

interface UserData {
  id: string
  fullName: string
  phone: string
  username: string
  role: string
  isActive: boolean
  villageAssignments: { village: { id: string; name: string } }[]
}

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams()
  const businessId = params.businessId as string
  const userId = params.userId as string

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')
  const [username, setUsername] = useState('')
  const [selectedVillages, setSelectedVillages] = useState<string[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/b/${businessId}/users`).then((r) => r.json()),
      fetch(`/api/b/${businessId}/villages`).then((r) => r.json()),
    ])
      .then(([users, villageData]) => {
        if (Array.isArray(villageData)) {
          setVillages(villageData.filter((v: Village) => v.isActive))
        }
        if (Array.isArray(users)) {
          const u = users.find((u: UserData) => u.id === userId)
          if (u) {
            setFullName(u.fullName)
            setPhone(u.phone || '')
            setRole(u.role)
            setUsername(u.username)
            setSelectedVillages(
              u.villageAssignments?.map((va: { village: { id: string } }) => va.village.id) || []
            )
          }
        }
      })
      .catch(() => setError('Failed to load user data'))
      .finally(() => setFetching(false))
  }, [businessId, userId])

  function toggleVillage(vid: string) {
    setSelectedVillages((prev) =>
      prev.includes(vid) ? prev.filter((v) => v !== vid) : [...prev, vid]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const body: Record<string, unknown> = { fullName, phone }
      if (role === 'AGENT') body.villageIds = selectedVillages

      const res = await fetch(`/api/b/${businessId}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to update user')
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

  if (fetching) {
    return (
      <div className="px-4 py-6 max-w-md mx-auto">
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <div className="mb-6">
        <Link href={`/b/${businessId}/users`} className="text-sm text-primary-600 hover:underline">
          ← Back to Users
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Edit User</h1>
        <p className="text-sm text-gray-500">@{username} &middot; {role === 'BUSINESS_ADMIN' ? 'Admin' : 'Agent'}</p>
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
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
