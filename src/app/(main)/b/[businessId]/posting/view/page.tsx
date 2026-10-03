'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatPaiseShort } from '@/lib/money'
import { formatDateDisplay } from '@/lib/date'

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

  useEffect(() => {
    Promise.all([
      fetch(`/api/b/${businessId}/villages`).then(r => r.json()),
      fetch(`/api/b/${businessId}/users`).then(r => r.json()),
    ]).then(([vils, users]) => {
      if (Array.isArray(vils)) setVillages(vils)
      if (Array.isArray(users)) setEmployees(users)
    }).catch(() => {})
  }, [businessId])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('from', fromDate)
    params.set('to', toDate)
    if (villageId) params.set('villageId', villageId)
    if (collectorId) params.set('collectorId', collectorId)

    fetch(`/api/b/${businessId}/payments?${params}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPayments(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [businessId, fromDate, toDate, villageId, collectorId])

  function selectPreset(key: string) {
    setPreset(key)
    if (key === 'today') { setFromDate(today); setToDate(today) }
    else if (key === 'yesterday') { const y = yesterdayStr(); setFromDate(y); setToDate(y) }
  }

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)

  function handleSharePdf() {
    const a = document.createElement('a')
    a.href = `/api/b/${businessId}/reports/download?entity=payments&from=${fromDate}&to=${toDate}&format=pdf`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
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
          <h1 className="text-xl font-bold text-gray-900">View Payments</h1>
          <p className="text-sm text-gray-500">{payments.length} payments · {formatPaiseShort(totalAmount)}</p>
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
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'custom', label: 'Custom' },
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
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label text-xs">From</label>
                <input type="date" className="input text-xs py-1.5" value={fromDate} onChange={e => { setFromDate(e.target.value) }} max={toDate} />
              </div>
              <div className="flex-1">
                <label className="label text-xs">To</label>
                <input type="date" className="input text-xs py-1.5" value={toDate} onChange={e => { setToDate(e.target.value) }} min={fromDate} max={today} />
              </div>
            </div>

            {villages.length > 0 && (
              <div>
                <label className="label text-xs">Village</label>
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
                <label className="label text-xs">Employee</label>
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
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : payments.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm">No payments found for this period.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-gray-500 bg-gray-50">
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Customer</th>
                <th className="py-2 px-3 hidden md:table-cell">Village</th>
                <th className="py-2 px-3 text-right">Amount</th>
                <th className="py-2 px-3 hidden md:table-cell">Collector</th>
                <th className="py-2 px-3 hidden md:table-cell">Mode</th>
                <th className="py-2 px-3 hidden md:table-cell">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-500">{formatDateDisplay(p.paymentDate)}</td>
                  <td className="py-2 px-3">
                    <Link href={`/b/${businessId}/customers/${p.loan.customer.id}`} className="font-medium text-primary-600 hover:underline">{p.loan.customer.fullName}</Link>
                    <p className="text-[10px] text-gray-400 md:hidden">{p.loan.customer.village.name} · {p.collector.fullName}</p>
                  </td>
                  <td className="py-2 px-3 text-gray-500 hidden md:table-cell">{p.loan.customer.village.name}</td>
                  <td className="py-2 px-3 text-right font-semibold text-green-700">{formatPaiseShort(p.amount)}</td>
                  <td className="py-2 px-3 hidden md:table-cell"><Link href={`/b/${businessId}/users/${p.collector.id}`} className="text-primary-600 hover:underline">{p.collector.fullName}</Link></td>
                  <td className="py-2 px-3 text-gray-500 hidden md:table-cell">{p.note || '-'}</td>
                  <td className="py-2 px-3 text-gray-400 font-mono hidden md:table-cell">{p.receiptNumber}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="py-2 px-3 font-semibold text-gray-700" colSpan={3}>Total ({payments.length})</td>
                <td className="py-2 px-3 text-right font-bold text-green-700">{formatPaiseShort(totalAmount)}</td>
                <td className="hidden md:table-cell" colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Actions */}
      {payments.length > 0 && (
        <div className="flex gap-3 mt-4">
          <button onClick={handleSharePdf} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors">
            Download PDF
          </button>
          <button onClick={handleWhatsAppShare} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
            Share WhatsApp
          </button>
        </div>
      )}
    </div>
  )
}
