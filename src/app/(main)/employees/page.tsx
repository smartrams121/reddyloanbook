'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'

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
  const { t } = useTranslation()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [actionMenu, setActionMenu] = useState<string | null>(null)

  // Create form
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('AGENT')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRole, setEditRole] = useState('')
  const [saving, setSaving] = useState(false)

  function loadEmployees() {
    fetch('/api/owner/employees')
      .then(r => r.json())
      .then(data => { if (data.employees) setEmployees(data.employees); else if (Array.isArray(data)) setEmployees(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadEmployees() }, [])

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
      if (!res.ok) { setError(data.error || 'Failed to create'); return }
      setSuccess(`Created ${data.fullName} (${data.username})`)
      setFullName(''); setUsername(''); setPhone(''); setPassword(''); setRole('AGENT')
      setShowCreate(false)
      loadEmployees()
    } catch { setError('Network error') }
    finally { setCreating(false) }
  }

  function startEdit(emp: Employee) {
    setEditingId(emp.id)
    setEditName(emp.fullName)
    setEditPhone(emp.phone || '')
    setEditRole(emp.role)
    setActionMenu(null)
  }

  async function handleSaveEdit() {
    if (!editingId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/owner/employees/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: editName, phone: editPhone, role: editRole }),
      })
      if (res.ok) {
        setEditingId(null)
        setSuccess('Employee updated')
        loadEmployees()
      }
    } catch {}
    finally { setSaving(false) }
  }

  async function handleResetPassword(emp: Employee) {
    setActionMenu(null)
    if (!confirm(`Reset ${emp.fullName}'s password to their username (${emp.username})?`)) return
    try {
      const res = await fetch(`/api/owner/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password' }),
      })
      const data = await res.json()
      if (res.ok) setSuccess(data.message)
    } catch {}
  }

  async function handleToggleSuspend(emp: Employee) {
    setActionMenu(null)
    try {
      const res = await fetch(`/api/owner/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suspend' }),
      })
      if (res.ok) {
        setSuccess(`${emp.fullName} ${emp.isActive ? 'suspended' : 'activated'}`)
        loadEmployees()
      }
    } catch {}
  }

  async function handleDelete(emp: Employee) {
    setActionMenu(null)
    if (!confirm(`Permanently delete ${emp.fullName}? This will remove all their assignments.`)) return
    try {
      const res = await fetch(`/api/owner/employees/${emp.id}`, { method: 'DELETE' })
      if (res.ok) {
        setSuccess(`${emp.fullName} deleted`)
        loadEmployees()
      }
    } catch {}
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
          <h1 className="text-xl font-bold text-gray-900">{t('common.employees')}</h1>
          <p className="text-sm text-gray-500">{employees.length} employees across all businesses</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm">
          + {t('common.new_employee')}
        </button>
      </div>

      {error && <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg mb-4">{success}</div>}

      {/* Create Form */}
      {showCreate && (
        <div className="card p-4 space-y-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('common.create_employee')}</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="label">{t('profile.full_name')} *</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('auth.username')} *</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} required />
              </div>
              <div>
                <label className="label">{t('auth.password')} *</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('common.phone')}</label>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className="label">{t('common.role')} *</label>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="AGENT">Agent</option>
                  <option value="BUSINESS_ADMIN">Partner</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating} className="btn-primary text-sm flex-1">
                {creating ? t('common.creating') : t('common.create')}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm flex-1">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employee List */}
      {employees.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm">{t('common.no_employees_yet')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {employees.map((emp) => (
            <div key={emp.id} className="card p-4">
              {/* Edit Mode */}
              {editingId === emp.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="label text-xs">{t('profile.full_name')}</label>
                    <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">{t('common.phone')}</label>
                      <input className="input" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-xs">{t('common.role')}</label>
                      <select className="input" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                        <option value="AGENT">Agent</option>
                        <option value="BUSINESS_ADMIN">Partner</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} disabled={saving} className="btn-primary text-xs flex-1">
                      {saving ? t('common.saving') : t('common.save')}
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary text-xs flex-1">{t('common.cancel')}</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                    {emp.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{emp.fullName}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        emp.role === 'AGENT' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                      }`}>
                        {emp.role === 'BUSINESS_ADMIN' ? t('profile.role_admin') : t('profile.role_agent')}
                      </span>
                      {!emp.isActive && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">{t('common.suspended')}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">@{emp.username}{emp.phone ? ` · ${emp.phone}` : ''}</p>
                    {emp.businesses.length > 0 ? (
                      <p className="text-[10px] text-gray-400 mt-0.5">{emp.businesses.join(', ')}</p>
                    ) : (
                      <p className="text-[10px] text-amber-500 mt-0.5">{t('common.not_assigned_to_business')}</p>
                    )}
                  </div>

                  {/* Action Menu */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setActionMenu(actionMenu === emp.id ? null : emp.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </button>

                    {actionMenu === emp.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 w-44 py-1">
                        <button onClick={() => startEdit(emp)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          {t('common.edit')}
                        </button>
                        <button onClick={() => handleResetPassword(emp)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          {t('common.reset_password')}
                        </button>
                        <button onClick={() => handleToggleSuspend(emp)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          {emp.isActive ? t('common.suspend') : t('common.activate')}
                        </button>
                        <button onClick={() => handleDelete(emp)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                          {t('common.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
