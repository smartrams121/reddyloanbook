'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Village {
  id: string
  name: string
  businessId: string
}

interface Business {
  id: string
  name: string
  city: string
}

interface UserData {
  id: string
  fullName: string
  phone: string
  email: string | null
  username: string
  role: string
  isActive: boolean
  businessAssignments: { businessId: string }[]
  villageAssignments: { village: { id: string; name: string; businessId: string } }[]
}

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams()
  const businessId = params.businessId as string
  const userId = params.userId as string

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [username, setUsername] = useState('')
  const [selectedBusinesses, setSelectedBusinesses] = useState<string[]>([])
  const [selectedVillages, setSelectedVillages] = useState<string[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [allVillages, setAllVillages] = useState<Village[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/b/${businessId}/users/${userId}`).then((r) => r.json()),
      fetch('/api/owner/businesses').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/owner/villages').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([userData, bizData, villageData]: [UserData, Business[], Village[]]) => {
        if (userData && !('error' in userData)) {
          setFullName(userData.fullName)
          setPhone(userData.phone || '')
          setEmail(userData.email || '')
          setRole(userData.role)
          setUsername(userData.username)
          setSelectedBusinesses(
            userData.businessAssignments?.map((ba) => ba.businessId) || [businessId]
          )
          setSelectedVillages(
            userData.villageAssignments?.map((va) => va.village.id) || []
          )
        }
        if (Array.isArray(bizData)) setBusinesses(bizData)
        if (Array.isArray(villageData)) setAllVillages(villageData)
      })
      .catch(() => setError('Failed to load employee data'))
      .finally(() => setFetching(false))
  }, [businessId, userId])

  function toggleBusiness(bid: string) {
    setSelectedBusinesses((prev) => {
      const next = prev.includes(bid) ? prev.filter((b) => b !== bid) : [...prev, bid]
      const removedBiz = prev.includes(bid) && !next.includes(bid) ? bid : null
      if (removedBiz) {
        const villageIdsToRemove = allVillages
          .filter((v) => v.businessId === removedBiz)
          .map((v) => v.id)
        setSelectedVillages((sv) => sv.filter((vid) => !villageIdsToRemove.includes(vid)))
      }
      return next
    })
  }

  function toggleVillage(vid: string) {
    setSelectedVillages((prev) =>
      prev.includes(vid) ? prev.filter((v) => v !== vid) : [...prev, vid]
    )
  }

  const filteredVillages = allVillages.filter((v) => selectedBusinesses.includes(v.businessId))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (businesses.length > 1 && selectedBusinesses.length === 0) {
      setError('Assign at least one business')
      return
    }

    setLoading(true)

    try {
      const body: Record<string, unknown> = { fullName, phone, email: email || null }
      if (role === 'AGENT') body.villageIds = selectedVillages
      if (businesses.length > 1) body.businessIds = selectedBusinesses

      const res = await fetch(`/api/b/${businessId}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to update employee')
        setLoading(false)
        return
      }

      router.push(`/b/${businessId}/employees`)
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
        <Link href={`/b/${businessId}/employees`} className="text-sm text-primary-600 hover:underline">
          ← Back to Employees
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Edit Employee</h1>
        <p className="text-sm text-gray-500">
          @{username} &middot; {role === 'BUSINESS_ADMIN' ? 'Partner' : 'Agent'}
        </p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="label">
              Full Name
            </label>
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
            <label htmlFor="phone" className="label">
              Phone Number
            </label>
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

          <div>
            <label htmlFor="email" className="label">
              Email (optional)
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@example.com"
            />
          </div>

          {businesses.length > 1 && (
            <div>
              <label className="label">Assign Businesses</label>
              <p className="text-xs text-gray-500 mb-2">
                Select which businesses this employee can access
              </p>
              <div className="space-y-2 mt-1">
                {businesses.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedBusinesses.includes(b.id)}
                      onChange={() => toggleBusiness(b.id)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">
                      {b.name} <span className="text-gray-400">({b.city})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {role === 'AGENT' && filteredVillages.length > 0 && (
            <div>
              <label className="label">Assign Locations</label>
              <div className="space-y-2 mt-1">
                {filteredVillages.map((v) => {
                  const biz = businesses.find((b) => b.id === v.businessId)
                  return (
                    <label key={v.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedVillages.includes(v.id)}
                        onChange={() => toggleVillage(v.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">
                        {v.name}
                        {businesses.length > 1 && biz && (
                          <span className="text-gray-400 ml-1">— {biz.name}</span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link href={`/b/${businessId}/employees`} className="btn-secondary flex-1 text-center">
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
