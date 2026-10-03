'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AgentInfo {
  id: string
  fullName: string
  phone: string | null
}

interface SheetResult {
  name: string
  rowCount: number
  passed: boolean
  errors: { sheet: string; row: number; field: string; message: string }[]
}

interface TestResult {
  sheetResults: SheetResult[]
  summary: { locations: number; users: number; customers: number; loans: number; payments: number }
  warnings: { sheet: string; message: string }[]
  passed: boolean
}

export default function NewBusinessPage() {
  const router = useRouter()

  // Import state
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importName, setImportName] = useState('')
  const [importCity, setImportCity] = useState('')
  const [importPrefix, setImportPrefix] = useState('')
  const [importTesting, setImportTesting] = useState(false)
  const [importImporting, setImportImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  async function handleDownloadTemplate() {
    const a = document.createElement('a')
    a.href = '/api/businesses/import'
    a.download = 'Business_Import_Template.xlsx'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function handleTest() {
    if (!importFile || !importName || !importCity) return
    setImportTesting(true)
    setImportError('')
    setTestResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('name', importName)
      fd.append('city', importCity)
      if (importPrefix) fd.append('receiptPrefix', importPrefix)
      fd.append('action', 'test')

      const res = await fetch('/api/businesses/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setImportError(data.error || 'Test failed')
        return
      }
      setTestResult(data)
    } catch {
      setImportError('Network error during test')
    } finally {
      setImportTesting(false)
    }
  }

  async function handleImport() {
    if (!importFile || !importName || !importCity || !testResult?.passed) return
    setImportImporting(true)
    setImportError('')
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('name', importName)
      fd.append('city', importCity)
      if (importPrefix) fd.append('receiptPrefix', importPrefix)
      fd.append('action', 'import')

      const res = await fetch('/api/businesses/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setImportError(data.error || 'Import failed')
        return
      }
      router.push('/dashboard')
    } catch {
      setImportError('Network error during import')
    } finally {
      setImportImporting(false)
    }
  }

  // Manual creation state
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [receiptPrefix, setReceiptPrefix] = useState('')
  const [collectionType, setCollectionType] = useState('DAILY')
  const [defaultCollectionDay, setDefaultCollectionDay] = useState('')
  const ALL_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const
  const DAY_LABELS: Record<string, string> = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun' }
  const [collectionDays, setCollectionDays] = useState<string[]>([...ALL_DAYS])
  const [multiplierDailyWeekly, setMultiplierDailyWeekly] = useState(1.20)
  const [multiplierMonthly, setMultiplierMonthly] = useState(1.40)

  const [villageInputs, setVillageInputs] = useState([''])
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/owner/agents')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAgents(data)
      })
      .catch(() => {})
  }, [])

  function addVillageRow() {
    setVillageInputs([...villageInputs, ''])
  }

  function removeVillageRow(index: number) {
    if (villageInputs.length <= 1) return
    setVillageInputs(villageInputs.filter((_, i) => i !== index))
  }

  function updateVillage(index: number, value: string) {
    const updated = [...villageInputs]
    updated[index] = value
    setVillageInputs(updated)
  }

  function toggleAgent(agentId: string) {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const villages = villageInputs.map((v) => v.trim()).filter((v) => v.length > 0)
    if (villages.length === 0) {
      setError('Add at least one location')
      return
    }

    const uniqueVillages = new Set(villages.map((v) => v.toLowerCase()))
    if (uniqueVillages.size !== villages.length) {
      setError('Location names must be unique')
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        name,
        city,
        collectionType,
        collectionDays: collectionDays.join(','),
        villages,
      }
      if (address) body.address = address
      if (phone) body.phone = phone
      if (receiptPrefix) body.receiptPrefix = receiptPrefix
      if (defaultCollectionDay) body.defaultCollectionDay = defaultCollectionDay
      body.repaymentMultiplierDailyWeekly = multiplierDailyWeekly
      body.repaymentMultiplierMonthly = multiplierMonthly
      if (selectedAgentIds.length > 0) body.agentIds = selectedAgentIds

      const res = await fetch('/api/businesses', {
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
          setError(data.error || 'Failed to create business')
        }
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const showDaySelector = collectionType === 'WEEKLY'
  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">New Business</h1>
      <p className="text-sm text-gray-500 mb-6">Create a new business or import from an existing export</p>

      {/* Import Existing Business (collapsed by default) */}
      <div className="card mb-6">
        <button
          type="button"
          onClick={() => setImportOpen(!importOpen)}
          className="w-full p-4 flex items-center justify-between"
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Import Existing Business</h2>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${importOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {importOpen && <div className="px-4 pb-4 space-y-4">
        <p className="text-xs text-gray-400">Upload a previously exported business data file (.xlsx) to recreate the business with all its data.</p>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="text-xs text-primary-600 font-medium underline"
        >
          Download Sample Format
        </button>

        <div>
          <label className="label">Business Name *</label>
          <input className="input" value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="e.g. Sai Finance" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">City *</label>
            <input className="input" value={importCity} onChange={(e) => setImportCity(e.target.value)} placeholder="e.g. Visakhapatnam" />
          </div>
          <div>
            <label className="label">Receipt Prefix</label>
            <input className="input" value={importPrefix} onChange={(e) => setImportPrefix(e.target.value.toUpperCase())} placeholder="e.g. SF" maxLength={5} />
          </div>
        </div>

        <div>
          <label className="label">Upload XLSX File *</label>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => { setImportFile(e.target.files?.[0] || null); setTestResult(null) }}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100"
          />
        </div>

        {importError && (
          <div className="bg-danger-50 text-danger-700 text-xs px-3 py-2 rounded-lg">{importError}</div>
        )}

        {/* Test Results */}
        {testResult && (
          <div className={`rounded-lg border p-3 space-y-2 ${testResult.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <p className={`text-sm font-semibold ${testResult.passed ? 'text-green-700' : 'text-red-700'}`}>
              {testResult.passed ? 'Test Passed — Ready to import' : 'Test Failed — Fix errors and re-test'}
            </p>

            <div className="space-y-1">
              {testResult.sheetResults.map((sr) => (
                <div key={sr.name} className="flex items-center gap-2 text-xs">
                  <span className={sr.passed ? 'text-green-600' : 'text-red-600'}>
                    {sr.passed ? '✓' : '✗'}
                  </span>
                  <span className="font-medium text-gray-700">{sr.name}</span>
                  <span className="text-gray-500">({sr.rowCount} rows)</span>
                  {sr.errors.length > 0 && (
                    <span className="text-red-600">— {sr.errors.length} error{sr.errors.length > 1 ? 's' : ''}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Show first few errors */}
            {testResult.sheetResults.some(sr => sr.errors.length > 0) && (
              <div className="mt-2 space-y-1">
                {testResult.sheetResults.flatMap(sr => sr.errors).slice(0, 10).map((err, i) => (
                  <p key={i} className="text-[10px] text-red-600">
                    [{err.sheet}] Row {err.row}: {err.field} — {err.message}
                  </p>
                ))}
                {testResult.sheetResults.flatMap(sr => sr.errors).length > 10 && (
                  <p className="text-[10px] text-red-500 italic">...and more errors</p>
                )}
              </div>
            )}

            {/* Warnings */}
            {testResult.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {testResult.warnings.map((w, i) => (
                  <p key={i} className="text-[10px] text-amber-600">⚠ [{w.sheet}] {w.message}</p>
                ))}
              </div>
            )}

            {/* Summary */}
            {testResult.passed && (
              <div className="flex flex-wrap gap-3 mt-2">
                {[
                  { label: 'Locations', count: testResult.summary.locations },
                  { label: 'Customers', count: testResult.summary.customers },
                  { label: 'Loans', count: testResult.summary.loans },
                  { label: 'Payments', count: testResult.summary.payments },
                  { label: 'Employees', count: testResult.summary.users },
                ].map(({ label, count }) => (
                  <div key={label} className="bg-white rounded px-2 py-1 text-xs border border-green-200">
                    <span className="font-semibold text-gray-700">{count.toLocaleString()}</span>
                    <span className="text-gray-500 ml-1">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={!importFile || !importName || !importCity || importTesting}
            className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {importTesting ? 'Testing...' : 'Test'}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!testResult?.passed || importImporting}
            className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {importImporting ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-xs text-gray-400 uppercase font-medium">or create manually</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        {/* Basic Info */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Basic Info</h2>

          <div>
            <label className="label">Business Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sai Finance" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">City *</label>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Visakhapatnam" required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div>
            <label className="label">Address</label>
            <textarea className="input" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
          </div>

          <div>
            <label className="label">Receipt Prefix</label>
            <input className="input" value={receiptPrefix} onChange={(e) => setReceiptPrefix(e.target.value.toUpperCase())} placeholder="e.g. SF" maxLength={5} />
            <p className="text-[10px] text-gray-400 mt-1">Uppercase letters only. Used for customer IDs (e.g. SF0001)</p>
          </div>
        </div>

        {/* Collection Settings */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Collection Settings</h2>

          <div>
            <label className="label">Collection Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {['DAILY', 'WEEKLY', 'MONTHLY'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCollectionType(type)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    collectionType === type
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {showDaySelector && (
            <div>
              <label className="label">Collection Day</label>
              <select className="input" value={defaultCollectionDay} onChange={(e) => setDefaultCollectionDay(e.target.value)}>
                <option value="">Select day</option>
                {days.map((d) => (
                  <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          )}

          {collectionType === 'DAILY' && (
            <div>
              <label className="label">Collection Days</label>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setCollectionDays(prev =>
                        prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                      )
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      collectionDays.includes(day)
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Uncheck days when no collection happens</p>
            </div>
          )}

          <div>
            <label className="label">Repayment Multiplier</label>
            <input
              type="number"
              className="input"
              step="0.01"
              min="1"
              max="5"
              value={collectionType === 'MONTHLY' ? multiplierMonthly : multiplierDailyWeekly}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || (collectionType === 'MONTHLY' ? 1.40 : 1.20)
                if (collectionType === 'MONTHLY') setMultiplierMonthly(v)
                else setMultiplierDailyWeekly(v)
              }}
            />
            <p className="text-[10px] text-gray-400 mt-1">Applied to principal for ADDON loans. e.g. 1.20 = 20% interest.</p>
          </div>
        </div>

        {/* Villages */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Locations *</h2>
            <button type="button" onClick={addVillageRow} className="text-xs text-primary-600 font-medium">
              + Add Location
            </button>
          </div>

          {villageInputs.map((v, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input flex-1"
                value={v}
                onChange={(e) => updateVillage(i, e.target.value)}
                placeholder={`Location ${i + 1} name`}
              />
              {villageInputs.length > 1 && (
                <button type="button" onClick={() => removeVillageRow(i)} className="text-danger-500 hover:text-danger-700 px-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          <p className="text-[10px] text-gray-400">At least one location is required. You can add more later.</p>
        </div>


        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Creating...' : 'Create Business'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
