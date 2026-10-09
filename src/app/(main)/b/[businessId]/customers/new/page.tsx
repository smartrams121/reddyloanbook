'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'

interface Village {
  id: string
  name: string
}

const DEFAULT_JOB_TYPES = ['Shop', 'Business', 'Farmer', 'Labour', 'Driver', 'Others']

export default function NewCustomerPage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const businessId = params.businessId as string

  const [villages, setVillages] = useState<Village[]>([])
  const [customerId, setCustomerId] = useState('')
  const [customerIdStatus, setCustomerIdStatus] = useState<'loading' | 'available' | 'taken' | ''>('')
  const [customerIdSuggestion, setCustomerIdSuggestion] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [altPhone, setAltPhone] = useState('')
  const [age, setAge] = useState('')
  const [villageId, setVillageId] = useState('')
  const [address, setAddress] = useState('')
  const [aadhaar, setAadhaar] = useState('')
  const [jobType, setJobType] = useState('')
  const [customJobType, setCustomJobType] = useState('')
  const [jobTypes, setJobTypes] = useState<string[]>(DEFAULT_JOB_TYPES)
  const [guarantorName, setGuarantorName] = useState('')
  const [guarantorPhone, setGuarantorPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locating, setLocating] = useState(false)
  const [photoPath, setPhotoPath] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const [showNewVillage, setShowNewVillage] = useState(false)
  const [newVillageName, setNewVillageName] = useState('')
  const [creatingVillage, setCreatingVillage] = useState(false)
  const [villageError, setVillageError] = useState('')

  const [showNewJobType, setShowNewJobType] = useState(false)
  const [additionalOpen, setAdditionalOpen] = useState(false)

  const [familyRelation, setFamilyRelation] = useState('')
  const [familyMemberName, setFamilyMemberName] = useState('')
  const [customRelation, setCustomRelation] = useState('')
  const [showNewRelation, setShowNewRelation] = useState(false)

  const DEFAULT_RELATIONS = ['Husband', 'Wife', 'Son', 'Daughter', 'Brother', 'Sister', 'Mother', 'Father', 'Father-in-law', 'Mother-in-law', 'Son-in-law', 'Daughter-in-law']
  const [relations, setRelations] = useState<string[]>(DEFAULT_RELATIONS)

  async function checkCustomerId(id: string) {
    if (!id.trim()) return
    setCustomerIdStatus('loading')
    try {
      const res = await fetch(`/api/b/${businessId}/customers/check-id?id=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (data.available) {
        setCustomerIdStatus('available')
        setCustomerIdSuggestion('')
      } else {
        setCustomerIdStatus('taken')
        setCustomerIdSuggestion(data.nextAvailable || '')
      }
    } catch {
      setCustomerIdStatus('')
    }
  }

  useEffect(() => {
    fetch(`/api/b/${businessId}/villages`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const sorted = data.sort((a: Village, b: Village) => a.name.localeCompare(b.name))
          setVillages(sorted)
          if (sorted.length === 1) {
            setVillageId(sorted[0].id)
          } else if (sorted.length > 1) {
            try { const last = localStorage.getItem(`lastVillage_${businessId}`); if (last && sorted.some((v: Village) => v.id === last)) setVillageId(last) } catch {}
          }
        }
      })
      .catch(() => {})

    fetch(`/api/b/${businessId}/customers/next-id`)
      .then(r => r.json())
      .then(data => { if (data.nextId) setCustomerId(data.nextId) })
      .catch(() => {})

    fetch(`/api/b/${businessId}/customers`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const existing = new Set(DEFAULT_JOB_TYPES)
          data.forEach((c: { jobType?: string }) => {
            if (c.jobType && !existing.has(c.jobType)) {
              existing.add(c.jobType)
            }
          })
          setJobTypes(Array.from(existing))
        }
      })
      .catch(() => {})
  }, [businessId])

  function resetForm() {
    setFullName('')
    setPhone('')
    setAltPhone('')
    setAge('')
    setAddress('')
    setAadhaar('')
    setJobType('')
    setCustomJobType('')
    setGuarantorName('')
    setGuarantorPhone('')
    setNotes('')
    setPhotoPath('')
    setPhotoPreview('')
    setFamilyRelation('')
    setFamilyMemberName('')
    setCustomRelation('')
    setShowNewRelation(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoPreview(URL.createObjectURL(file))
    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/b/${businessId}/upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Photo upload failed')
        setPhotoPreview('')
        return
      }
      setPhotoPath(data.photoPath)
    } catch {
      setError('Photo upload failed')
      setPhotoPreview('')
    } finally {
      setUploading(false)
    }
  }

  async function createVillage() {
    if (!newVillageName.trim()) return
    setVillageError('')
    setCreatingVillage(true)

    try {
      const res = await fetch(`/api/b/${businessId}/villages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newVillageName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setVillageError(data.error || 'Failed to create location')
        return
      }
      setVillages(prev => [...prev, { id: data.id, name: data.name }])
      setVillageId(data.id)
      setNewVillageName('')
      setShowNewVillage(false)
    } catch {
      setVillageError('Network error')
    } finally {
      setCreatingVillage(false)
    }
  }

  function handleJobTypeChange(value: string) {
    if (value === '__new__') {
      setShowNewJobType(true)
      setJobType('')
    } else {
      setShowNewJobType(false)
      setCustomJobType('')
      setJobType(value)
    }
  }

  function addCustomJobType() {
    const name = customJobType.trim()
    if (!name) return
    if (!jobTypes.includes(name)) {
      setJobTypes(prev => [...prev, name])
    }
    setJobType(name)
    setCustomJobType('')
    setShowNewJobType(false)
  }

  async function handleSubmit(action: 'back' | 'continue' | 'loan') {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const body: Record<string, unknown> = {
        fullName,
        phone,
        villageId,
        customerId: customerId || undefined,
      }
      if (altPhone) body.altPhone = altPhone
      if (age) body.age = parseInt(age, 10)
      if (address) body.address = address
      if (aadhaar) body.aadhaar = aadhaar
      if (jobType) body.jobType = jobType
      if (guarantorName) body.guarantorName = guarantorName
      if (guarantorPhone) body.guarantorPhone = guarantorPhone
      if (familyRelation) body.familyRelation = familyRelation
      if (familyMemberName) body.familyMemberName = familyMemberName
      if (notes) body.notes = notes
      if (latitude) body.latitude = latitude
      if (longitude) body.longitude = longitude
      if (photoPath) body.photoPath = photoPath

      const res = await fetch(`/api/b/${businessId}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.details) {
          const msgs = Object.values(data.details).flat().join(', ')
          setError(msgs)
        } else {
          setError(data.error || 'Failed to create customer')
        }
        return
      }

      try { localStorage.setItem(`lastVillage_${businessId}`, villageId) } catch {}

      if (action === 'continue') {
        setSuccess(`${fullName} created (${data.customerId}). Add next customer.`)
        resetForm()
      } else if (action === 'loan') {
        router.push(`/b/${businessId}/loans/new?customerId=${data.id}`)
      } else {
        router.push(`/b/${businessId}/customers`)
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">{t('customers.new_customer')}</h1>
      <p className="text-sm text-gray-500 mb-6">Register a new customer</p>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit('back') }} className="space-y-4">
        {success && (
          <div className="bg-success-50 text-success-700 text-sm px-4 py-3 rounded-lg">{success}</div>
        )}
        {error && (
          <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        <div>
          <label className="label">{t('customers.customer_id')} *</label>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <input
                className="input"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                onBlur={() => checkCustomerId(customerId)}
                required
              />
              {customerIdStatus === 'available' && <p className="text-[10px] text-green-600 mt-1">✓ Available</p>}
              {customerIdStatus === 'taken' && (
                <p className="text-[10px] text-red-600 mt-1">
                  ID already assigned.{customerIdSuggestion && (
                    <> Next available: <button type="button" onClick={() => { setCustomerId(customerIdSuggestion); setCustomerIdStatus('available') }} className="text-primary-600 underline">{customerIdSuggestion}</button></>
                  )}
                </p>
              )}
              {customerIdStatus === 'loading' && <p className="text-[10px] text-gray-400 mt-1">Checking...</p>}
            </div>
          </div>
        </div>

        <div>
          <label className="label">{t('customers.full_name')} *</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>

        <div>
          <label className="label">{t('customers.phone')}</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
        </div>

        {/* Village with inline creation */}
        <div>
          <label className="label">{t('customers.location')} *</label>
          {!showNewVillage ? (
            <div className="flex gap-2">
              <select className="input flex-1" value={villageId} onChange={(e) => setVillageId(e.target.value)} required>
                <option value="">Select location</option>
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewVillage(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors whitespace-nowrap"
              >
                + New
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={newVillageName}
                  onChange={(e) => setNewVillageName(e.target.value)}
                  placeholder="Enter new location name"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createVillage() } }}
                />
                <button
                  type="button"
                  onClick={createVillage}
                  disabled={creatingVillage || !newVillageName.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {creatingVillage ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewVillage(false); setNewVillageName(''); setVillageError('') }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
              {villageError && (
                <p className="text-xs text-danger-600">{villageError}</p>
              )}
            </div>
          )}
        </div>

        {/* Family Reference — single row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            {!showNewRelation ? (
              <select className="input text-sm" value={familyRelation} onChange={(e) => {
                if (e.target.value === '__new__') { setShowNewRelation(true); setFamilyRelation('') }
                else { setFamilyRelation(e.target.value); setShowNewRelation(false) }
              }}>
                <option value="">{t('customers.select_family')}</option>
                {relations.map(r => <option key={r} value={r}>{r}</option>)}
                <option value="__new__">{t('customers.add_new')}</option>
              </select>
            ) : (
              <div className="flex gap-1">
                <input className="input flex-1 text-sm" value={customRelation} onChange={(e) => setCustomRelation(e.target.value)} placeholder={t('customers.relationship')} />
                <button type="button" onClick={() => {
                  const name = customRelation.trim()
                  if (name) { if (!relations.includes(name)) setRelations(prev => [...prev, name]); setFamilyRelation(name); setCustomRelation(''); setShowNewRelation(false) }
                }} className="text-xs px-2 py-1 rounded bg-primary-50 text-primary-700">Add</button>
                <button type="button" onClick={() => { setShowNewRelation(false); setCustomRelation('') }} className="text-xs px-2 py-1 text-gray-400">×</button>
              </div>
            )}
          </div>
          <input className="input text-sm" value={familyMemberName} onChange={(e) => setFamilyMemberName(e.target.value)} placeholder={t('customers.family_name')} />
        </div>

        {/* Additional Details — collapsed by default */}
        <div className="card">
          <button type="button" onClick={() => setAdditionalOpen(!additionalOpen)} className="w-full p-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('customers.additional_details')}</h2>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${additionalOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {additionalOpen && <div className="px-4 pb-4 space-y-4">

          {/* Photo */}
          <div>
            <label className="label">{t('customers.photo')}</label>
            <div className="flex flex-col items-center gap-3">
              <div className="w-28 h-28 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                )}
              </div>
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                <button type="button" disabled={uploading} onClick={() => { if (fileInputRef.current) { fileInputRef.current.removeAttribute('capture'); fileInputRef.current.click() } }} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                  {uploading ? 'Uploading...' : 'Gallery'}
                </button>
                <button type="button" disabled={uploading} onClick={() => { if (fileInputRef.current) { fileInputRef.current.setAttribute('capture', 'environment'); fileInputRef.current.click() } }} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                  Camera
                </button>
                {photoPreview && (
                  <button type="button" onClick={() => { setPhotoPath(''); setPhotoPreview(''); if (fileInputRef.current) fileInputRef.current.value = '' }} className="text-xs px-3 py-1.5 rounded-lg bg-danger-50 text-danger-600 hover:bg-danger-100 transition-colors">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('customers.age')}</label>
              <input type="number" className="input" value={age} onChange={(e) => setAge(e.target.value)} min={18} max={100} />
            </div>
            <div>
              <label className="label">{t('customers.alt_phone')}</label>
              <input className="input" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">{t('customers.job_type')}</label>
            {!showNewJobType ? (
              <select className="input" value={jobType} onChange={(e) => handleJobTypeChange(e.target.value)}>
                <option value="">Select job type</option>
                {jobTypes.map((jt) => (
                  <option key={jt} value={jt}>{jt}</option>
                ))}
                <option value="__new__">{t('customers.add_new_job')}</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input className="input flex-1" value={customJobType} onChange={(e) => setCustomJobType(e.target.value)} placeholder="Enter new job type" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomJobType() } }} />
                <button type="button" onClick={addCustomJobType} disabled={!customJobType.trim()} className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 whitespace-nowrap">Add</button>
                <button type="button" onClick={() => { setShowNewJobType(false); setCustomJobType('') }} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
              </div>
            )}
          </div>

          <div>
            <label className="label">{t('customers.address')}</label>
            <textarea className="input" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div>
            <label className="label">{t('customers.aadhaar')}</label>
            <input className="input" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} placeholder="12 digits (stored securely)" maxLength={12} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('customers.guarantor')}</label>
              <input className="input" value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} />
            </div>
            <div>
              <label className="label">{t('customers.guarantor_phone')}</label>
              <input className="input" value={guarantorPhone} onChange={(e) => setGuarantorPhone(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">{t('customers.notes')}</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div>
            <label className="label">{t('customers.customer_location')}</label>
            {latitude && longitude ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-600 font-medium">{t('customers.location_captured')}</span>
                <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">{t('common.maps')}</a>
                <button type="button" onClick={() => { setLatitude(null); setLongitude(null) }} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
              </div>
            ) : (
              <button
                type="button"
                disabled={locating}
                onClick={() => {
                  setLocating(true)
                  navigator.geolocation.getCurrentPosition(
                    (pos) => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); setLocating(false) },
                    () => { alert('Location access denied. Please enable GPS.'); setLocating(false) },
                    { enableHighAccuracy: true, timeout: 10000 }
                  )
                }}
                className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {locating ? t('customers.getting_location') : t('customers.capture_location')}
              </button>
            )}
          </div>

          </div>}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button type="button" disabled={loading} onClick={() => handleSubmit('continue')} className="btn-secondary flex-1">
              {loading ? 'Creating...' : 'Create & Next'}
            </button>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit('loan')}
            className="w-full text-sm font-medium px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create & New Loan'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary w-full">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
