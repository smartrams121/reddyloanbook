'use client'

import { useState, useEffect } from 'react'

interface BusinessInfo {
  id: string
  name: string
  city: string
  isActive: boolean
}

interface UserProfile {
  id: string
  username: string
  fullName: string
  role: string
  phone: string | null
  businesses: BusinessInfo[]
}

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: 'Platform Admin',
  OWNER: 'Owner',
  BUSINESS_ADMIN: 'Business Admin',
  AGENT: 'Agent',
}

export default function ProfilePage() {
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

  const [editingBiz, setEditingBiz] = useState<string | null>(null)
  const [bizName, setBizName] = useState('')
  const [bizCity, setBizCity] = useState('')
  const [bizPhone, setBizPhone] = useState('')
  const [bizMsg, setBizMsg] = useState({ type: '', text: '' })
  const [bizSaving, setBizSaving] = useState(false)

  const [archiveConfirm, setArchiveConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const res = await fetch('/api/auth/profile')
    const data = await res.json()
    setProfile(data)
    setEditName(data.fullName || '')
    setEditPhone(data.phone || '')
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

  function startEditBiz(biz: BusinessInfo) {
    setEditingBiz(biz.id)
    setBizName(biz.name)
    setBizCity(biz.city)
    setBizPhone('')
    setBizMsg({ type: '', text: '' })
  }

  async function handleUpdateBusiness(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBiz) return
    setBizMsg({ type: '', text: '' })
    setBizSaving(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateBusiness',
          businessId: editingBiz,
          name: bizName,
          city: bizCity,
          phone: bizPhone || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setBizMsg({ type: 'error', text: data.error || 'Failed to update' })
      } else {
        setBizMsg({ type: 'success', text: 'Business updated' })
        setEditingBiz(null)
        await loadProfile()
      }
    } catch {
      setBizMsg({ type: 'error', text: 'Network error' })
    } finally {
      setBizSaving(false)
    }
  }

  async function handleArchiveBusiness(businessId: string) {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archiveBusiness', businessId }),
      })
      if (res.ok) {
        setArchiveConfirm(null)
        await loadProfile()
      }
    } catch { /* ignore */ }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  const isOwner = profile.role === 'OWNER'

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">My Profile</h1>

      {/* Profile Info Card */}
      <div className="card p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold shrink-0">
            {profile.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{profile.fullName}</h2>
            <p className="text-sm text-gray-500">@{profile.username}</p>
            <span className="inline-block mt-1 text-xs font-medium bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
              {ROLE_LABELS[profile.role] || profile.role}
            </span>
          </div>
        </div>

        {!editingProfile ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                <p className="text-sm text-gray-900">{profile.phone || 'Not set'}</p>
              </div>
              <button
                onClick={() => setEditingProfile(true)}
                className="text-sm text-primary-600 font-medium"
              >
                Edit
              </button>
            </div>
            {profileMsg.text && (
              <div className={`text-sm px-3 py-2 rounded-lg ${profileMsg.type === 'error' ? 'bg-danger-50 text-danger-700' : 'bg-green-50 text-green-700'}`}>
                {profileMsg.text}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleUpdateProfile} className="space-y-3">
            {profileMsg.text && (
              <div className={`text-sm px-3 py-2 rounded-lg ${profileMsg.type === 'error' ? 'bg-danger-50 text-danger-700' : 'bg-green-50 text-green-700'}`}>
                {profileMsg.text}
              </div>
            )}
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="e.g. 9876543210" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={profileSaving} className="btn-primary flex-1">
                {profileSaving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => { setEditingProfile(false); setEditName(profile.fullName); setEditPhone(profile.phone || '') }} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Change Password */}
      <div className="card p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          {pwMsg.text && (
            <div className={`text-sm px-3 py-2 rounded-lg ${pwMsg.type === 'error' ? 'bg-danger-50 text-danger-700' : 'bg-green-50 text-green-700'}`}>
              {pwMsg.text}
            </div>
          )}
          <div>
            <label className="label">Current Password</label>
            <input type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 4 characters" required />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={pwLoading} className="btn-primary w-full">
            {pwLoading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* My Businesses (Owners only) */}
      {isOwner && (
        <div className="card p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">My Businesses</h2>
          <div className="space-y-3">
            {profile.businesses.filter(b => b.isActive).map((biz) => (
              <div key={biz.id} className="border border-gray-200 rounded-lg p-3">
                {editingBiz === biz.id ? (
                  <form onSubmit={handleUpdateBusiness} className="space-y-3">
                    {bizMsg.text && (
                      <div className={`text-sm px-3 py-2 rounded-lg ${bizMsg.type === 'error' ? 'bg-danger-50 text-danger-700' : 'bg-green-50 text-green-700'}`}>
                        {bizMsg.text}
                      </div>
                    )}
                    <div>
                      <label className="label">Business Name</label>
                      <input className="input" value={bizName} onChange={(e) => setBizName(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">City</label>
                      <input className="input" value={bizCity} onChange={(e) => setBizCity(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">Phone</label>
                      <input className="input" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} placeholder="Optional" />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={bizSaving} className="btn-primary flex-1 text-sm">
                        {bizSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEditingBiz(null)} className="btn-secondary flex-1 text-sm">
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{biz.name}</p>
                      <p className="text-xs text-gray-500">{biz.city}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEditBiz(biz)} className="text-xs text-primary-600 font-medium px-2 py-1 hover:bg-primary-50 rounded">
                        Edit
                      </button>
                      {archiveConfirm === biz.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleArchiveBusiness(biz.id)} className="text-xs text-white bg-danger-600 px-2 py-1 rounded font-medium">
                            Confirm
                          </button>
                          <button onClick={() => setArchiveConfirm(null)} className="text-xs text-gray-500 px-2 py-1">
                            No
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setArchiveConfirm(biz.id)} className="text-xs text-danger-600 font-medium px-2 py-1 hover:bg-danger-50 rounded">
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {profile.businesses.filter(b => b.isActive).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-2">No active businesses</p>
            )}

            {profile.businesses.filter(b => !b.isActive).length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Archived</p>
                {profile.businesses.filter(b => !b.isActive).map((biz) => (
                  <div key={biz.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-sm text-gray-400">{biz.name}</p>
                      <p className="text-xs text-gray-300">{biz.city}</p>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Archived</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
