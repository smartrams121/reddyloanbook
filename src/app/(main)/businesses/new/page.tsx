'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AgentInfo {
  id: string
  fullName: string
  phone: string | null
}

export default function NewBusinessPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [receiptPrefix, setReceiptPrefix] = useState('')
  const [collectionType, setCollectionType] = useState('DAILY')
  const [defaultCollectionDay, setDefaultCollectionDay] = useState('')
  const [interestModel, setInterestModel] = useState('ADDON')
  const [collectOnSundays, setCollectOnSundays] = useState(false)

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
      setError('Add at least one village')
      return
    }

    const uniqueVillages = new Set(villages.map((v) => v.toLowerCase()))
    if (uniqueVillages.size !== villages.length) {
      setError('Village names must be unique')
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        name,
        city,
        collectionType,
        interestModel,
        collectOnSundays,
        villages,
      }
      if (address) body.address = address
      if (phone) body.phone = phone
      if (receiptPrefix) body.receiptPrefix = receiptPrefix
      if (defaultCollectionDay) body.defaultCollectionDay = defaultCollectionDay
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
      <h1 className="text-xl font-bold text-gray-900 mb-1">Register New Business</h1>
      <p className="text-sm text-gray-500 mb-6">Set up a new finance collection business</p>

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

          <div>
            <label className="label">Interest Model</label>
            <div className="grid grid-cols-2 gap-2">
              {['ADDON', 'UPFRONT'].map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => setInterestModel(model)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    interestModel === model
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {model === 'ADDON' ? 'Add-on' : 'Upfront'}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={collectOnSundays} onChange={(e) => setCollectOnSundays(e.target.checked)} className="rounded border-gray-300 text-primary-600" />
            <span className="text-sm text-gray-700">Collect on Sundays</span>
          </label>
        </div>

        {/* Villages */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Villages *</h2>
            <button type="button" onClick={addVillageRow} className="text-xs text-primary-600 font-medium">
              + Add Village
            </button>
          </div>

          {villageInputs.map((v, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input flex-1"
                value={v}
                onChange={(e) => updateVillage(i, e.target.value)}
                placeholder={`Village ${i + 1} name`}
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
          <p className="text-[10px] text-gray-400">At least one village is required. You can add more later.</p>
        </div>

        {/* Agent Assignment */}
        {agents.length > 0 && (
          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Assign Agents</h2>
            <p className="text-xs text-gray-400">Select existing agents who should have access to this business</p>

            <div className="space-y-2">
              {agents.map((agent) => (
                <label key={agent.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAgentIds.includes(agent.id)}
                    onChange={() => toggleAgent(agent.id)}
                    className="rounded border-gray-300 text-primary-600"
                  />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                      {agent.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{agent.fullName}</p>
                      {agent.phone && <p className="text-xs text-gray-500">{agent.phone}</p>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

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
