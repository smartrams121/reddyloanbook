'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import PasswordResetShareModal from '@/components/ui/PasswordResetShareModal'

const PAGE_SIZES = [15, 25, 50, 100, 0] as const

interface Employee {
  id: string
  fullName: string
  username: string
  phone: string | null
  email: string | null
  role: string
  isActive: boolean
  businesses: string[]
  businessIds?: string[]
  backdateValue: number
  backdateUnit: string
  backdatingDays: number | null
}

export default function EmployeesPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [resetConfirmTarget, setResetConfirmTarget] = useState<Employee | null>(null)
  const [shareTarget, setShareTarget] = useState<{ fullName: string; username: string; phone?: string | null; email?: string | null; password?: string; variant?: 'password-reset' | 'employee-created' } | null>(null)

  // Create form
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('AGENT')
  const [password, setPassword] = useState('')
  const [backdateValue, setBackdateValue] = useState('4')
  const [backdateUnit, setBackdateUnit] = useState('HOURS')
  const [backdatingPermission, setBackdatingPermission] = useState<'unlimited' | 'restrict'>('unlimited')
  const [backdatingDays, setBackdatingDays] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editBackdateValue, setEditBackdateValue] = useState('4')
  const [editBackdateUnit, setEditBackdateUnit] = useState('HOURS')
  const [editBackdatingPermission, setEditBackdatingPermission] = useState<'unlimited' | 'restrict'>('unlimited')
  const [editBackdatingDays, setEditBackdatingDays] = useState('')
  const [saving, setSaving] = useState(false)

  // Search + pagination
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(0)
  const [page, setPage] = useState(1)

  // Business ID to name mapping
  const businessMap = useMemo(() => {
    const map: Record<string, string> = {}
    businesses.forEach(b => { map[b.id] = b.name })
    return map
  }, [businesses])

  const filtered = useMemo(() => {
    if (!search.trim()) return employees
    const q = search.toLowerCase()
    return employees.filter(emp =>
      emp.fullName.toLowerCase().includes(q) ||
      emp.username.toLowerCase().includes(q) ||
      (emp.phone && emp.phone.includes(q)) ||
      emp.role.toLowerCase().includes(q) ||
      emp.businesses.some(b => b.toLowerCase().includes(q))
    )
  }, [employees, search])

  const showAll = pageSize === 0
  const totalPages = showAll ? 1 : Math.ceil(filtered.length / pageSize)
  const paged = showAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

  function loadEmployees() {
    fetch('/api/owner/employees')
      .then(r => r.json())
      .then(data => { if (data.employees) setEmployees(data.employees); else if (Array.isArray(data)) setEmployees(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadEmployees()
    fetch('/api/owner/businesses').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setBusinesses(data)
    }).catch(() => {})
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!fullName || !username || !password) { setError('Required fields missing'); return }

    if (role === 'AGENT' && backdatingPermission === 'restrict') {
      if (backdatingDays === '') { setError('Please enter the number of backdating days'); return }
      const days = parseInt(backdatingDays)
      if (days < 0) { setError('Must be 0 or greater'); return }
      if (days > 365) { setError('Cannot exceed 365 days'); return }
    }

    setCreating(true)
    try {
      const res = await fetch('/api/owner/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, username, phone: phone || undefined, role, password,
          ...(role === 'AGENT' ? {
            backdateValue: parseInt(backdateValue) || 4,
            backdateUnit,
            backdatingDays: backdatingPermission === 'restrict' ? parseInt(backdatingDays) : null
          } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create'); return }
      const createdPassword = password
      setShareTarget({ variant: 'employee-created', fullName: data.fullName, username: data.username, phone: phone || null, email: null, password: createdPassword })
      setFullName(''); setUsername(''); setPhone(''); setPassword(''); setRole('AGENT'); setBackdateValue('4'); setBackdateUnit('HOURS'); setBackdatingPermission('unlimited'); setBackdatingDays('')
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
    setEditBackdateValue(String(emp.backdateValue ?? 4))
    setEditBackdateUnit(emp.backdateUnit ?? 'HOURS')
    setEditBackdatingPermission(emp.backdatingDays !== null && emp.backdatingDays !== undefined ? 'restrict' : 'unlimited')
    setEditBackdatingDays(emp.backdatingDays?.toString() ?? '')
    setActionMenu(null)
  }

  async function handleSaveEdit() {
    if (!editingId) return

    if (editRole === 'AGENT' && editBackdatingPermission === 'restrict') {
      if (editBackdatingDays === '') { setError('Please enter the number of backdating days'); return }
      const days = parseInt(editBackdatingDays)
      if (days < 0) { setError('Must be 0 or greater'); return }
      if (days > 365) { setError('Cannot exceed 365 days'); return }
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/owner/employees/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editName, phone: editPhone, role: editRole,
          ...(editRole === 'AGENT' ? {
            backdateValue: parseInt(editBackdateValue) || 4,
            backdateUnit: editBackdateUnit,
            backdatingDays: editBackdatingPermission === 'restrict' ? parseInt(editBackdatingDays) : null
          } : {}),
        }),
      })
      if (res.ok) {
        setEditingId(null)
        setSuccess('Employee updated')
        loadEmployees()
      }
    } catch {}
    finally { setSaving(false) }
  }

  function handleResetPassword(emp: Employee) {
    setActionMenu(null)
    setResetConfirmTarget(emp)
  }

  async function confirmResetPassword() {
    if (!resetConfirmTarget) return
    try {
      const res = await fetch(`/api/owner/employees/${resetConfirmTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password' }),
      })
      if (res.ok) {
        setShareTarget({
          fullName: resetConfirmTarget.fullName,
          username: resetConfirmTarget.username,
          phone: resetConfirmTarget.phone,
          email: resetConfirmTarget.email,
        })
      }
    } catch {}
    setResetConfirmTarget(null)
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

  async function handleUnassignCollection(emp: Employee, businessId: string, businessName: string) {
    setActionMenu(null)
    try {
      const res = await fetch(`/api/b/${businessId}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unassign', userId: emp.id }),
      })
      if (res.ok) {
        setSuccess(`${emp.fullName} unassigned from ${businessName}`)
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadEmployees(); setSuccess(''); setError('') }}
            title="Refresh"
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M2.985 19.644" />
            </svg>
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm">
            + {t('common.new_employee')}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          className="input pl-9 pr-8"
          placeholder="Search by name, username, phone, role, business..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setPage(1) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
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
            {role === 'AGENT' && (
              <>
                <div>
                  <label className="label">Edit Window</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      className="input"
                      value={backdateValue}
                      onChange={(e) => setBackdateValue(e.target.value)}
                      min={1}
                      placeholder="Value"
                    />
                    <select className="input" value={backdateUnit} onChange={(e) => setBackdateUnit(e.target.value)}>
                      <option value="HOURS">Hours</option>
                      <option value="DAYS">Days</option>
                      <option value="MONTHS">Months</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Agent can edit records created within this window (from creation time)</p>
                </div>
                <div>
                  <label className="label">Backdating Permission</label>
                  <select className="input" value={backdatingPermission} onChange={(e) => setBackdatingPermission(e.target.value as 'unlimited' | 'restrict')}>
                    <option value="unlimited">Unlimited</option>
                    <option value="restrict">Restrict backdating</option>
                  </select>
                  {backdatingPermission === 'unlimited' ? (
                    <p className="text-[10px] text-gray-400 mt-1">Agent can select any past date when recording payments.</p>
                  ) : (
                    <div className="mt-2">
                      <label className="label text-xs">Number of days agent can backdate</label>
                      <input type="number" className="input" min={0} max={365} placeholder="e.g. 5" value={backdatingDays} onChange={(e) => setBackdatingDays(e.target.value)} />
                      <p className="text-[10px] text-gray-400 mt-1">Enter 0 to allow today only. Enter 5 to allow up to 5 days back.</p>
                    </div>
                  )}
                </div>
              </>
            )}
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
      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm">{search ? 'No employees match your search' : t('common.no_employees_yet')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paged.map((emp) => (
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
                  {editRole === 'AGENT' && (
                    <>
                      <div>
                        <label className="label text-xs">Edit Window</label>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="number"
                            className="input"
                            value={editBackdateValue}
                            onChange={(e) => setEditBackdateValue(e.target.value)}
                            min={1}
                          />
                          <select className="input" value={editBackdateUnit} onChange={(e) => setEditBackdateUnit(e.target.value)}>
                            <option value="HOURS">Hours</option>
                            <option value="DAYS">Days</option>
                            <option value="MONTHS">Months</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="label text-xs">Backdating Permission</label>
                        <select className="input" value={editBackdatingPermission} onChange={(e) => setEditBackdatingPermission(e.target.value as 'unlimited' | 'restrict')}>
                          <option value="unlimited">Unlimited</option>
                          <option value="restrict">Restrict backdating</option>
                        </select>
                        {editBackdatingPermission === 'unlimited' ? (
                          <p className="text-[10px] text-gray-400 mt-1">Agent can select any past date when recording payments.</p>
                        ) : (
                          <div className="mt-2">
                            <label className="label text-xs">Number of days agent can backdate</label>
                            <input type="number" className="input" min={0} max={365} placeholder="e.g. 5" value={editBackdatingDays} onChange={(e) => setEditBackdatingDays(e.target.value)} />
                            <p className="text-[10px] text-gray-400 mt-1">Enter 0 to allow today only. Enter 5 to allow up to 5 days back.</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
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
                      {emp.role === 'AGENT' && (
                        <>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700" title="Edit window">
                            {emp.backdateValue ?? 4}{(emp.backdateUnit ?? 'HOURS').charAt(0)}
                          </span>
                          {emp.backdatingDays === null ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700" title="Payment backdating">Unlimited</span>
                          ) : emp.backdatingDays === 0 ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700" title="Payment backdating">Today Only</span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700" title="Payment backdating">{emp.backdatingDays}d back</span>
                          )}
                        </>
                      )}
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
                        {businesses.length <= 1 ? (
                          <button
                            onClick={async () => {
                              setActionMenu(null)
                              if (!businesses[0]) return
                              await fetch(`/api/b/${businesses[0].id}/employees`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'assign', userId: emp.id }),
                              })
                              router.push(`/b/${businesses[0].id}/employees`)
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            {t('common.assign_collection')}
                          </button>
                        ) : (
                          <div className="px-4 py-1">
                            <p className="text-[10px] text-gray-400 uppercase font-medium mb-1">{t('common.assign_collection')}</p>
                            {businesses.map(b => (
                              <button
                                key={b.id}
                                onClick={async () => {
                                  setActionMenu(null)
                                  await fetch(`/api/b/${b.id}/employees`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'assign', userId: emp.id }),
                                  })
                                  router.push(`/b/${b.id}/employees`)
                                }}
                                className="w-full text-left px-2 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded"
                              >
                                {b.name}
                              </button>
                            ))}
                          </div>
                        )}
                        {emp.businesses.length > 0 && (
                          <div className="px-4 py-1 border-t border-gray-100">
                            <p className="text-[10px] text-gray-400 uppercase font-medium mb-1">Unassign from</p>
                            {emp.businesses.map(bizName => {
                              const bizId = Object.entries(businessMap).find(([_id, name]) => name === bizName)?.[0]
                              return bizId ? (
                                <button
                                  key={bizId}
                                  onClick={() => handleUnassignCollection(emp, bizId, bizName)}
                                  className="w-full text-left px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                                >
                                  {bizName}
                                </button>
                              ) : null
                            })}
                          </div>
                        )}
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

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 px-1 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {showAll ? `All ${filtered.length}` : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length}`}
              </span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600"
              >
                {PAGE_SIZES.map(s => (
                  <option key={s} value={s}>{s === 0 ? 'All' : s}</option>
                ))}
              </select>
            </div>
            {totalPages > 1 && <div className="flex gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-xs text-gray-400">...</span>}
                    <button
                      onClick={() => setPage(p)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        p === page ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>}
          </div>
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {resetConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setResetConfirmTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5">
              <h3 className="text-base font-semibold text-gray-900 mb-2">{t('common.reset_password')}</h3>
              <p className="text-sm text-gray-500">
                Reset <strong>{resetConfirmTarget.fullName}</strong>&apos;s password to their username: <span className="font-mono font-medium text-gray-700">{resetConfirmTarget.username}</span>
              </p>
              <p className="text-xs text-gray-400 mt-2">They will be required to change it on first login.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setResetConfirmTarget(null)} className="btn-secondary px-4 py-2">{t('common.cancel')}</button>
              <button onClick={confirmResetPassword} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">{t('common.reset_password')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareTarget && (
        <PasswordResetShareModal
          variant={shareTarget.variant || 'password-reset'}
          fullName={shareTarget.fullName}
          username={shareTarget.username}
          phone={shareTarget.phone}
          email={shareTarget.email}
          password={shareTarget.password}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  )
}
