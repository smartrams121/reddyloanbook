'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatPaiseShort } from '@/lib/money'
import { formatDateDisplay } from '@/lib/date'
import { useTranslation } from '@/lib/i18n'

interface Village { id: string; name: string }
interface Employee { id: string; fullName: string }
interface PaymentRow {
  id: string; amount: number; paymentDate: string; receiptNumber: string; note: string | null
  loan: {
    loanNumber: string; totalRepayable: number
    customer: { id: string; fullName: string; customerId: string; village: { id: string; name: string } }
  }
  collector: { id: string; fullName: string }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ViewPaymentsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const businessId = params.businessId as string
  const today = todayStr()

  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  const [preset, setPreset] = useState('today')
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [villageId, setVillageId] = useState('')
  const [collectorId, setCollectorId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(0)
  const [sortField, setSortField] = useState('paymentDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [totalActiveLoans, setTotalActiveLoans] = useState(0)
  const [totalExpected, setTotalExpected] = useState(0)

  // Customer search
  const [customers, setCustomers] = useState<{ id: string; fullName: string; phone: string; customerId: string; village: { name: string } }[]>([])
  const [customerQuery, setCustomerQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; fullName: string; customerId: string } | null>(null)
  const [selectedLoanNumber, setSelectedLoanNumber] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/b/${businessId}/villages`).then(r => r.json()),
      fetch(`/api/b/${businessId}/users`).then(r => r.json()),
      fetch(`/api/b/${businessId}/customers`).then(r => r.json()),
    ]).then(([vils, users, custs]) => {
      if (Array.isArray(vils)) setVillages(vils)
      if (Array.isArray(users)) setEmployees(users)
      if (Array.isArray(custs)) setCustomers(custs)
    }).catch(() => {})
  }, [businessId])

  const filteredCusts = customerQuery.trim()
    ? customers.filter(c =>
        c.fullName.toLowerCase().includes(customerQuery.toLowerCase()) ||
        c.phone?.includes(customerQuery) ||
        c.customerId.toLowerCase().includes(customerQuery.toLowerCase())
      ).slice(0, 10)
    : []

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('from', fromDate)
    params.set('to', toDate)
    if (villageId) params.set('villageId', villageId)
    if (collectorId) params.set('collectorId', collectorId)
    if (selectedCustomer) params.set('customerId', selectedCustomer.id)

    Promise.all([
      fetch(`/api/b/${businessId}/payments?${params}`).then(r => r.json()),
      fetch(`/api/b/${businessId}/loans?activeOnDate=${toDate}`).then(r => r.json()).catch(() => []),
    ]).then(([payData, loanData]) => {
      if (Array.isArray(payData)) setPayments(payData)
      if (Array.isArray(loanData)) {
        setTotalActiveLoans(loanData.length)
        setTotalExpected(loanData.reduce((sum: number, l: { installmentAmount: number }) => sum + (l.installmentAmount || 0), 0))
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [businessId, fromDate, toDate, villageId, collectorId, selectedCustomer])

  function daysAgo(n: number) {
    const d = new Date(); d.setDate(d.getDate() - n)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  function selectPreset(key: string) {
    setPreset(key)
    if (key === 'today') { setFromDate(today); setToDate(today) }
    else if (key === 'yesterday') { const y = yesterdayStr(); setFromDate(y); setToDate(y) }
    else if (key === '7d') { setFromDate(daysAgo(6)); setToDate(today) }
    else if (key === '15d') { setFromDate(daysAgo(14)); setToDate(today) }
    else if (key === '30d') { setFromDate(daysAgo(29)); setToDate(today) }
    else if (key === 'all') { setFromDate('2020-01-01'); setToDate(today) }
  }

  function toggleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }
  const sortIcon = (field: string) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const sorted = [...payments].sort((a, b) => {
    let va: string | number = '', vb: string | number = ''
    switch (sortField) {
      case 'paymentDate': va = a.paymentDate; vb = b.paymentDate; break
      case 'customer': va = a.loan.customer.fullName; vb = b.loan.customer.fullName; break
      case 'loanNumber': va = a.loan.loanNumber; vb = b.loan.loanNumber; break
      case 'village': va = a.loan.customer.village.name; vb = b.loan.customer.village.name; break
      case 'amount': va = a.amount; vb = b.amount; break
      case 'collector': va = a.collector.fullName; vb = b.collector.fullName; break
      case 'mode': va = a.note || ''; vb = b.note || ''; break
      case 'receipt': va = a.receiptNumber; vb = b.receiptNumber; break
    }
    if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va
    return sortDir === 'asc' ? String(va).localeCompare(String(vb), undefined, { numeric: true }) : String(vb).localeCompare(String(va), undefined, { numeric: true })
  })

  const loanFiltered = selectedLoanNumber
    ? sorted.filter(p => p.loan.loanNumber === selectedLoanNumber)
    : sorted

  const PAGE_SIZES = [10, 25, 50, 100, 0] as const
  const showAll = pageSize === 0
  const totalPages = showAll ? 1 : Math.ceil(loanFiltered.length / pageSize)
  const pagedPayments = showAll ? loanFiltered : loanFiltered.slice((page - 1) * pageSize, page * pageSize)
  const totalAmount = loanFiltered.reduce((sum, p) => sum + p.amount, 0)

  // Get unique loan numbers for the selected customer
  const customerLoanNumbers = selectedCustomer
    ? Array.from(new Set(payments.map(p => p.loan.loanNumber))).sort()
    : []

  useEffect(() => { setPage(1) }, [fromDate, toDate, villageId, collectorId])

  function handleDownload(format: 'pdf' | 'xlsx') {
    const a = document.createElement('a')
    a.href = `/api/b/${businessId}/reports/download?entity=payments&from=${fromDate}&to=${toDate}&format=${format}`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function handleWhatsAppShareFile(format: 'pdf' | 'xlsx') {
    const ext = format === 'pdf' ? 'pdf' : 'xlsx'
    const mime = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const fileName = `payments_${fromDate}_to_${toDate}.${ext}`
    const url = `/api/b/${businessId}/reports/download?entity=payments&from=${fromDate}&to=${toDate}&format=${format}`

    fetch(url).then(res => res.blob()).then(blob => {
      const file = new File([blob], fileName, { type: mime })
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ title: 'Payment Report', files: [file] })
      } else {
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000)
        const text = encodeURIComponent(`Payment Report (${formatDateDisplay(fromDate)} – ${formatDateDisplay(toDate)}): ${formatPaiseShort(totalAmount)}`)
        const wa = document.createElement('a')
        wa.href = `https://wa.me/?text=${text}`
        wa.target = '_blank'
        wa.rel = 'noopener noreferrer'
        document.body.appendChild(wa)
        wa.click()
        wa.remove()
      }
    }).catch(() => {})
  }

  function handleWhatsAppShare() {
    const lines = [
      `*Payment Collection Report*`,
      `Date: ${formatDateDisplay(fromDate)}${fromDate !== toDate ? ` to ${formatDateDisplay(toDate)}` : ''}`,
      `Total: ${formatPaiseShort(totalAmount)} (${payments.length} payments)`,
      '',
      ...payments.slice(0, 20).map(p =>
        `${p.loan.customer.fullName} · ${p.loan.customer.village.name} · ${formatPaiseShort(p.amount)} · ${p.collector.fullName}`
      ),
      ...(payments.length > 20 ? [`...and ${payments.length - 20} more`] : []),
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

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('payments.view_payments')}</h1>
          <p className="text-sm text-gray-500">{loanFiltered.length} payments · {formatPaiseShort(totalAmount)}</p>
        </div>
        <Link href={`/b/${businessId}/posting`} className="text-sm text-primary-600 hover:underline">
          ← Back
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-4 space-y-3">
        {/* Date presets */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'today', label: t('common.today') },
            { key: 'yesterday', label: t('common.yesterday') },
            { key: '7d', label: `7 ${t('common.days')}` },
            { key: '15d', label: `15 ${t('common.days')}` },
            { key: '30d', label: `30 ${t('common.days')}` },
            { key: 'all', label: t('common.all') },
            { key: 'custom', label: t('common.custom') },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => selectPreset(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                preset === p.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date + filters */}
        {preset === 'custom' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-2">
              <div>
                <label className="label text-xs">{t('common.from')}</label>
                <input type="date" className="input w-full min-w-0 text-xs py-1.5" value={fromDate} onChange={e => { setFromDate(e.target.value) }} max={toDate} />
              </div>
              <div>
                <label className="label text-xs">{t('common.to')}</label>
                <input type="date" className="input w-full min-w-0 text-xs py-1.5" value={toDate} onChange={e => { setToDate(e.target.value) }} min={fromDate} max={today} />
              </div>
            </div>

            {villages.length > 0 && (
              <div>
                <label className="label text-xs">{t('customers.village')}</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setVillageId('')} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${!villageId ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
                  {villages.map(v => (
                    <button key={v.id} onClick={() => setVillageId(villageId === v.id ? '' : v.id)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${villageId === v.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{v.name}</button>
                  ))}
                </div>
              </div>
            )}

            {employees.length > 0 && (
              <div>
                <label className="label text-xs">{t('common.employee')}</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setCollectorId('')} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${!collectorId ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
                  {employees.map(e => (
                    <button key={e.id} onClick={() => setCollectorId(collectorId === e.id ? '' : e.id)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${collectorId === e.id ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{e.fullName}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Customer Search */}
        <div>
          {selectedCustomer ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Customer:</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary-100 text-primary-700">
                {selectedCustomer.fullName} ({selectedCustomer.customerId})
                <button onClick={() => { setSelectedCustomer(null); setSelectedLoanNumber('') }} className="hover:text-primary-900">×</button>
              </span>
              {customerLoanNumbers.length > 1 && (
                <>
                  <span className="text-xs text-gray-500">Loan:</span>
                  <select value={selectedLoanNumber} onChange={(e) => { setSelectedLoanNumber(e.target.value); setPage(1) }} className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600">
                    <option value="">All Loans ({customerLoanNumbers.length})</option>
                    {customerLoanNumbers.map(ln => <option key={ln} value={ln}>{ln}</option>)}
                  </select>
                </>
              )}
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                className="input text-xs py-1.5 pl-8"
                placeholder="Search customer by name, phone, or ID..."
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              {filteredCusts.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                  {filteredCusts.map(c => (
                    <button key={c.id} onClick={() => { setSelectedCustomer({ id: c.id, fullName: c.fullName, customerId: c.customerId }); setCustomerQuery(''); setPage(1) }} className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                      <span className="text-xs font-medium text-gray-900">{c.fullName}</span>
                      <span className="text-[10px] text-gray-500 ml-2">{c.customerId} · {c.phone} · {c.village?.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payments Table */}
      {/* Collection Stats */}
      {!loading && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {(() => {
            const uniquePaidLoanIds = new Set(payments.map(p => p.loan?.loanNumber).filter(Boolean))
            const paidCount = uniquePaidLoanIds.size
            const unpaidCount = Math.max(0, totalActiveLoans - paidCount)
            const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0)
            const pct = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0
            const bulkDate = preset === 'today' ? today
              : preset === 'yesterday' ? yesterdayStr()
              : preset === '7d' ? daysAgo(6)
              : preset === '15d' ? daysAgo(14)
              : preset === '30d' ? daysAgo(29)
              : preset === 'custom' ? fromDate
              : today
            return (
              <>
                <Link
                  href={`/b/${businessId}/posting/bulk?date=${bulkDate}&completed=1&details=1&collector=self`}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                >
                  Paid: {paidCount}
                </Link>
                <Link
                  href={`/b/${businessId}/posting/bulk`}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                >
                  Unpaid: {unpaidCount}
                </Link>
                <span className="text-xs text-gray-500">
                  Expected: {formatPaiseShort(totalExpected)} · Collected: {formatPaiseShort(totalCollected)} · {pct}%
                </span>
              </>
            )
          })()}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : payments.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm">{t('payments.no_payments_found')}</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-gray-500 bg-gray-50">
                <th className="py-2 px-2 hidden md:table-cell cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort('receipt')}>{t('common.receipt')}{sortIcon('receipt')}</th>
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('loanNumber')}>{t('loans.loan_number_short')}{sortIcon('loanNumber')}</th>
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('customer')}>{t('customers.customers')}{sortIcon('customer')}</th>
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs">{t('customers.cid')}</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('amount')}>{t('common.amount')}{sortIcon('amount')}</th>
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('paymentDate')}>{t('common.date')}{sortIcon('paymentDate')}</th>
                <th className="py-2 px-2 hidden md:table-cell cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort('village')}>{t('customers.village')}{sortIcon('village')}</th>
                <th className="py-2 px-2 cursor-pointer hover:text-gray-700 select-none text-[11px] md:text-xs" onClick={() => toggleSort('collector')}>{t('loans.agent')}{sortIcon('collector')}</th>
                <th className="py-2 px-2 hidden md:table-cell cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort('mode')}>{t('common.mode')}{sortIcon('mode')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedPayments.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-2 text-gray-400 font-mono text-[10px] hidden md:table-cell">{p.receiptNumber}</td>
                  <td className="py-2 px-2 text-gray-500 font-mono text-[10px] md:text-xs">{p.loan.loanNumber}</td>
                  <td className="py-2 px-2"><Link href={`/b/${businessId}/customers/${p.loan.customer.id}`} className="font-medium text-primary-600 hover:underline text-[11px] md:text-xs">{p.loan.customer.fullName}</Link></td>
                  <td className="py-2 px-2 text-gray-500 font-mono text-[10px]">{p.loan.customer.customerId}</td>
                  <td className="py-2 px-2 text-right font-semibold text-green-700 text-[10px] md:text-xs">{formatPaiseShort(p.amount)}</td>
                  <td className="py-2 px-2 text-gray-500 text-[10px] md:text-xs date-display">{formatDateDisplay(p.paymentDate)}</td>
                  <td className="py-2 px-2 text-gray-500 hidden md:table-cell">{p.loan.customer.village.name}</td>
                  <td className="py-2 px-2 text-[10px] md:text-xs"><Link href={`/b/${businessId}/users/${p.collector.id}`} className="text-primary-600 hover:underline">{p.collector.fullName}</Link></td>
                  <td className="py-2 px-2 text-gray-500 hidden md:table-cell">{p.note || '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="py-2 px-2 font-semibold text-gray-700" colSpan={4}>Total ({loanFiltered.length})</td>
                <td className="py-2 px-3 text-right font-bold text-green-700">{formatPaiseShort(totalAmount)}</td>
                <td className="hidden md:table-cell" colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Pagination */}
      {payments.length > 0 && (
        <div className="flex items-center justify-between mt-3 px-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {showAll ? `All ${payments.length}` : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, payments.length)} of ${payments.length}`}
            </span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s === 0 ? 'All' : s}</option>)}
            </select>
          </div>
          {totalPages > 1 && <div className="flex gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">First</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
              <span key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-xs text-gray-400">...</span>}
                <button onClick={() => setPage(p)} className={`px-2.5 py-1 text-xs rounded border transition-colors ${p === page ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{p}</button>
              </span>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">Next</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">Last</button>
          </div>}
        </div>
      )}

      {/* Actions — Desktop: Download PDF + XLSX, Mobile: Share PDF + XLSX via WhatsApp */}
      {payments.length > 0 && (
        <>
          <div className="hidden md:flex gap-3 mt-4">
            <button onClick={() => handleDownload('pdf')} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
              {t('payments.download_pdf')}
            </button>
            <button onClick={() => handleDownload('xlsx')} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-colors">
              {t('payments.download_xlsx')}
            </button>
          </div>
          <div className="flex md:hidden gap-3 mt-4">
            <button onClick={() => handleWhatsAppShareFile('pdf')} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
              {t('payments.share_pdf')}
            </button>
            <button onClick={() => handleWhatsAppShareFile('xlsx')} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
              {t('payments.share_xlsx')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
