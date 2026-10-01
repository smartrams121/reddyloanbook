'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface BusinessSettings {
  id: string
  name: string
  city: string
  address: string | null
  phone: string | null
  receiptPrefix: string | null
  collectionType: string
  defaultCollectionDay: string | null
  interestModel: string
  collectOnSundays: boolean
  gracePeriodDaily: number
  gracePeriodWeekly: number
  gracePeriodMonthly: number
  ratingGoodMaxPct: number
  ratingAverageMaxPct: number
  whatsappTemplate: string
  autoLogoutMinutes: number
}

export default function SettingsPage() {
  const router = useRouter()
  const params = useParams()
  const businessId = params.businessId as string

  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch(`/api/b/${businessId}/settings`)
      .then((r) => r.json())
      .then((data) => {
        setSettings(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load settings')
        setLoading(false)
      })
  }, [businessId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!settings) return
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const res = await fetch(`/api/b/${businessId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settings.name,
          city: settings.city,
          address: settings.address || undefined,
          phone: settings.phone || undefined,
          receiptPrefix: settings.receiptPrefix || undefined,
          collectionType: settings.collectionType,
          defaultCollectionDay: settings.defaultCollectionDay || undefined,
          interestModel: settings.interestModel,
          collectOnSundays: settings.collectOnSundays,
          gracePeriodDaily: settings.gracePeriodDaily,
          gracePeriodWeekly: settings.gracePeriodWeekly,
          gracePeriodMonthly: settings.gracePeriodMonthly,
          ratingGoodMaxPct: settings.ratingGoodMaxPct,
          ratingAverageMaxPct: settings.ratingAverageMaxPct,
          whatsappTemplate: settings.whatsappTemplate,
          autoLogoutMinutes: settings.autoLogoutMinutes,
        }),
      })

      if (res.ok) {
        setSuccess('Settings saved successfully')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save settings')
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBusiness() {
    if (!settings) return
    const confirmation = prompt(`This will permanently delete "${settings.name}" and ALL its data (customers, loans, payments, locations, etc.).\n\nType the business name to confirm:`)
    if (confirmation !== settings.name) {
      if (confirmation !== null) setError('Business name did not match. Deletion cancelled.')
      return
    }

    setError('')
    setDeleting(true)
    try {
      const res = await fetch(`/api/b/${businessId}/settings`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to delete business'); return }
      router.push('/dashboard')
    } catch {
      setError('Network error')
    } finally {
      setDeleting(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    setError('')
    try {
      const res = await fetch(`/api/b/${businessId}/settings/export`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to export data')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      a.download = match?.[1] || 'business_export.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Network error during export')
    } finally {
      setExporting(false)
    }
  }

  function update(field: keyof BusinessSettings, value: unknown) {
    if (!settings) return
    setSettings({ ...settings, [field]: value })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!settings) {
    return <div className="px-4 py-6 text-center text-gray-500">Failed to load settings.</div>
  }

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <div className="mb-6">
        <Link href={`/b/${businessId}/more`} className="text-sm text-primary-600 hover:underline">
          ← Back to Menu
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Business Settings</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">{success}</div>
        )}

        {/* Basic Info */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Basic Info</h2>

          <div>
            <label className="label">Business ID</label>
            <input className="input bg-gray-100 text-gray-500 cursor-not-allowed" value={settings.id} disabled readOnly />
            <p className="text-[10px] text-gray-400 mt-1">System-generated, cannot be changed</p>
          </div>
          <div>
            <label className="label">Business Name</label>
            <input className="input" value={settings.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div>
            <label className="label">City</label>
            <input className="input" value={settings.city} onChange={(e) => update('city', e.target.value)} required />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={settings.address || ''} onChange={(e) => update('address', e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={settings.phone || ''} onChange={(e) => update('phone', e.target.value)} />
          </div>
          <div>
            <label className="label">Receipt Prefix</label>
            <input
              className="input"
              value={settings.receiptPrefix || ''}
              onChange={(e) => update('receiptPrefix', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5))}
              placeholder="e.g. SDF"
              maxLength={5}
            />
          </div>
        </div>

        {/* Collection Settings */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Collection</h2>

          <div>
            <label className="label">Collection Type</label>
            <select className="input" value={settings.collectionType} onChange={(e) => update('collectionType', e.target.value)}>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>

          {settings.collectionType === 'WEEKLY' && (
            <div>
              <label className="label">Collection Day</label>
              <select className="input" value={settings.defaultCollectionDay || ''} onChange={(e) => update('defaultCollectionDay', e.target.value || null)}>
                <option value="">Select day</option>
                {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((d) => (
                  <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Interest Model</label>
            <select className="input" value={settings.interestModel} onChange={(e) => update('interestModel', e.target.value)}>
              <option value="ADDON">Add-on (interest added to total)</option>
              <option value="UPFRONT">Upfront (interest deducted from given amount)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.collectOnSundays}
              onChange={(e) => update('collectOnSundays', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm text-gray-700">Collect on Sundays</span>
          </label>
        </div>

        {/* Grace Periods */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Grace Periods</h2>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label text-xs">Daily (days)</label>
              <input type="number" className="input" value={settings.gracePeriodDaily} onChange={(e) => update('gracePeriodDaily', parseInt(e.target.value) || 0)} min={0} />
            </div>
            <div>
              <label className="label text-xs">Weekly (weeks)</label>
              <input type="number" className="input" value={settings.gracePeriodWeekly} onChange={(e) => update('gracePeriodWeekly', parseInt(e.target.value) || 0)} min={0} />
            </div>
            <div>
              <label className="label text-xs">Monthly (months)</label>
              <input type="number" className="input" value={settings.gracePeriodMonthly} onChange={(e) => update('gracePeriodMonthly', parseInt(e.target.value) || 0)} min={0} />
            </div>
          </div>
        </div>

        {/* Rating Thresholds */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Rating Thresholds</h2>
          <p className="text-xs text-gray-500">% of grace period used. Excellent = 0%, Good ≤ X%, Average ≤ Y%, Bad = above Y%</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Good max %</label>
              <input type="number" className="input" value={settings.ratingGoodMaxPct} onChange={(e) => update('ratingGoodMaxPct', parseInt(e.target.value) || 0)} min={0} max={100} />
            </div>
            <div>
              <label className="label text-xs">Average max %</label>
              <input type="number" className="input" value={settings.ratingAverageMaxPct} onChange={(e) => update('ratingAverageMaxPct', parseInt(e.target.value) || 0)} min={0} max={200} />
            </div>
          </div>
        </div>

        {/* Other */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Other</h2>

          <div>
            <label className="label">WhatsApp Template</label>
            <textarea
              className="input min-h-[80px]"
              value={settings.whatsappTemplate}
              onChange={(e) => update('whatsappTemplate', e.target.value)}
              rows={3}
            />
            <p className="text-xs text-gray-400 mt-1">
              Variables: {'{{businessName}}'}, {'{{amount}}'}, {'{{date}}'}, {'{{outstanding}}'}
            </p>
          </div>

          <div>
            <label className="label">Auto Logout (minutes)</label>
            <input
              type="number"
              className="input"
              value={settings.autoLogoutMinutes}
              onChange={(e) => update('autoLogoutMinutes', parseInt(e.target.value) || 30)}
              min={5}
              max={480}
            />
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full btn-lg">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>

        {/* Export Data */}
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Export Data</h2>
          <p className="text-xs text-gray-500">
            Download all business data as an Excel file — includes Locations, Customers, Loans, Payments, and Users across separate sheets.
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="w-full text-sm font-medium px-4 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? 'Preparing Export...' : 'Download Business Data (.xlsx)'}
          </button>
        </div>

        {/* Danger Zone */}
        <div className="card border-red-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide">Danger Zone</h2>
          <p className="text-xs text-gray-500">
            Permanently delete this business and all associated data — customers, loans, payments, locations, employees, and reports. This action cannot be undone.
          </p>
          <button
            type="button"
            onClick={handleDeleteBusiness}
            disabled={deleting}
            className="w-full text-sm font-medium px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting...' : 'Delete Business'}
          </button>
        </div>
      </form>
    </div>
  )
}
