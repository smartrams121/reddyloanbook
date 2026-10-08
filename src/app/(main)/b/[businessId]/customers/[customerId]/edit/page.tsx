'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

interface Village { id: string; name: string }

export default function EditCustomerPage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const businessId = params.businessId as string
  const customerId = params.customerId as string

  const [villages, setVillages] = useState<Village[]>([])
  const [custId, setCustId] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [altPhone, setAltPhone] = useState('')
  const [age, setAge] = useState('')
  const [villageId, setVillageId] = useState('')
  const [address, setAddress] = useState('')
  const [guarantorName, setGuarantorName] = useState('')
  const [guarantorPhone, setGuarantorPhone] = useState('')
  const [jobType, setJobType] = useState('')
  const [aadhaar, setAadhaar] = useState('')
  const [notes, setNotes] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locating, setLocating] = useState(false)
  const [photoPath, setPhotoPath] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [originalCustId, setOriginalCustId] = useState('')
  const [custIdStatus, setCustIdStatus] = useState<'available' | 'taken' | ''>('')
  const [custIdSuggestion, setCustIdSuggestion] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/b/${businessId}/customers/${customerId}`).then((r) => r.json()),
      fetch(`/api/b/${businessId}/villages`).then((r) => r.json()),
    ])
      .then(([cust, villageData]) => {
        if (Array.isArray(villageData)) setVillages(villageData)
        if (cust && cust.id) {
          setCustId(cust.customerId)
          setOriginalCustId(cust.customerId)
          setFullName(cust.fullName)
          setPhone(cust.phone || '')
          setAltPhone(cust.altPhone || '')
          setAge(cust.age ? String(cust.age) : '')
          setVillageId(cust.village?.id || '')
          setAddress(cust.address || '')
          setGuarantorName(cust.guarantorName || '')
          setGuarantorPhone(cust.guarantorPhone || '')
          setJobType(cust.jobType || '')
          setAadhaar(cust.aadhaarLast4 ? `XXXXXXXX${cust.aadhaarLast4}` : '')
          setNotes(cust.notes || '')
          if (cust.latitude) setLatitude(cust.latitude)
          if (cust.longitude) setLongitude(cust.longitude)
          if (cust.photoPath) {
            setPhotoPath(cust.photoPath)
            setPhotoPreview(cust.photoPath)
          }
        }
      })
      .catch(() => setError('Failed to load customer'))
      .finally(() => setFetching(false))
  }, [businessId, customerId])

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
        setPhotoPreview(photoPath || '')
        return
      }
      setPhotoPath(data.photoPath)
    } catch {
      setError('Photo upload failed')
      setPhotoPreview(photoPath || '')
    } finally {
      setUploading(false)
    }
  }

  async function checkCustId(id: string) {
    if (!id.trim() || id === originalCustId) { setCustIdStatus(''); return }
    try {
      const res = await fetch(`/api/b/${businessId}/customers/check-id?id=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (data.available) { setCustIdStatus('available'); setCustIdSuggestion('') }
      else { setCustIdStatus('taken'); setCustIdSuggestion(data.nextAvailable || '') }
    } catch { setCustIdStatus('') }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const body: Record<string, unknown> = {
        fullName,
        phone,
        ...(custId !== originalCustId && { customerId: custId }),
        altPhone,
        villageId,
        address,
        jobType,
        guarantorName,
        guarantorPhone,
        notes,
        latitude,
        longitude,
        photoPath: photoPath || null,
      }
      if (age) body.age = parseInt(age, 10)
      if (aadhaar && !aadhaar.startsWith('XXXX')) body.aadhaar = aadhaar

      const res = await fetch(`/api/b/${businessId}/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.details) {
          const msgs = Object.values(data.details).flat().join(', ')
          setError(msgs)
        } else {
          setError(data.error || 'Failed to update customer')
        }
        return
      }

      router.push(`/b/${businessId}/customers/${customerId}`)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="card p-8 text-center text-gray-400">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Link href={`/b/${businessId}/customers/${customerId}`} className="text-sm text-primary-600 hover:underline">
        {t('common.back')}
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mt-2 mb-1">{t('customers.edit_customer')}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        {/* Customer ID */}
        <div>
          <label className="label">{t('customers.customer_id')}</label>
          <input
            className="input"
            value={custId}
            onChange={(e) => { setCustId(e.target.value); setCustIdStatus('') }}
            onBlur={() => checkCustId(custId)}
          />
          {custIdStatus === 'available' && <p className="text-[10px] text-green-600 mt-1">✓ Available</p>}
          {custIdStatus === 'taken' && (
            <p className="text-[10px] text-red-600 mt-1">
              ID already assigned.{custIdSuggestion && (
                <> Next available: <button type="button" onClick={() => { setCustId(custIdSuggestion); setCustIdStatus('available') }} className="text-primary-600 underline">{custIdSuggestion}</button></>
              )}
            </p>
          )}
        </div>

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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => { if (fileInputRef.current) { fileInputRef.current.removeAttribute('capture'); fileInputRef.current.click() } }}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                {uploading ? 'Uploading...' : 'Gallery'}
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => { if (fileInputRef.current) { fileInputRef.current.setAttribute('capture', 'environment'); fileInputRef.current.click() } }}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Camera
              </button>
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => { setPhotoPath(''); setPhotoPreview(''); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-danger-50 text-danger-600 hover:bg-danger-100 transition-colors"
                >
                  Remove
                </button>
              )}
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

        <div>
          <label className="label">{t('customers.location')} *</label>
          <select className="input" value={villageId} onChange={(e) => setVillageId(e.target.value)} required>
            <option value="">Select location</option>
            {villages.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
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
          <label className="label">{t('customers.address')}</label>
          <textarea className="input" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('customers.job_type')}</label>
            <input className="input" value={jobType} onChange={(e) => setJobType(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('customers.aadhaar')}</label>
            <input className="input" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} maxLength={12} placeholder="12 digits" />
          </div>
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
          <label className="label">Customer Location</label>
          {latitude && longitude ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 font-medium">Location captured</span>
              <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">View on Map</a>
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
              {locating ? 'Getting location...' : 'Capture Location'}
            </button>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? t('common.loading') : t('common.save')}
          </button>
          <Link href={`/b/${businessId}/customers/${customerId}`} className="btn-secondary flex-1 text-center">
            {t('common.cancel')}
          </Link>
        </div>
      </form>
    </div>
  )
}
