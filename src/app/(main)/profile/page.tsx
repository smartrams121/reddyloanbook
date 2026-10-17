'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation, Locale } from '@/lib/i18n'

interface BusinessInfo {
  id: string
  name: string
  isActive: boolean
}

interface UserProfile {
  id: string
  username: string
  fullName: string
  role: string
  phone: string | null
  photoPath: string | null
  businesses: BusinessInfo[]
}

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: 'Platform Admin',
  OWNER: 'Owner',
  BUSINESS_ADMIN: 'Partner',
  AGENT: 'Agent',
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })
  const [profileSaving, setProfileSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)

  // Photo
  const [photoPreview, setPhotoPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showPhoto, setShowPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const res = await fetch('/api/auth/profile')
    const data = await res.json()
    setProfile(data)
    setEditName(data.fullName || '')
    setEditPhone(data.phone || '')
    if (data.photoPath) setPhotoPreview(data.photoPath)
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileMsg({ type: '', text: '' })
    setProfileSaving(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateProfile', fullName: editName, phone: editPhone }),
      })
      if (!res.ok) {
        const data = await res.json()
        setProfileMsg({ type: 'error', text: data.error || 'Failed to update' })
      } else {
        setProfileMsg({ type: 'success', text: 'Profile updated' })
        setEditingProfile(false)
        await loadProfile()
      }
    } catch {
      setProfileMsg({ type: 'error', text: 'Network error' })
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/auth/profile/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.photoPath) {
        setPhotoPreview(data.photoPath)
        if (profile) setProfile({ ...profile, photoPath: data.photoPath })
      }
    } catch {}
    finally { setUploading(false) }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleRemovePhoto() {
    setUploading(true)
    try {
      await fetch('/api/auth/profile/upload', { method: 'DELETE' })
      setPhotoPreview('')
      if (profile) setProfile({ ...profile, photoPath: null })
    } catch {}
    finally { setUploading(false) }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg({ type: '', text: '' })
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'New passwords do not match' })
      return
    }
    setPwLoading(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changePassword', currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPwMsg({ type: 'error', text: data.error || 'Failed to change password' })
      } else {
        setPwMsg({ type: 'success', text: 'Password changed successfully' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      setPwMsg({ type: 'error', text: 'Network error' })
    } finally {
      setPwLoading(false)
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  const isOwner = profile.role === 'OWNER'
  const photoSrc = photoPreview || profile.photoPath

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{t('profile.my_profile')}</h1>

      {/* 1. Profile Card with Photo */}
      <div className="card p-4">
        <div className="flex items-start gap-4 mb-4">
          {/* Photo Avatar */}
          <div className="relative shrink-0">
            <div
              className={`w-20 h-20 rounded-full overflow-hidden bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold ${photoSrc ? 'cursor-pointer' : ''}`}
              onClick={() => photoSrc && setShowPhoto(true)}
            >
              {photoSrc ? (
                <img src={photoSrc} alt="" className="w-full h-full object-cover" />
              ) : (
                profile.fullName.charAt(0).toUpperCase()
              )}
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {editingProfile ? (
              <form onSubmit={handleUpdateProfile} className="space-y-2">
                <input className="input text-sm py-1.5" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full Name" required />
                <input className="input text-sm py-1.5" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone" />
                <div className="flex gap-2">
                  <button type="submit" disabled={profileSaving} className="btn-primary text-xs px-3 py-1.5">{profileSaving ? '...' : t('common.save')}</button>
                  <button type="button" onClick={() => { setEditingProfile(false); setEditName(profile.fullName); setEditPhone(profile.phone || '') }} className="btn-secondary text-xs px-3 py-1.5">{t('common.cancel')}</button>
                </div>
                {profileMsg.text && <p className={`text-xs ${profileMsg.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{profileMsg.text}</p>}
              </form>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{profile.fullName}</h2>
                  <button onClick={() => setEditingProfile(true)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                  </button>
                </div>
                <p className="text-sm text-gray-500">@{profile.username}</p>
                {profile.phone && <p className="text-xs text-gray-400 mt-0.5">{profile.phone}</p>}
                <span className="inline-block mt-1 text-xs font-medium bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                  {ROLE_LABELS[profile.role] || profile.role}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Photo Buttons */}
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
          <button
            type="button"
            onClick={() => { if (fileInputRef.current) { fileInputRef.current.removeAttribute('capture'); fileInputRef.current.click() } }}
            disabled={uploading}
            className="flex-1 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Gallery
          </button>
          <button
            type="button"
            onClick={() => { if (fileInputRef.current) { fileInputRef.current.setAttribute('capture', 'environment'); fileInputRef.current.click() } }}
            disabled={uploading}
            className="flex-1 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Camera
          </button>
          {photoSrc && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              disabled={uploading}
              className="flex-1 text-xs font-medium px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* 2. Organization Details (Owner/BA only) */}
      {(isOwner || profile.role === 'BUSINESS_ADMIN') && (
        <OrganizationSection />
      )}

      {/* 3. Language */}
      <LanguageSection />

      {/* 4. Change Password (collapsed) */}
      <div className="card">
        <button type="button" onClick={() => setPwOpen(!pwOpen)} className="w-full p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('auth.change_password')}</h2>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${pwOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {pwOpen && <form onSubmit={handleChangePassword} className="px-4 pb-4 space-y-3">
          {pwMsg.text && (
            <div className={`text-sm px-3 py-2 rounded-lg ${pwMsg.type === 'error' ? 'bg-danger-50 text-danger-700' : 'bg-green-50 text-green-700'}`}>
              {pwMsg.text}
            </div>
          )}
          <div>
            <label className="label">{t('auth.current_password')}</label>
            <input type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">{t('auth.new_password')}</label>
            <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 4 characters" required />
          </div>
          <div>
            <label className="label">{t('auth.confirm_new_password')}</label>
            <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={pwLoading} className="btn-primary w-full">
            {pwLoading ? t('auth.changing') : t('auth.change_password')}
          </button>
        </form>}
      </div>

      {/* 5. Danger Zone (Owner only, collapsed) */}
      {isOwner && (
        <DeleteOrganizationSection businessCount={profile.businesses?.filter(b => b.isActive).length || 0} />
      )}

      {/* Fullscreen Photo Viewer */}
      {showPhoto && photoSrc && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setShowPhoto(false)}>
          <button className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-gray-300" onClick={() => setShowPhoto(false)}>×</button>
          <img src={photoSrc} alt={profile.fullName} className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  )
}

function OrganizationSection() {
  const { t } = useTranslation()
  const [orgId, setOrgId] = useState('')
  const [data, setData] = useState({ organizationName: '', fullName: '', phone: '', email: '', city: '' })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ organizationName: '', fullName: '', phone: '', email: '', city: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    fetch('/api/auth/profile')
      .then(r => r.json())
      .then(d => {
        if (d.id) setOrgId(d.id)
        const vals = {
          organizationName: d.organizationName || '',
          fullName: d.fullName || '',
          phone: d.phone || '',
          email: d.email || '',
          city: d.city || '',
        }
        setData(vals)
      })
      .catch(() => {})
  }, [])

  function startEdit() {
    setForm({ ...data })
    setEditing(true)
    setMsg({ type: '', text: '' })
  }

  async function handleSave() {
    if (!form.organizationName.trim() || !form.fullName.trim() || !form.phone.trim() || !form.email.trim() || !form.city.trim()) {
      setMsg({ type: 'error', text: 'All fields are required' })
      return
    }
    setSaving(true)
    setMsg({ type: '', text: '' })
    try {
      const res = await fetch('/api/profile/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setData({ ...form })
        setEditing(false)
        setMsg({ type: 'success', text: 'Updated — refresh to see in header' })
      } else {
        const d = await res.json()
        setMsg({ type: 'error', text: d.error || 'Failed' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { key: 'organizationName', label: 'Organization Name' },
    { key: 'fullName', label: 'Owner Name' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'email', label: 'Email' },
    { key: 'city', label: 'City' },
  ] as const

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Organization Details</h2>
        {!editing && (
          <button onClick={startEdit} className="text-xs text-primary-600 font-medium hover:text-primary-700">
            {t('common.edit')}
          </button>
        )}
      </div>
      {msg.text && (
        <div className={`text-sm px-3 py-2 rounded-lg mb-3 ${msg.type === 'error' ? 'bg-danger-50 text-danger-700' : 'bg-green-50 text-green-700'}`}>
          {msg.text}
        </div>
      )}
      <div className="flex justify-between py-1.5 border-b border-gray-100 mb-2">
        <span className="text-xs text-gray-500">OrgID</span>
        <span className="text-[10px] font-mono text-gray-400">{orgId}</span>
      </div>
      {editing ? (
        <div className="space-y-3">
          {fields.map(f => (
            <div key={f.key}>
              <label className="label">{f.label} *</label>
              <input
                className="input"
                value={form[f.key]}
                onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                required
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? '...' : t('common.save')}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary flex-1">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map(f => (
            <div key={f.key} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500">{f.label}</span>
              <span className="text-sm font-medium text-gray-900">{data[f.key] || 'Not set'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DeleteOrganizationSection({ businessCount }: { businessCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const hasCollections = businessCount > 0

  async function handleDelete() {
    if (confirmText !== 'DELETE ORGANIZATION') return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch('/api/profile/organization', { method: 'DELETE' })
      if (res.ok) {
        const logoutRes = await fetch('/api/auth/logout', { method: 'POST' })
        if (logoutRes.ok) router.push('/login')
        else window.location.href = '/login'
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete organization')
      }
    } catch {
      setError('Network error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="card border-red-200">
      <button type="button" onClick={() => setOpen(!open)} className="w-full p-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide">Danger Zone</h2>
        <svg className={`w-4 h-4 text-red-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {error && (
            <div className="bg-danger-50 text-danger-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}
          {hasCollections ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800 font-medium">Cannot delete organization</p>
              <p className="text-xs text-amber-700 mt-1">
                You have {businessCount} active collection{businessCount !== 1 ? 's' : ''}. Delete all collections from Settings before deleting the organization.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Permanently delete your organization account and all associated data. This will remove your owner account, employees, and all records. This action cannot be undone.
              </p>
              <div>
                <label className="label">Type DELETE ORGANIZATION to confirm</label>
                <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE ORGANIZATION" />
              </div>
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE ORGANIZATION' || deleting}
                className="w-full text-sm font-medium px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Organization'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function LanguageSection() {
  const { locale, setLocale, t } = useTranslation()
  const [toast, setToast] = useState('')

  function handleChange(newLocale: Locale) {
    setLocale(newLocale)
    setToast(newLocale === 'te' ? 'భాష మార్చబడింది' : 'Language updated')
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <>
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('profile.language')}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleChange('en')}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              locale === 'en' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {locale === 'en' && '✓ '}English
          </button>
          <button
            onClick={() => handleChange('te')}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              locale === 'te' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {locale === 'te' && '✓ '}తెలుగు
          </button>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </>
  )
}
