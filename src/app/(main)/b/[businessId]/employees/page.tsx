'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Village { id: string; name: string }
interface Owner {
  id: string; fullName: string; username: string; phone: string | null
  role: string; isActive: boolean
}
interface Employee {
  id: string; fullName: string; username: string; phone: string | null
  role: string; isActive: boolean; assigned: boolean; villageIds: string[]
}

export default function EmployeesAssignmentPage() {
  const params = useParams()
  const businessId = params.businessId as string

  const [owner, setOwner] = useState<Owner | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  function loadData() {
    fetch(`/api/b/${businessId}/employees`)
      .then(r => r.json())
      .then(data => {
        if (data.owner) setOwner(data.owner)
        if (data.employees) setEmployees(data.employees)
        if (data.villages) setVillages(data.villages)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [businessId])

  async function toggleAssign(emp: Employee) {
    setSaving(emp.id)
    try {
      const res = await fetch(`/api/b/${businessId}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: emp.assigned ? 'unassign' : 'assign',
          userId: emp.id,
        }),
      })
      if (res.ok) {
        setEmployees(prev => prev.map(e =>
          e.id === emp.id
            ? { ...e, assigned: !e.assigned, villageIds: e.assigned ? [] : e.villageIds }
            : e
        ))
        if (!emp.assigned) setExpandedUser(emp.id)
        else if (expandedUser === emp.id) setExpandedUser(null)
      }
    } catch {}
    finally { setSaving(null) }
  }

  async function toggleVillage(userId: string, villageId: string) {
    const emp = employees.find(e => e.id === userId)
    if (!emp) return

    const newVillageIds = emp.villageIds.includes(villageId)
      ? emp.villageIds.filter(v => v !== villageId)
      : [...emp.villageIds, villageId]

    setSaving(userId)
    try {
      const res = await fetch(`/api/b/${businessId}/employees`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, villageIds: newVillageIds }),
      })
      if (res.ok) {
        setEmployees(prev => prev.map(e =>
          e.id === userId ? { ...e, villageIds: newVillageIds } : e
        ))
      }
    } catch {}
    finally { setSaving(null) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  const assignedEmployees = employees.filter(e => e.assigned)
  const unassignedEmployees = employees.filter(e => !e.assigned)

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Employees</h1>
      <p className="text-sm text-gray-500 mb-6">Assign employees to this business and their locations</p>

      {employees.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm mb-3">No employees found.</p>
          <Link href="/employees" className="text-primary-600 text-sm font-medium hover:underline">
            Create employees first →
          </Link>
        </div>
      )}

      {/* Assigned Employees */}
      {(owner || assignedEmployees.length > 0) && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Assigned ({assignedEmployees.length})
          </h2>
          <div className="space-y-2">
            {/* Owner Row */}
            {owner && (
              <div className="card bg-amber-50 border-l-4 border-amber-400">
                <div className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs font-bold shrink-0">
                    {owner.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{owner.fullName}</p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Owner
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      @{owner.username}{owner.phone ? ` · ${owner.phone}` : ''} · All Villages
                    </p>
                  </div>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 shrink-0">
                    Active
                  </span>
                </div>
              </div>
            )}

            {assignedEmployees.map(emp => (
              <div key={emp.id} className="card">
                <div className="p-4 flex items-center gap-3">
                  <button
                    onClick={() => toggleAssign(emp)}
                    disabled={saving === emp.id}
                    className="w-5 h-5 rounded border-2 border-primary-600 bg-primary-600 flex items-center justify-center shrink-0 disabled:opacity-50"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedUser(expandedUser === emp.id ? null : emp.id)}>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/b/${businessId}/users/${emp.id}`}
                        className="text-sm font-semibold text-primary-600 hover:underline truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {emp.fullName}
                      </Link>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        emp.role === 'AGENT' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                      }`}>
                        {emp.role === 'BUSINESS_ADMIN' ? 'Admin' : 'Agent'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      @{emp.username}{emp.phone ? ` · ${emp.phone}` : ''}
                      {emp.villageIds.length > 0 && (
                        <span className="text-gray-400"> · {emp.villageIds.length} location{emp.villageIds.length !== 1 ? 's' : ''}</span>
                      )}
                    </p>
                  </div>

                  <Link
                    href={`/b/${businessId}/users/${emp.id}`}
                    className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View
                  </Link>

                  <button
                    onClick={() => setExpandedUser(expandedUser === emp.id ? null : emp.id)}
                    className="shrink-0"
                  >
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedUser === emp.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Village assignments */}
                {expandedUser === emp.id && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-[10px] text-gray-400 uppercase font-medium mb-2">Assign Locations</p>
                    {villages.length === 0 ? (
                      <p className="text-xs text-gray-400">No locations in this business yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {villages.map(v => {
                          const isAssigned = emp.villageIds.includes(v.id)
                          return (
                            <button
                              key={v.id}
                              onClick={() => toggleVillage(emp.id, v.id)}
                              disabled={saving === emp.id}
                              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors disabled:opacity-50 ${
                                isAssigned
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {v.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned Employees */}
      {unassignedEmployees.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Available ({unassignedEmployees.length})
          </h2>
          <div className="space-y-2">
            {unassignedEmployees.map(emp => (
              <div key={emp.id} className="card p-4 flex items-center gap-3">
                <button
                  onClick={() => toggleAssign(emp)}
                  disabled={saving === emp.id}
                  className="w-5 h-5 rounded border-2 border-gray-300 shrink-0 disabled:opacity-50 hover:border-primary-400 transition-colors"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{emp.fullName}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      emp.role === 'AGENT' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                    }`}>
                      {emp.role === 'BUSINESS_ADMIN' ? 'Admin' : 'Agent'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">@{emp.username}{emp.phone ? ` · ${emp.phone}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/employees" className="text-sm text-primary-600 font-medium hover:underline">
          + Create New Employee
        </Link>
      </div>
    </div>
  )
}
