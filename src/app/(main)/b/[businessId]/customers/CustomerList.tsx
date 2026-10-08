'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatPaiseShort } from '@/lib/money'
import { formatDateDisplay } from '@/lib/date'
import { useTranslation } from '@/lib/i18n'

interface CustomerRow {
  id: string
  customerId: string
  fullName: string
  phone: string
  status: string
  latitude?: number | null
  longitude?: number | null
  village: { id: string; name: string }
  _count: { loans: number }
}

interface CustomerDetail {
  id: string
  customerId: string
  fullName: string
  age: number | null
  phone: string
  altPhone: string | null
  address: string | null
  aadhaarLast4: string | null
  photoPath: string | null
  jobType: string | null
  guarantorName: string | null
  guarantorPhone: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  status: string
  village: { id: string; name: string }
  createdAt: string
  summary: {
    totalLoans: number
    activeLoans: number
    completedLoans: number
    defaulterLoans: number
    totalLent: number
    totalRepayable: number
    totalPaid: number
    totalOutstanding: number
    customerStatus: string
  }
  loans: {
    id: string
    loanNumber: string
    loanAmount: number
    amountGiven: number
    interestAmount: number
    totalRepayable: number
    installmentAmount: number
    numberOfInstallments: number
    collectionType: string
    startDate: string
    expectedEndDate: string
    status: string
    totalPaid: number
    outstanding: number
    derivedStatus: string
    agent: { id: string; fullName: string } | null
  }[]
}

interface Props {
  customers: CustomerRow[]
  businessId: string
  isAdminOrOwner: boolean
}

