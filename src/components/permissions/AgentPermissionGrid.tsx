'use client'

import { useState, useEffect } from 'react'
import { type AgentPermissionGrid as GridType, PRESETS, DEFAULT_PRESET, applyCascades, detectPreset } from '@/lib/agent-permissions'
import { useTranslation } from '@/lib/i18n'

interface Props {
  value: GridType | null
  onChange: (grid: GridType) => void
  saving?: boolean
}

const OBJECTS: { key: string; label: string; sub: string; verbs: string[] }[] = [
  { key: 'customers', label: 'Customers', sub: 'View / manage customers', verbs: ['view', 'create', 'edit', 'delete'] },
  { key: 'loans', label: 'Loans', sub: 'View / manage loans', verbs: ['view', 'create', 'edit', 'delete'] },
  { key: 'payments', label: 'Payments', sub: 'View payment history', verbs: ['view'] },
  { key: 'record_payment', label: 'Record Payment', sub: 'Post individual payments', verbs: ['view', 'create', 'edit'] },
  { key: 'bulk_payment', label: 'Bulk Payment', sub: 'Post village batch payments', verbs: ['view', 'create', 'edit'] },
  { key: 'reports', label: 'Reports', sub: 'View & download reports', verbs: ['view'] },
]

const ALL_VERBS = ['view', 'create', 'edit', 'delete']

function getDefault(): GridType {
  return JSON.parse(JSON.stringify(PRESETS[DEFAULT_PRESET]))
}

export default function AgentPermissionGrid({ value, onChange, saving }: Props) {
  const { t } = useTranslation()
  const [grid, setGrid] = useState<GridType>(value ? JSON.parse(JSON.stringify(value)) : getDefault())
  const [preset, setPreset] = useState(() => detectPreset(value ?? getDefault()))

  useEffect(() => {
    if (value) {
      setGrid(JSON.parse(JSON.stringify(value)))
      setPreset(detectPreset(value))
    }
  }, [value])

  function updateGrid(newGrid: GridType) {
    const cascaded = applyCascades(newGrid)
    setGrid(cascaded)
    setPreset(detectPreset(cascaded))
    onChange(cascaded)
  }

  function toggleCell(obj: string, verb: string) {
    const g = JSON.parse(JSON.stringify(grid)) as GridType
    const objPerms = g[obj as keyof GridType] as Record<string, boolean>
    objPerms[verb] = !objPerms[verb]
    updateGrid(g)
  }

  function applyPreset(name: string) {
    if (name === 'CUSTOM') return
    const p = PRESETS[name]
    if (p) {
      updateGrid(JSON.parse(JSON.stringify(p)))
    }
  }

  function isDisabled(obj: string, verb: string): boolean {
    if (verb === 'view') return false
    const objPerms = grid[obj as keyof GridType] as Record<string, boolean>
    if (!objPerms.view) return true
    if ((obj === 'record_payment' || obj === 'bulk_payment') && !grid.payments.view) return true
    return false
  }

  function hasVerb(obj: string, verb: string): boolean {
    return OBJECTS.find(o => o.key === obj)?.verbs.includes(verb) ?? false
  }

  function getCellValue(obj: string, verb: string): boolean {
    const objPerms = grid[obj as keyof GridType] as Record<string, boolean>
    return objPerms[verb] ?? false
  }

  const presetButtons = [
    { key: 'COLLECTOR_ONLY', label: t('common.collector') },
    { key: 'FIELD_MANAGER', label: t('common.field_manager') },
    { key: 'FULL_ACCESS', label: t('common.full_access') },
    { key: 'CUSTOM', label: t('common.custom') },
  ]

  return (
    <div className="space-y-3">
      {/* Presets */}
      <div className="flex gap-2 flex-wrap">
        {presetButtons.map(p => (
          <button
            key={p.key}
            type="button"
            disabled={saving}
            onClick={() => applyPreset(p.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              preset === p.key
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Object</th>
              {ALL_VERBS.map(v => (
                <th key={v} className="py-2 text-center text-gray-500 font-semibold uppercase tracking-wide text-[10px] w-14">{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OBJECTS.map(obj => (
              <tr key={obj.key} className="border-b border-gray-100">
                <td className="py-2.5 pr-2">
                  <span className="text-sm font-medium text-gray-900">{obj.label}</span>
                  <span className="block text-[10px] text-gray-400">{obj.sub}</span>
                </td>
                {ALL_VERBS.map(verb => (
                  <td key={verb} className="py-2.5 text-center">
                    {hasVerb(obj.key, verb) ? (
                      <button
                        type="button"
                        disabled={saving || isDisabled(obj.key, verb)}
                        onClick={() => toggleCell(obj.key, verb)}
                        className={`w-9 h-5 rounded-full relative transition-colors ${
                          isDisabled(obj.key, verb)
                            ? 'bg-gray-200 opacity-40 cursor-not-allowed'
                            : getCellValue(obj.key, verb)
                              ? 'bg-primary-600'
                              : 'bg-gray-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                          getCellValue(obj.key, verb) ? 'left-[18px]' : 'left-0.5'
                        }`} />
                      </button>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info note */}
      <div className="flex gap-2 p-2.5 rounded-lg bg-amber-50 text-amber-700 text-[11px] leading-relaxed">
        <span className="shrink-0">⚠</span>
        <span>Turning off <strong>View</strong> hides the object from navigation and blocks API access. Payments View controls Record + Bulk Payment visibility.</span>
      </div>
    </div>
  )
}
