'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

interface BusinessSettings {
  id: string
  name: string
  city: string
  address: string | null
  phone: string | null
  receiptPrefix: string | null
  collectionType: string
  defaultCollectionDay: string | null
  collectionDays: string
  gracePeriodDaily: number
  gracePeriodWeekly: number
  gracePeriodMonthly: number
  ratingGoodMaxPct: number
  ratingAverageMaxPct: number
  repaymentMultiplierDailyWeekly: number
  repaymentMultiplierMonthly: number
  whatsappTemplate: string
  autoLogoutMinutes: number
  customerSeq: number; loanSeq: number; receiptSeq: number
  customerIdFormat: string; customerIdPrefix: string; customerIdPadding: number; customerIdStart: number; customerIdMax: number
  loanIdFormat: string; loanIdPrefix: string; loanIdPadding: number; loanIdStart: number; loanIdMax: number
  receiptIdFormat: string; receiptIdPrefix: string; receiptIdPadding: number; receiptIdStart: number; receiptIdMax: number
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams()
  const businessId = params.businessId as string

  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [basicInfoOpen, setBasicInfoOpen] = useState(false)
  const [otherOpen, setOtherOpen] = useState(false)
  const [seqOpen, setSeqOpen] = useState(false)
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
          defaultCollectionDay: settings.defaultCollectionDay || undefined,
          collectionDays: settings.collectionDays,
          gracePeriodDaily: settings.gracePeriodDaily,
          gracePeriodWeekly: settings.gracePeriodWeekly,
          gracePeriodMonthly: settings.gracePeriodMonthly,
          repaymentMultiplierDailyWeekly: settings.repaymentMultiplierDailyWeekly,
          repaymentMultiplierMonthly: settings.repaymentMultiplierMonthly,
          ratingGoodMaxPct: settings.ratingGoodMaxPct,
          ratingAverageMaxPct: settings.ratingAverageMaxPct,
          whatsappTemplate: settings.whatsappTemplate,
          autoLogoutMinutes: settings.autoLogoutMinutes,
          customerIdFormat: settings.customerIdFormat,
          customerIdPrefix: settings.customerIdPrefix,
          customerIdPadding: settings.customerIdPadding,
          customerIdStart: settings.customerIdStart,
          customerIdMax: settings.customerIdMax,
          loanIdFormat: settings.loanIdFormat,
          loanIdPrefix: settings.loanIdPrefix,
          loanIdPadding: settings.loanIdPadding,
          loanIdStart: settings.loanIdStart,
          loanIdMax: settings.loanIdMax,
          receiptIdFormat: settings.receiptIdFormat,
          receiptIdPrefix: settings.receiptIdPrefix,
          receiptIdPadding: settings.receiptIdPadding,
          receiptIdStart: settings.receiptIdStart,
          receiptIdMax: settings.receiptIdMax,
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

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  async function handleDeleteBusiness() {
    if (!settings || deleteConfirmText !== 'DELETE') return

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
      setShowDeleteModal(false)
      setDeleteConfirmText('')
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
      setTimeout(() => URL.revokeObjectURL(url), 3000)
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
          {t('settings.back_to_menu')}
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">{t('settings.collection_settings')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">{success}</div>
        )}

        {/* Basic Info */}
        <div className="card">
          <button type="button" onClick={() => setBasicInfoOpen(!basicInfoOpen)} className="w-full p-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('settings.basic_info')}</h2>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${basicInfoOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {basicInfoOpen && <div className="px-4 pb-4 space-y-4">

          <div>
            <label className="label">{t('settings.collection_id')}</label>
            <input className="input bg-gray-100 text-gray-500 cursor-not-allowed" value={settings.id} disabled readOnly />
            <p className="text-[10px] text-gray-400 mt-1">{t('settings.system_generated')}</p>
          </div>
          <div>
            <label className="label">{t('settings.collection_name')}</label>
            <input className="input" value={settings.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div>
            <label className="label">{t('settings.city')}</label>
            <input className="input" value={settings.city} onChange={(e) => update('city', e.target.value)} required />
          </div>
          <div>
            <label className="label">{t('settings.address')}</label>
            <input className="input" value={settings.address || ''} onChange={(e) => update('address', e.target.value)} />
          </div>
          <div>
            <label className="label">{t('settings.phone')}</label>
            <input className="input" value={settings.phone || ''} onChange={(e) => update('phone', e.target.value)} />
          </div>
          <div>
            <label className="label">{t('settings.receipt_prefix')}</label>
            <input
              className="input"
              value={settings.receiptPrefix || ''}
              onChange={(e) => update('receiptPrefix', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5))}
              placeholder="e.g. SDF"
              maxLength={5}
            />
          </div>
        </div>}
        </div>

        {/* Collection Settings */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('common.collection')}</h2>

          <div>
            <label className="label">{t('settings.collection_type')}</label>
            <input className="input bg-gray-100 text-gray-500 cursor-not-allowed" value={settings.collectionType === 'DAILY' ? 'Daily' : settings.collectionType === 'WEEKLY' ? 'Weekly' : 'Monthly'} disabled readOnly />
            <p className="text-[10px] text-gray-400 mt-1">Set at business creation, cannot be changed</p>
          </div>

          {settings.collectionType === 'WEEKLY' && (
            <div>
              <label className="label">{t('settings.collection_day')}</label>
              <select className="input" value={settings.defaultCollectionDay || ''} onChange={(e) => update('defaultCollectionDay', e.target.value || null)}>
                <option value="">Select day</option>
                {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((d) => (
                  <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          )}

          {settings.collectionType === 'DAILY' && (
            <div>
              <label className="label">{t('settings.collection_days')}</label>
              <div className="flex flex-wrap gap-2">
                {(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const).map((day) => {
                  const labels: Record<string, string> = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun' }
                  const days = (settings.collectionDays || 'MON,TUE,WED,THU,FRI,SAT,SUN').split(',')
                  const active = days.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const current = (settings.collectionDays || 'MON,TUE,WED,THU,FRI,SAT,SUN').split(',')
                        const updated = active ? current.filter(d => d !== day) : [...current, day]
                        update('collectionDays', updated.join(','))
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-500 border-gray-200'
                      }`}
                    >
                      {labels[day]}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Uncheck days when no collection happens</p>
            </div>
          )}

          <div>
            <label className="label">{t('settings.repayment_multiplier')}</label>
            <input
              type="number"
              className="input"
              step="0.01"
              min="1"
              max="5"
              value={settings.collectionType === 'MONTHLY' ? settings.repaymentMultiplierMonthly : settings.repaymentMultiplierDailyWeekly}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || (settings.collectionType === 'MONTHLY' ? 1.40 : 1.20)
                if (settings.collectionType === 'MONTHLY') update('repaymentMultiplierMonthly', v)
                else update('repaymentMultiplierDailyWeekly', v)
              }}
            />
            <p className="text-[10px] text-gray-400 mt-1">Applied to principal for ADDON loans. e.g. 1.20 = 20% interest.</p>
          </div>

          <div>
            <label className="label">{t('settings.grace_period')} ({settings.collectionType === 'DAILY' ? t('common.days').toLowerCase() : settings.collectionType === 'WEEKLY' ? t('common.weeks').toLowerCase() : t('common.months').toLowerCase()})</label>
            <input
              type="number"
              className="input"
              min="0"
              value={settings.collectionType === 'MONTHLY' ? settings.gracePeriodMonthly : settings.collectionType === 'WEEKLY' ? settings.gracePeriodWeekly : settings.gracePeriodDaily}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 0
                if (settings.collectionType === 'MONTHLY') update('gracePeriodMonthly', v)
                else if (settings.collectionType === 'WEEKLY') update('gracePeriodWeekly', v)
                else update('gracePeriodDaily', v)
              }}
            />
            <p className="text-[10px] text-gray-400 mt-1">After the last due date + grace period, the loan becomes overdue.</p>
          </div>
        </div>

        {/* Other */}
        <div className="card">
          <button type="button" onClick={() => setOtherOpen(!otherOpen)} className="w-full p-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('settings.other_settings')}</h2>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${otherOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {otherOpen && <div className="px-4 pb-4 space-y-4">

          <div>
            <label className="label">{t('settings.whatsapp_template')}</label>
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
            <label className="label">{t('settings.auto_logout')}</label>
            <input
              type="number"
              className="input"
              value={settings.autoLogoutMinutes}
              onChange={(e) => update('autoLogoutMinutes', parseInt(e.target.value) || 30)}
              min={5}
              max={480}
            />
          </div>
        </div>}
        </div>

        {/* Business Sequence */}
        <div className="card">
          <button type="button" onClick={() => setSeqOpen(!seqOpen)} className="w-full p-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('settings.uid_formatting')}</h2>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${seqOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {seqOpen && <div className="px-4 pb-4 space-y-6">
            {/* Customer ID Config */}
            {(['customer', 'loan', 'receipt'] as const).map(type => {
              const labels = { customer: t('settings.customer_id'), loan: t('settings.loan_id'), receipt: t('settings.receipt_id') }
              const fmtKey = `${type}IdFormat` as keyof BusinessSettings
              const prefixKey = `${type}IdPrefix` as keyof BusinessSettings
              const padKey = `${type}IdPadding` as keyof BusinessSettings
              const startKey = `${type}IdStart` as keyof BusinessSettings
              const maxKey = `${type}IdMax` as keyof BusinessSettings
              const seqKey = `${type}Seq` as keyof BusinessSettings
              return (
                <div key={type} className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{labels[type]}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">{t('settings.format')}</label>
                      <select className="input text-xs" value={settings[fmtKey] as string} onChange={(e) => {
                        const oldVal = settings[fmtKey]
                        if (oldVal !== e.target.value && (settings[seqKey] as number) > 0) {
                          if (!confirm(`Changing ${labels[type]} format. Existing IDs will keep their old format. New IDs will use the new format. Continue?`)) return
                        }
                        update(fmtKey, e.target.value)
                      }}>
                        <option value="NUMERIC">Numeric (1, 2, 3)</option>
                        <option value="STRING">String (0001, 0002)</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">{t('settings.prefix')}</label>
                      <input className="input text-xs" value={settings[prefixKey] as string} onChange={(e) => update(prefixKey, e.target.value)} placeholder="e.g. CUS, VF" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {settings[fmtKey] === 'STRING' && (
                      <div>
                        <label className="label text-xs">{t('settings.padding')}</label>
                        <input type="number" className="input text-xs" min={1} max={10} value={settings[padKey] as number} onChange={(e) => update(padKey, parseInt(e.target.value) || 4)} />
                      </div>
                    )}
                    <div>
                      <label className="label text-xs">{t('settings.start')}</label>
                      <input type="number" className="input text-xs" min={1} value={settings[startKey] as number} onChange={(e) => update(startKey, parseInt(e.target.value) || 1)} />
                    </div>
                    <div>
                      <label className="label text-xs">{t('settings.max')}</label>
                      <input type="number" className="input text-xs" min={1} value={settings[maxKey] as number} onChange={(e) => update(maxKey, parseInt(e.target.value) || 100000)} />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">Current: {settings[seqKey] as number} · Next: {(settings[seqKey] as number) + 1}</p>
                </div>
              )
            })}
          </div>}
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full btn-lg">
          {saving ? t('common.saving') : t('settings.save_settings')}
        </button>

        {/* Export Data */}
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('common.export_data')}</h2>
          <p className="text-xs text-gray-500">
            Download all business data as an Excel file — includes Locations, Customers, Loans, Payments, and Users across separate sheets.
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="w-full text-sm font-medium px-4 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? t('settings.preparing_export') : t('settings.download_collection_data')}
          </button>
        </div>

        {/* Danger Zone */}
        <div className="card border-red-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide">{t('settings.danger_zone')}</h2>
          <p className="text-xs text-gray-500">
            {t('settings.danger_zone_warning')}
          </p>
          <button
            type="button"
            onClick={() => { setShowDeleteModal(true); setDeleteConfirmText('') }}
            className="w-full text-sm font-medium px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            {t('settings.delete_collection')}
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
              <h3 className="text-base font-semibold text-red-700">Delete &quot;{settings.name}&quot;?</h3>
              <p className="text-xs text-gray-600">
                This will permanently delete all customers, loans, payments, locations, employees, and reports. This action cannot be undone.
              </p>
              <div>
                <label className="label text-xs">Type <span className="font-bold">DELETE</span> to confirm</label>
                <input
                  type="text"
                  className="input"
                  placeholder="DELETE"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }}
                  className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBusiness}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? t('common.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
