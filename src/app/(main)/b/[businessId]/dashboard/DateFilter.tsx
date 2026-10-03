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

interface Village { id: string; name: string }
interface Employee { id: string; name: string }

export default function DateFilter({ villages, employees }: { villages?: Village[]; employees?: Employee[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeRange = searchParams.get('range') || 'today'
  const [fromDate, setFromDate] = useState(searchParams.get('from') || '')
  const [toDate, setToDate] = useState(searchParams.get('to') || '')
  const selectedVillages = searchParams.get('villages')?.split(',').filter(Boolean) || []
  const selectedEmployees = searchParams.get('employees')?.split(',').filter(Boolean) || []

  function buildParams(overrides?: { range?: string; from?: string; to?: string; villages?: string[]; employees?: string[] }) {
    const params = new URLSearchParams()
    const range = overrides?.range ?? activeRange
    if (range !== 'today') params.set('range', range)
    if (range === 'custom') {
      const f = overrides?.from ?? fromDate
      const t = overrides?.to ?? toDate
      if (f) params.set('from', f)
      if (t) params.set('to', t)
      const vils = overrides?.villages ?? selectedVillages
      if (vils.length > 0) params.set('villages', vils.join(','))
      const emps = overrides?.employees ?? selectedEmployees
      if (emps.length > 0) params.set('employees', emps.join(','))
    }
    return params.toString()
  }

  function selectPreset(key: string) {
    router.push(`${pathname}?${buildParams({ range: key })}`)
  }

  function applyFilters() {
    router.push(`${pathname}?${buildParams({ range: 'custom', from: fromDate, to: toDate })}`)
  }

  function toggleVillage(villageId: string) {
    const newVillages = selectedVillages.includes(villageId)
      ? selectedVillages.filter(v => v !== villageId)
      : [...selectedVillages, villageId]
    router.push(`${pathname}?${buildParams({ villages: newVillages })}`)
  }

  function toggleEmployee(employeeId: string) {
    const newEmployees = selectedEmployees.includes(employeeId)
      ? selectedEmployees.filter(e => e !== employeeId)
      : [...selectedEmployees, employeeId]
    router.push(`${pathname}?${buildParams({ employees: newEmployees })}`)
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
        <div className="space-y-3 mt-2">
          {/* Date Range */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">From</label>
              <input type="date" className="input text-sm" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">To</label>
              <input type="date" className="input text-sm" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <button onClick={applyFilters} disabled={!fromDate || !toDate} className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
              Apply
            </button>
          </div>

          {/* Village Filter */}
          {villages && villages.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Village</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => router.push(`${pathname}?${buildParams({ villages: [] })}`)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    selectedVillages.length === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {villages.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => toggleVillage(v.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      selectedVillages.includes(v.id) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Employee Filter */}
          {employees && employees.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Employee</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => router.push(`${pathname}?${buildParams({ employees: [] })}`)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    selectedEmployees.length === 0 ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {employees.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => toggleEmployee(e.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      selectedEmployees.includes(e.id) ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
