'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Agent { id: string; fullName: string; role: string }
interface LoanData {
  id: string
  loanNumber: string
  customerId: string
  customer: { id: string; fullName: string; customerId: string; phone: string }
  loanAmount: number
  interestAmount: number
  totalRepayable: number
  amountGiven: number
  collectionType: string
  collectionDay: string | null
  installmentAmount: number
  numberOfInstallments: number
  lastInstallmentAmount: number
  startDate: string
  expectedEndDate: string
  agentId: string | null
  status: string
  notes: string | null
}
interface BusinessSettings { interestModel: string; collectOnSundays: boolean }

export default function EditLoanPage() {
  const params = useParams()
  const router = useRouter()
  const businessId = params.businessId as string
  const loanId = params.loanId as string

  const [loan, setLoan] = useState<LoanData | null>(null)
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  const [loanAmountStr, setLoanAmountStr] = useState('')
  const [interestAmountStr, setInterestAmountStr] = useState('')
  const [collectionType, setCollectionType] = useState('DAILY')
  const [collectionDay, setCollectionDay] = useState('')
  const [installmentStr, setInstallmentStr] = useState('')
  const [numInstallmentsStr, setNumInstallmentsStr] = useState('')
  const [startDate, setStartDate] = useState('')
  const [agentId, setAgentId] = useState('')
  const [notes, setNotes] = useState('')

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/b/${businessId}/loans/${loanId}`).then(r => { if (!r.ok) throw new Error(); return r.json() }),
      fetch(`/api/b/${businessId}/settings`).then(r => r.json()),
      fetch(`/api/b/${businessId}/users`).then(r => r.json()),
    ]).then(([loanData, biz, users]) => {
      setLoan(loanData)
      setSettings(biz)
      if (Array.isArray(users)) setAgents(users.filter((u: Agent) => u.role === 'AGENT'))

      // Populate form — amounts stored in paise, show in rupees
      setLoanAmountStr(String(loanData.loanAmount / 100))
      setInterestAmountStr(String(loanData.interestAmount / 100))
      setCollectionType(loanData.collectionType)
      setCollectionDay(loanData.collectionDay || '')
      setInstallmentStr(String(loanData.installmentAmount / 100))
      setNumInstallmentsStr(String(loanData.numberOfInstallments))
      setStartDate(loanData.startDate)
      setAgentId(loanData.agentId || '')
      setNotes(loanData.notes || '')
      setLoading(false)
    }).catch(() => { setError('Failed to load loan'); setLoading(false) })
  }, [businessId, loanId])

  const loanAmount = parseInt(loanAmountStr) || 0
  const interestAmount = parseInt(interestAmountStr) || 0
  const installmentAmount = parseInt(installmentStr) || 0
  const numInstallments = parseInt(numInstallmentsStr) || 0

  const totalRepayable = loanAmount + interestAmount
  const amountGiven = settings?.interestModel === 'UPFRONT'
    ? loanAmount - interestAmount
    : loanAmount
  const lastInstallment = numInstallments > 0
    ? totalRepayable - installmentAmount * (numInstallments - 1)
    : 0

  function autoCalcInstallments() {
    if (totalRepayable > 0 && installmentAmount > 0) {
      setNumInstallmentsStr(String(Math.ceil(totalRepayable / installmentAmount)))
    }
  }

  function autoCalcInstallmentAmount() {
    if (totalRepayable > 0 && numInstallments > 0) {
      setInstallmentStr(String(Math.floor(totalRepayable / numInstallments)))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (loanAmount <= 0) { setError('Loan amount must be positive'); return }
    if (installmentAmount <= 0) { setError('Installment amount must be positive'); return }
    if (numInstallments <= 0) { setError('Number of installments must be positive'); return }
    if (lastInstallment <= 0) { setError('Last installment would be zero or negative. Adjust amounts.'); return }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        loanAmount: loanAmount * 100,
        interestAmount: interestAmount * 100,
        collectionType,
        installmentAmount: installmentAmount * 100,
        numberOfInstallments: numInstallments,
        startDate,
        agentId: agentId || null,
        notes: notes || null,
      }
      if (collectionType === 'WEEKLY' && collectionDay) body.collectionDay = collectionDay
      else body.collectionDay = null

      const res = await fetch(`/api/b/${businessId}/loans/${loanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.details) setError(Object.values(data.details).flat().join(', '))
        else setError(data.error || 'Failed to update loan')
        return
      }
      router.push(`/b/${businessId}/customers/${loan!.customerId}`)
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!loan) {
    return <div className="px-4 py-6 text-center text-gray-500">{error || 'Loan not found'}</div>
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Link href={`/b/${businessId}/customers/${loan.customerId}`} className="text-sm text-primary-600 hover:underline">
        &larr; Back to Customer
      </Link>

      <h1 className="text-xl font-bold text-gray-900 mt-3 mb-1">Edit Loan</h1>

      {/* Loan Number — read-only */}
      <div className="card p-3 bg-gray-50 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Loan Number</p>
            <p className="text-sm font-bold text-gray-900 font-mono">{loan.loanNumber}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Customer</p>
            <p className="text-sm font-semibold text-gray-900">{loan.customer.fullName}</p>
            <p className="text-[10px] text-gray-400">{loan.customer.customerId}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Amount Section */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Loan Amount</h2>

          <div>
            <label className="label">Principal Amount (₹) *</label>
            <input
              type="number"
              className="input text-lg font-semibold"
              value={loanAmountStr}
              onChange={(e) => setLoanAmountStr(e.target.value)}
              min={1}
              required
            />
          </div>

          <div>
            <label className="label">Interest Amount (₹) *</label>
            <input
              type="number"
              className="input"
              value={interestAmountStr}
              onChange={(e) => setInterestAmountStr(e.target.value)}
              min={0}
              required
            />
            {settings && (
              <p className="text-[10px] text-gray-400 mt-1">
                Interest model: {settings.interestModel === 'UPFRONT' ? 'Upfront (deducted from given amount)' : 'Add-on (added to repayable)'}
              </p>
            )}
          </div>

          {loanAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Repayable</span>
                <span className="font-bold text-gray-900">₹{totalRepayable.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount Given to Customer</span>
                <span className="font-semibold text-primary-700">₹{amountGiven.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Repayment Schedule */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Repayment Schedule</h2>

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

          {collectionType === 'WEEKLY' && (
            <div>
              <label className="label">Collection Day</label>
              <select className="input" value={collectionDay} onChange={(e) => setCollectionDay(e.target.value)}>
                <option value="">Select day</option>
                {days.map((d) => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Start Date *</label>
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>

          <div>
            <label className="label">Installment Amount (₹) *</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="input flex-1"
                value={installmentStr}
                onChange={(e) => setInstallmentStr(e.target.value)}
                min={1}
                required
              />
              <button type="button" onClick={autoCalcInstallments} className="text-xs text-primary-600 font-medium px-2 whitespace-nowrap">
                Calc #
              </button>
            </div>
          </div>

          <div>
            <label className="label">Number of Installments *</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="input flex-1"
                value={numInstallmentsStr}
                onChange={(e) => setNumInstallmentsStr(e.target.value)}
                min={1}
                required
              />
              <button type="button" onClick={autoCalcInstallmentAmount} className="text-xs text-primary-600 font-medium px-2 whitespace-nowrap">
                Calc ₹
              </button>
            </div>
          </div>

          {installmentAmount > 0 && numInstallments > 0 && totalRepayable > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Installment x Count</span>
                <span className="text-gray-900">₹{installmentAmount.toLocaleString('en-IN')} x {numInstallments}</span>
              </div>
              {lastInstallment !== installmentAmount && lastInstallment > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Installment</span>
                  <span className="text-gray-900">₹{lastInstallment.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span className="text-gray-700">Schedule Total</span>
                <span className={installmentAmount * (numInstallments - 1) + lastInstallment === totalRepayable ? 'text-success-600' : 'text-danger-600'}>
                  ₹{(installmentAmount * (numInstallments - 1) + lastInstallment).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Agent & Notes */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Additional</h2>

          {agents.length > 0 && (
            <div>
              <label className="label">Assigned Agent</label>
              <select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                <option value="">No agent (Owner collects)</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional loan notes" />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