function CustomerDetailModal({ customer, businessId, onClose }: { customer: CustomerDetail; businessId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const s = customer.summary

  function handleSharePdf() {
    const a = document.createElement('a')
    a.href = `/api/b/${businessId}/customers/${customer.id}/pdf`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function handleShareWhatsApp() {
    const p = (v: number) => `Rs.${(v / 100).toLocaleString('en-IN')}`
    const lines = [
      `*Customer: ${customer.fullName}*`,
      `ID: ${customer.customerId}`,
      `Phone: ${customer.phone}`,
      `Location: ${customer.village.name}`,
      ...(customer.address ? [`Address: ${customer.address}`] : []),
      `Status: ${s.customerStatus}`,
      ``,
      `*Financial Summary*`,
      `Total Loans: ${p(s.totalLent)}`,
      `Total Repayable: ${p(s.totalRepayable)}`,
      `Total Paid: ${p(s.totalPaid)}`,
      `Outstanding: ${p(s.totalOutstanding)}`,
      `Loans: ${s.totalLoans} (${s.activeLoans} active)`,
    ]
    const text = encodeURIComponent(lines.join('\n'))
    const a = document.createElement('a')
    a.href = `https://wa.me/?text=${text}`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const rows: { label: string; value: string }[] = [
    { label: t('customers.customer_id'), value: customer.customerId },
    { label: t('customers.full_name'), value: customer.fullName },
    { label: t('customers.age'), value: customer.age ? String(customer.age) : '-' },
    { label: t('customers.phone'), value: customer.phone || '-' },
    { label: t('customers.alt_phone'), value: customer.altPhone || '-' },
    { label: t('customers.location'), value: customer.village.name },
    { label: t('customers.address'), value: customer.address || '-' },
    { label: t('customers.occupation'), value: customer.jobType || '-' },
    { label: t('customers.aadhaar_last4'), value: customer.aadhaarLast4 ? `XXXX-XXXX-${customer.aadhaarLast4}` : '-' },
    { label: t('customers.guarantor'), value: customer.guarantorName || '-' },
    { label: t('customers.guarantor_phone'), value: customer.guarantorPhone || '-' },
    { label: t('customers.notes'), value: customer.notes || '-' },
    { label: 'GPS Location', value: customer.latitude && customer.longitude ? `${customer.latitude.toFixed(6)}, ${customer.longitude.toFixed(6)}` : '-' },
    { label: t('customers.status'), value: s.customerStatus },
    { label: t('common.created'), value: new Date(customer.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
    { label: t('customers.photo'), value: customer.photoPath ? 'Uploaded' : '-' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-base font-bold text-gray-900">{t('customers.customer_details')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Customer Header with Photo */}
        <div className="px-4 py-3 flex flex-col items-center gap-2">
          {customer.photoPath ? (
            <img src={customer.photoPath} alt={customer.fullName} className="w-[105px] h-[135px] object-cover border-2 border-gray-200 rounded-lg" />
          ) : (
            <div className="w-[105px] h-[135px] rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center text-3xl font-bold shrink-0">
              {customer.fullName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-center">
            <p className="text-base font-bold text-gray-900">{customer.fullName}</p>
            <p className="text-xs text-gray-500">{customer.customerId} · {customer.village.name}</p>
          </div>
        </div>

        {/* Summary */}
        <div className="px-4 py-3 bg-gray-50 grid grid-cols-2 gap-2">
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase">{t('customers.total_loans')}</p>
            <p className="text-sm font-bold text-gray-900">{formatPaiseShort(s.totalLent)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase">{t('customers.total_loan_amount')}</p>
            <p className="text-sm font-bold text-gray-900">{formatPaiseShort(s.totalRepayable)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase">{t('customers.total_paid')}</p>
            <p className="text-sm font-bold text-green-700">{formatPaiseShort(s.totalPaid)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase">{t('customers.total_outstanding')}</p>
            <p className="text-sm font-bold text-red-700">{formatPaiseShort(s.totalOutstanding)}</p>
          </div>
        </div>

        {/* Details */}
        <div className="px-4 py-3 space-y-0">
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500">{r.label}</span>
              {r.label === 'GPS Location' && customer.latitude && customer.longitude ? (
                <a
                  href={`https://www.google.com/maps?q=${customer.latitude},${customer.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary-600 hover:underline text-right max-w-[60%]"
                >
                  {r.value} ↗
                </a>
              ) : (
                <span className="text-xs font-medium text-gray-900 text-right max-w-[60%]">{r.value}</span>
              )}
            </div>
          ))}
        </div>

        {/* Loans */}
        {customer.loans.length > 0 && (
          <div className="px-4 pb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Loans ({s.totalLoans} total · {s.activeLoans} active)
            </h3>
            <div className="space-y-2">
              {customer.loans.map((l) => (
                <div key={l.id} className="bg-gray-50 rounded-lg p-2.5 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{l.loanNumber}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      l.derivedStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      l.derivedStatus === 'OVERDUE' ? 'bg-amber-100 text-amber-700' :
                      l.derivedStatus === 'DEFAULTER' ? 'bg-red-100 text-red-700' :
                      l.derivedStatus === 'COMPLETED' ? 'bg-blue-50 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>{l.derivedStatus}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Lent: {formatPaiseShort(l.amountGiven)}</span>
                    <span>Repayable: {formatPaiseShort(l.totalRepayable)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Paid: {formatPaiseShort(l.totalPaid)}</span>
                    <span>Due: {formatPaiseShort(l.outstanding)}</span>
                  </div>
                  <div className="text-gray-400">
                    {l.collectionType} · {formatDateDisplay(l.startDate)} → {formatDateDisplay(l.expectedEndDate)}
                    {l.agent && <> · {l.agent.fullName}</>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Share buttons */}
        <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
          <button
            onClick={handleSharePdf}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Share PDF
          </button>
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}

const PAGE_SIZES = [15, 25, 50, 100, 0] as const

export default function CustomerList({ customers, businessId, isAdminOrOwner }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 15)
  const [sortField, setSortField] = useState<string>('fullName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [viewCustomer, setViewCustomer] = useState<CustomerDetail | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergeConfirm, setMergeConfirm] = useState('')
  const [mergeMaster, setMergeMaster] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)

  function toggleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }
  const sortIcon = (field: string) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const sorted = [...customers].sort((a, b) => {
    let va: string | number = '', vb: string | number = ''
    switch (sortField) {
      case 'customerId': va = a.customerId; vb = b.customerId; break
      case 'fullName': va = a.fullName; vb = b.fullName; break
      case 'phone': va = a.phone || ''; vb = b.phone || ''; break
      case 'village': va = a.village.name; vb = b.village.name; break
      case 'status': va = a.status; vb = b.status; break
      case 'loans': va = a._count.loans; vb = b._count.loans; break
    }
    if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va
    return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })

  const showAll = pageSize === 0
  const totalPages = showAll ? 1 : Math.ceil(sorted.length / pageSize)
  const pagedCustomers = showAll ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize)

  const allIds = customers.map(c => c.id)
  const allSelected = customers.length > 0 && selected.size === customers.length

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(allIds))
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function openViewCustomer(customerId: string) {
    setViewLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/b/${businessId}/customers/${customerId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setViewCustomer(data)
    } catch {
      setError('Failed to load customer details')
    } finally {
      setViewLoading(false)
    }
  }

  const handleBulkDelete = useCallback(async () => {
    const count = selected.size
    if (!confirm(`Are you sure you want to delete ${count} customer${count > 1 ? 's' : ''}? This will also delete their closed loans and payment history. This action cannot be undone.`)) return

    setError('')
    setProcessing(true)
    try {
      const res = await fetch(`/api/b/${businessId}/customers/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: Array.from(selected) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to delete'); return }
      setSelected(new Set())
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setProcessing(false)
    }
  }, [selected, businessId, router])

  function openMerge() {
    const ids = Array.from(selected)
    setMergeMaster(ids[0])
    setMergeConfirm('')
    setShowMergeModal(true)
  }

  async function handleMerge() {
    if (!mergeMaster || mergeConfirm !== 'MERGE') return
    const duplicateIds = Array.from(selected).filter(id => id !== mergeMaster)
    setMerging(true)
    setError('')
    try {
      const res = await fetch(`/api/b/${businessId}/customers/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterId: mergeMaster, duplicateIds }),
      })
      const data = await res.json()
      if (res.ok) {
        setShowMergeModal(false)
        setSelected(new Set())
        router.refresh()
      } else {
        setError(data.error || 'Merge failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setMerging(false)
    }
  }

  const selectedId = selected.size === 1 ? Array.from(selected)[0] : null
  const selectedCustomers = customers.filter(c => selected.has(c.id))

  return (
    <>
      {error && (
        <div className="bg-danger-50 text-danger-700 text-sm px-4 py-2 rounded-lg mb-2">{error}</div>
      )}

      {/* Customer Table */}
      {customers.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 mb-4">{t('customers.no_customers')}</p>
          {isAdminOrOwner && (
            <Link href={`/b/${businessId}/customers/new`} className="btn-primary">
              {t('customers.add_first_customer')}
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-gray-500 bg-gray-50">
                {isAdminOrOwner && (
                  <th className="py-2 px-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                  </th>
                )}
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('customerId')}>{t('customers.cid')}{sortIcon('customerId')}</th>
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('fullName')}>{t('customers.customer_name')}{sortIcon('fullName')}</th>
                <th className="py-2 px-2 hidden md:table-cell cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort('phone')}>{t('customers.phone')}{sortIcon('phone')}</th>
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('village')}>{t('customers.location')}{sortIcon('village')}</th>
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('status')}>{t('customers.status')}{sortIcon('status')}</th>
                <th className="py-2 px-2 text-right hidden md:table-cell cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort('loans')}>Loans{sortIcon('loans')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedCustomers.map((c) => (
                <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 ${selected.has(c.id) ? 'bg-primary-50/30' : ''}`}>
                  {isAdminOrOwner && (
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600"
                      />
                    </td>
                  )}
                  <td className="py-2 px-2 text-gray-500 font-mono text-[10px] md:text-[11px]">{c.customerId}</td>
                  <td className="py-2 px-2">
                    <Link href={`/b/${businessId}/customers/${c.id}`} className="font-medium text-primary-600 hover:underline text-[11px] md:text-xs">{c.fullName}</Link>
                  </td>
                  <td className="py-2 px-2 text-gray-500 hidden md:table-cell">{c.phone || '-'}</td>
                  <td className="py-2 px-2 text-gray-500 text-[10px] md:text-xs">{c.village.name}</td>
                  <td className="py-2 px-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      c.status === 'ACTIVE' ? 'bg-success-50 text-success-700' :
                      c.status === 'OVERDUE' ? 'bg-red-50 text-red-700' :
                      c.status === 'DEFAULTER' ? 'bg-red-50 text-red-700' :
                      c.status === 'COMPLETED' ? 'bg-blue-50 text-blue-700' :
                      c.status === 'NO LOANS' ? 'bg-gray-100 text-gray-400' :
                      'bg-gray-100 text-gray-500'
                    }`}>{c.status}</span>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-500 hidden md:table-cell">{c._count.loans}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {customers.length > 0 && (
        <div className="flex items-center justify-between mt-3 px-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {showAll ? `All ${customers.length}` : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, customers.length)} of ${customers.length}`}
            </span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600"
            >
              {PAGE_SIZES.map(s => (
                <option key={s} value={s}>{s === 0 ? 'All' : s}</option>
              ))}
            </select>
          </div>
          {totalPages > 1 && <div className="flex gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-xs text-gray-400">...</span>}
                  <button
                    onClick={() => setPage(p)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      p === page ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>}
        </div>
      )}

      {/* Floating Action Bar */}
      {selected.size > 0 && isAdminOrOwner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg px-4 py-3 safe-area-inset-bottom">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">
              {selected.size} customer{selected.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              {selected.size === 1 && (() => {
                const cust = customers.find(c => c.id === selectedId)
                return (
                  <>
                    <button
                      onClick={() => openViewCustomer(selectedId!)}
                      disabled={viewLoading}
                      className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      {viewLoading ? '...' : t('common.view')}
                    </button>
                    {cust && cust._count.loans === 0 && (
                      <button
                        onClick={() => router.push(`/b/${businessId}/loans/new?customerId=${selectedId}`)}
                        className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        {t('loans.new_loan') || 'New Loan'}
                      </button>
                    )}
                    {cust && cust._count.loans > 0 && (
                      <button
                        onClick={() => router.push(`/b/${businessId}/posting/individual?customerId=${selectedId}`)}
                        className="px-3 py-2 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                      >
                        {t('payments.new_payment')}
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/b/${businessId}/customers/${selectedId}/edit`)}
                      className="px-3 py-2 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                    >
                      {t('common.edit')}
                    </button>
                    {cust?.latitude && cust?.longitude && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${cust.latitude},${cust.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                      >
                        Navigate
                      </a>
                    )}
                  </>
                )
              })()}
              {selected.size >= 2 && (
                <button
                  onClick={openMerge}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                >
                  Merge
                </button>
              )}
              <button
                onClick={handleBulkDelete}
                disabled={processing}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-danger-600 text-white hover:bg-danger-700 disabled:opacity-50 transition-colors"
              >
                {processing ? '...' : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowMergeModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Merge Customers</h3>
              <p className="text-sm text-gray-500 mt-1">Select the Master record. All loans from duplicates will be moved to the Master, then duplicates will be deleted.</p>
            </div>
            <div className="p-6 space-y-3">
              {selectedCustomers.map(c => (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    mergeMaster === c.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="mergeMaster"
                    checked={mergeMaster === c.id}
                    onChange={() => setMergeMaster(c.id)}
                    className="w-4 h-4 text-primary-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{c.fullName}</p>
                      {mergeMaster === c.id && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700">Master</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{c.customerId} · {c.phone} · {c.village?.name || '-'}</p>
                    <p className="text-xs text-gray-400">{c._count?.loans || 0} loan(s)</p>
                  </div>
                </label>
              ))}

              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg mb-3">
                  {selectedCustomers.filter(c => c.id !== mergeMaster).map(c => c.customerId).join(', ')} will be deleted.
                  All their loans will be moved to {selectedCustomers.find(c => c.id === mergeMaster)?.customerId || '...'}.
                  This action cannot be undone.
                </p>
                <label className="label">Type MERGE to confirm</label>
                <input
                  className="input"
                  value={mergeConfirm}
                  onChange={(e) => setMergeConfirm(e.target.value)}
                  placeholder="MERGE"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowMergeModal(false)} className="btn-secondary px-4 py-2">{t('common.cancel')}</button>
              <button
                onClick={handleMerge}
                disabled={mergeConfirm !== 'MERGE' || !mergeMaster || merging}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {merging ? 'Merging...' : 'Merge Customers'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Customer Modal */}
      {viewCustomer && (
        <CustomerDetailModal customer={viewCustomer} businessId={businessId} onClose={() => setViewCustomer(null)} />
      )}
    </>
  )
}
