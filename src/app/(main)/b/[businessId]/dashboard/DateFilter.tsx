'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '1 Month' },
  { key: 'custom', label: 'Custom' },
] as const

export default function DateFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeRange = searchParams.get('range') || 'today'
  const [fromDate, setFromDate] = useState(searchParams.get('from') || '')
  const [toDate, setToDate] = useState(searchParams.get('to') || '')

  function selectPreset(key: string) {
    const params = new URLSearchParams()
    if (key !== 'today') {
      params.set('range', key)
    }
    if (key === 'custom' && fromDate && toDate) {
      params.set('from', fromDate)
      params.set('to', toDate)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function applyCustomRange() {
    if (!fromDate || !toDate) return
    const params = new URLSearchParams()
    params.set('range', 'custom')
    params.set('from', fromDate)
    params.set('to', toDate)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2 mb-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => selectPreset(p.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeRange === p.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {activeRange === 'custom' && (
        <div className="flex items-end gap-2 mt-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">From</label>
            <input
              type="date"
              className="input text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">To</label>
            <input
              type="date"
              className="input text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <button
            onClick={applyCustomRange}
            disabled={!fromDate || !toDate}
            className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
