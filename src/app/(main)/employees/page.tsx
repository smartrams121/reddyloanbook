'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Employee {
  id: string
  fullName: string
  username: string
  phone: string | null
  role: string
  isActive: boolean
  businesses: string[]
}

export default function EmployeesPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // Create form
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('AGENT')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/owner/employees')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEmployees(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCreating(true)

    try {
      const res = await fetch('/api/owner/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, username, phone: phone || undefined, role, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create employee')
        return
      }
      setSuccess(`Created ${data.fullName} (${data.username})`)
      setFullName('')
      setUsername('')
      setPhone('')
      setPassword('')
      setRole('AGENT')
      setShowCreate(false)

      // Refresh list
      const listRes = await fetch('/api/owner/employees')
      const listData = await listRes.json()
      if (Array.isArray(listData)) setEmployees(listData)
    } catch {
      setError('Network error')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500">{employees.length} employees across all businesses</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary text-sm"
        >
          + New Employee
        </button>
      </div>

      {error && <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg mb-4">{success}</div>}

      {/* Create Form */}
      {showCreate && (
        <div className="card p-4 space-y-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Create Employee</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Username *</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} required />
              </div>
              <div>
                <label className="label">Password *</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Phone</label>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className="label">Role *</label>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="AGENT">Agent</option>
                  <option value="BUSINESS_ADMIN">Business Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating} className="btn-primary text-sm flex-1">
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm flex-1">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employee List */}
      {employees.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm">No employees yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {employees.map((emp) => (
            <div key={emp.id} className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                {emp.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{emp.fullName}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    emp.role === 'AGENT' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                  }`}>
                    {emp.role === 'BUSINESS_ADMIN' ? 'Admin' : 'Agent'}
                  </span>
                  {!emp.isActive && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">Inactive</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">@{emp.username}{emp.phone ? ` · ${emp.phone}` : ''}</p>
                {emp.businesses.length > 0 ? (
                  <p className="text-[10px] text-gray-400 mt-0.5">{emp.businesses.join(', ')}</p>
                ) : (
                  <p className="text-[10px] text-amber-500 mt-0.5">Not assigned to any business</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
