'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Village {
  id: string
  name: string
}

export default function NewCustomerPage() {
  const params = useParams()
  const router = useRouter()
  const businessId = params.businessId as string

  const [villages, setVillages] = useState<Village[]>([])
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [altPhone, setAltPhone] = useState('')
  const [age, setAge] = useState('')
  const [villageId, setVillageId] = useState('')
  const [address, setAddress] = useState('')
  const [aadhaar, setAadhaar] = useState('')
  const [guarantorName, setGuarantorName] = useState('')
  const [guarantorPhone, setGuarantorPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [photoPath, setPhotoPath] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/b/${businessId}/villages`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setVillages(data)
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
    setGuarantorName('')
    setGuarantorPhone('')
    setNotes('')
    setPhotoPath('')
    setPhotoPreview('')
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

  async function handleSubmit(continueAdding: boolean) {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const body: Record<string, unknown> = {
        fullName,
        phone,
        villageId,
      }
      if (altPhone) body.altPhone = altPhone
      if (age) body.age = parseInt(age, 10)
      if (address) body.address = address
      if (aadhaar) body.aadhaar = aadhaar
      if (guarantorName) body.guarantorName = guarantorName
      if (guarantorPhone) body.guarantorPhone = guarantorPhone
      if (notes) body.notes = notes
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

      if (continueAdding) {
        setSuccess(`${fullName} created. Add next customer.`)
        resetForm()
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
      <h1 className="text-xl font-bold text-gray-900 mb-1">New Customer</h1>
      <p className="text-sm text-gray-500 mb-6">Register a new customer</p>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false) }} className="space-y-4">
        {success && (
          <div className="bg-success-50 text-success-700 text-sm px-4 py-3 rounded-lg">{success}</div>
        )}
        {error && (
          <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        {/* Photo */}
        <div>
          <label className="label">Photo</label>
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
          <label className="label">Full Name *</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>

        <div>
          <label className="label">Phone *</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" required />
        </div>

        <div>
          <label className="label">Village *</label>
          <select className="input" value={villageId} onChange={(e) => setVillageId(e.target.value)} required>
            <option value="">Select village</option>
            {villages.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Age</label>
            <input type="number" className="input" value={age} onChange={(e) => setAge(e.target.value)} min={18} max={100} />
          </div>
          <div>
            <label className="label">Alt Phone</label>
            <input className="input" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Address</label>
          <textarea className="input" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <div>
          <label className="label">Aadhaar Number</label>
          <input className="input" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} placeholder="12 digits (stored securely)" maxLength={12} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Guarantor Name</label>
            <input className="input" value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} />
          </div>
          <div>
            <label className="label">Guarantor Phone</label>
            <input className="input" value={guarantorPhone} onChange={(e) => setGuarantorPhone(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Creating...' : 'Create'}
          </button>
          <button type="button" disabled={loading} onClick={() => handleSubmit(true)} className="btn-secondary flex-1">
            {loading ? 'Creating...' : 'Create & Next'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
