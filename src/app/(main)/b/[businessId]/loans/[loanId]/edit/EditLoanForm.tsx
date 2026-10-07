'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

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
  interestModel: string
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
interface BusinessSettings { collectionDays: string }

export default function EditLoanForm() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const businessId = params.businessId as string
  const loanId = params.loanId as string

  const [loan, setLoan] = useState<LoanData | null>(null)
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  const [loanAmountStr, setLoanAmountStr] = useState('')
  const [interestAmountStr, setInterestAmountStr] = useState('')
  const [interestModel, setInterestModel] = useState('ADDON')
  const [collectionType, setCollectionType] = useState('DAILY')
  const [collectionDay, setCollectionDay] = useState('')
  const [installmentStr, setInstallmentStr] = useState('')
  const [numInstallmentsStr, setNumInstallmentsStr] = useState('')
  const [startDate, setStartDate] = useState('')
  const [agentId, setAgentId] = useState('')
  const [notes, setNotes] = useState('')
  const [statusOverride, setStatusOverride] = useState<string | null>(null)
  const [originalStatusOverride, setOriginalStatusOverride] = useState<string | null>(null)

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
      if (Array.isArray(users)) setAgents(users)

      // Populate form — amounts stored in paise, show in rupees
      setLoanAmountStr(String(loanData.loanAmount / 100))
      setInterestAmountStr(String(loanData.interestAmount / 100))
      setInterestModel(loanData.interestModel || 'ADDON')
      setCollectionType(loanData.collectionType)
      setCollectionDay(loanData.collectionDay || '')
      setInstallmentStr(String(loanData.installmentAmount / 100))
      setNumInstallmentsStr(String(loanData.numberOfInstallments))
      setStartDate(loanData.startDate)
      setAgentId(loanData.agentId || '')
      setNotes(loanData.notes || '')
      setStatusOverride(loanData.statusOverride || null)
      setOriginalStatusOverride(loanData.statusOverride || null)
      setLoading(false)
    }).catch(() => { setError('Failed to load loan'); setLoading(false) })
  }, [businessId, loanId])

  const loanAmount = parseInt(loanAmountStr) || 0
  const interestAmount = parseInt(interestAmountStr) || 0
  const installmentAmount = parseInt(installmentStr) || 0
  const numInstallments = parseInt(numInstallmentsStr) || 0

  const totalRepayable = loanAmount + interestAmount
  const amountGiven = loanAmount
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
        interestModel,
        collectionType,
        installmentAmount: installmentAmount * 100,
        numberOfInstallments: numInstallments,
        startDate,
        agentId: agentId || null,
        notes: notes || null,
      }
      if (statusOverride !== originalStatusOverride) {
        body.statusOverride = statusOverride
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
        &larr; {t('common.back')}
      </Link>

      <h1 className="text-xl font-bold text-gray-900 mt-3 mb-1">{t('common.edit')} {t('loans.loan_short')}</h1>

      {/* Loan Number — read-only */}
      <div className="card p-3 bg-gray-50 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{t('loans.loan_number')}</p>
            <p className="text-sm font-bold text-gray-900 font-mono">{loan.loanNumber}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('customers.customer_name')}</p>
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
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('loans.loan_amount')}</h2>

          <div>
            <label className="label">{t('loans.interest_model')} *</label>
            <select
              className="input"
              value={interestModel}
              onChange={(e) => setInterestModel(e.target.value)}
            >
              <option value="ADDON">{t('loans.interest_model_added')}</option>
              <option value="UPFRONT">{t('loans.interest_model_upfront')}</option>
            </select>
          </div>

          <div>
            <label className="label">{t('loans.principal_amount_rs')} *</label>
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
            <label className="label">{t('loans.interest_amount_rs')} *</label>
            <input
              type="number"
              className="input"
              value={interestAmountStr}
              onChange={(e) => setInterestAmountStr(e.target.value)}
              min={0}
              required
            />
          </div>

          {loanAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('loans.total_repayable')}</span>
                <span className="font-bold text-gray-900">₹{totalRepayable.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('loans.amount_given')}</span>
                <span className="font-semibold text-primary-700">₹{amountGiven.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Repayment Schedule */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('loans.repayment_schedule')}</h2>

          <div>
            <label className="label">{t('loans.start_date')} *</label>
            <input type="date" className="input w-full min-w-0" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>

          <div>
            <label className="label">{t('loans.installment_rs')} *</label>
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
            <label className="label">{t('loans.num_installments')} *</label>
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
                <span className="text-gray-500">{t('loans.installment')} x {numInstallments}</span>
                <span className="text-gray-900">₹{installmentAmount.toLocaleString('en-IN')} x {numInstallments}</span>
              </div>
              {lastInstallment !== installmentAmount && lastInstallment > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('loans.last_installment')}</span>
                  <span className="text-gray-900">₹{lastInstallment.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span className="text-gray-700">{t('common.total')}</span>
                <span className={installmentAmount * (numInstallments - 1) + lastInstallment === totalRepayable ? 'text-success-600' : 'text-danger-600'}>
                  ₹{(installmentAmount * (numInstallments - 1) + lastInstallment).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Agent & Notes */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('customers.additional_details')}</h2>

          {agents.length > 0 && (
            <div>
              <label className="label">{t('loans.assigned_agent')}</label>
              <select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                <option value="">Not assigned</option>
                {agents.map((a) => {
                  const roleLabel = a.role === 'OWNER' ? 'Owner' : a.role === 'BUSINESS_ADMIN' ? 'Partner' : 'Agent'
                  return <option key={a.id} value={a.id}>{a.fullName} ({roleLabel})</option>
                })}
              </select>
            </div>
          )}

          <div>
            <label className="label">{t('common.notes')}</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div>
            <label className="label">{t('loans.loan_status')}</label>
            <select className="input" value={statusOverride || ''} onChange={(e) => setStatusOverride(e.target.value || null)}>
              <option value="">{t('loans.status_auto')}</option>
              <option value="ACTIVE">{t('loans.status_active')}</option>
              <option value="OVERDUE">{t('loans.status_overdue')}</option>
              <option value="DEFAULTER">{t('loans.status_defaulter')}</option>
              <option value="COMPLETED">{t('loans.status_completed')}</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">{t('loans.status_override_note')}</p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? `${t('common.loading')}` : t('common.save')}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
