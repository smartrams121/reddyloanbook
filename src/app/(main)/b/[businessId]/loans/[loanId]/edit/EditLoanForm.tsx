'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

interface Agent { id: string; fullName: string; role: string; villageAssignments?: { village: { id: string } }[] }
interface DocData { id: string; filePath: string; originalName: string; mimeType: string }
interface DocAttachment { id?: string; filePath: string; originalName: string; mimeType: string; previewUrl?: string }
interface LoanData {
  id: string; loanNumber: string; customerId: string
  customer: { id: string; fullName: string; customerId: string; phone: string; villageId: string | null }
  loanAmount: number; interestAmount: number; totalRepayable: number; amountGiven: number
  interestModel: string; collectionType: string; collectionDay: string | null
  installmentAmount: number; numberOfInstallments: number; lastInstallmentAmount: number
  startDate: string; expectedEndDate: string; agentId: string | null
  status: string; statusOverride: string | null; notes: string | null
  documents: DocData[]
}
interface BusinessSettings {
  collectionType: string; collectionDays: string
  repaymentMultiplierDailyWeekly: number; repaymentMultiplierMonthly: number
}

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

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

  const [loanDetailsOpen, setLoanDetailsOpen] = useState(false)
  const [agentId, setAgentId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [interestModel, setInterestModel] = useState('ADDON')
  const [principalStr, setPrincipalStr] = useState('')
  const [numInstallmentsStr, setNumInstallmentsStr] = useState('')
  const [totalRepaymentStr, setTotalRepaymentStr] = useState('')
  const [userEditedTotal, setUserEditedTotal] = useState(true)
  const [upfrontInterestStr, setUpfrontInterestStr] = useState('')
  const [weeklyInstallmentStr, setWeeklyInstallmentStr] = useState('')
  const [notes, setNotes] = useState('')
  const [statusOverride, setStatusOverride] = useState<string | null>(null)
  const [originalStatusOverride, setOriginalStatusOverride] = useState<string | null>(null)

  const [documents, setDocuments] = useState<DocAttachment[]>([])
  const [docUploading, setDocUploading] = useState(false)
  const docInputRef = useRef<HTMLInputElement>(null)

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

      setPrincipalStr(String(loanData.loanAmount / 100))
      setInterestModel(loanData.interestModel || 'ADDON')
      setStartDate(loanData.startDate)
      setAgentId(loanData.agentId || '')
      setNotes(loanData.notes || '')
      setStatusOverride(loanData.statusOverride || null)
      setOriginalStatusOverride(loanData.statusOverride || null)

      setTotalRepaymentStr(String(loanData.totalRepayable / 100))
      setUserEditedTotal(true)

      if (loanData.interestModel === 'UPFRONT') {
        setUpfrontInterestStr(String(loanData.interestAmount / 100))
      }

      if (loanData.collectionType === 'WEEKLY') {
        setWeeklyInstallmentStr(String(loanData.installmentAmount / 100))
      } else {
        setNumInstallmentsStr(String(loanData.numberOfInstallments))
      }

      if (loanData.documents?.length > 0) {
        setDocuments(loanData.documents.map((d: DocData) => ({
          id: d.id, filePath: d.filePath, originalName: d.originalName, mimeType: d.mimeType,
        })))
      }

      setLoading(false)
    }).catch(() => { setError('Failed to load loan'); setLoading(false) })
  }, [businessId, loanId])

  const collectionType = loan?.collectionType || settings?.collectionType || 'DAILY'
  const isWeekly = collectionType === 'WEEKLY'
  const isMonthly = collectionType === 'MONTHLY'
  const addonMultiplier = isMonthly
    ? (settings?.repaymentMultiplierMonthly ?? 1.40)
    : (settings?.repaymentMultiplierDailyWeekly ?? 1.20)

  const filteredAgents = loan
    ? agents.filter(a =>
        a.role === 'OWNER' || a.role === 'BUSINESS_ADMIN' ||
        (a.role === 'AGENT' && a.villageAssignments?.some(va => va.village.id === loan.customer.villageId))
      )
    : agents

  const principal = parseInt(principalStr) || 0
  const upfrontInterest = parseInt(upfrontInterestStr) || 0
  const totalRepayment = interestModel === 'UPFRONT'
    ? principal + upfrontInterest
    : (parseInt(totalRepaymentStr) || 0)
  const interest = interestModel === 'UPFRONT'
    ? upfrontInterest
    : (principal > 0 && totalRepayment > principal ? totalRepayment - principal : 0)
  const weeklyInstallment = parseInt(weeklyInstallmentStr) || 0
  const numInstallments = isWeekly
    ? (weeklyInstallment > 0 && totalRepayment > 0 ? Math.ceil(totalRepayment / weeklyInstallment) : 0)
    : (parseInt(numInstallmentsStr) || 0)
  const installmentAmount = isWeekly
    ? weeklyInstallment
    : (numInstallments > 0 && totalRepayment > 0 ? Math.floor(totalRepayment / numInstallments) : 0)
  const lastInstallment = numInstallments > 0
    ? totalRepayment - installmentAmount * (numInstallments - 1) : 0

  const computedDueDate = useMemo(() => {
    if (!startDate || numInstallments <= 0) return ''
    const d = new Date(startDate + 'T00:00:00')
    if (isNaN(d.getTime())) return ''

    if (collectionType === 'DAILY') {
      const DAY_CODE_TO_JS: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
      const activeDays = new Set((settings?.collectionDays || 'MON,TUE,WED,THU,FRI,SAT,SUN').split(',').map(c => DAY_CODE_TO_JS[c.trim()]).filter(v => v !== undefined))
      d.setDate(d.getDate() + 1)
      while (!activeDays.has(d.getDay())) d.setDate(d.getDate() + 1)
      let added = 1
      while (added < numInstallments) {
        d.setDate(d.getDate() + 1)
        if (activeDays.has(d.getDay())) added++
      }
    } else if (collectionType === 'WEEKLY') {
      d.setDate(d.getDate() + (numInstallments - 1) * 7)
    } else {
      d.setMonth(d.getMonth() + numInstallments - 1)
    }
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }, [startDate, numInstallments, settings, collectionType])

  function handlePrincipalChange(val: string) {
    setPrincipalStr(val)
    const p = parseInt(val) || 0
    if (interestModel === 'ADDON' && !userEditedTotal) {
      if (p >= 100) {
        setTotalRepaymentStr(String(Math.round(p * addonMultiplier)))
      } else {
        setTotalRepaymentStr('')
      }
    }
  }

  function handleInterestModelChange(model: string) {
    setInterestModel(model)
    setUserEditedTotal(false)
    setUpfrontInterestStr('')
    setWeeklyInstallmentStr('')
    if (model === 'ADDON' && principal >= 100) {
      setTotalRepaymentStr(String(Math.round(principal * addonMultiplier)))
    } else {
      setTotalRepaymentStr('')
    }
  }

  function handleTotalRepaymentChange(val: string) {
    setTotalRepaymentStr(val)
    setUserEditedTotal(true)
  }

  async function handleDocUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    const remaining = 10 - documents.length
    if (remaining <= 0) { setError('Maximum 10 attachments allowed'); return }
    const toUpload = Array.from(files).slice(0, remaining)

    setDocUploading(true)
    setError('')
    const newDocs: DocAttachment[] = []

    for (const file of toUpload) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch(`/api/b/${businessId}/upload?type=document`, { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) { setError(data.error || `Failed to upload ${file.name}`); continue }
        newDocs.push({
          filePath: data.filePath, originalName: data.originalName, mimeType: data.mimeType,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        })
      } catch { setError(`Failed to upload ${file.name}`) }
    }

    setDocuments(prev => [...prev, ...newDocs])
    setDocUploading(false)
    if (docInputRef.current) docInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (principal < 100) { setError('Principal must be at least ₹100'); return }
    if (interestModel === 'UPFRONT' && upfrontInterest <= 0) { setError('Interest amount must be positive for Upfront'); return }
    if (totalRepayment <= 0) { setError('Total repayment must be positive'); return }
    if (totalRepayment < principal) { setError('Total repayment cannot be less than principal'); return }
    if (numInstallments <= 0) { setError('Number of installments must be positive'); return }
    if (installmentAmount <= 0) { setError('Installment amount must be positive'); return }
    if (lastInstallment <= 0) { setError('Last installment would be zero or negative. Adjust amounts.'); return }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        loanAmount: principal * 100,
        interestAmount: interest * 100,
        interestModel,
        collectionType,
        installmentAmount: installmentAmount * 100,
        numberOfInstallments: numInstallments,
        startDate,
        agentId: agentId || null,
        notes: notes || null,
      }
      if (collectionType === 'WEEKLY' && loan?.collectionDay) body.collectionDay = loan.collectionDay
      else body.collectionDay = null

      if (statusOverride !== originalStatusOverride) {
        body.statusOverride = statusOverride
      }

      if (documents.length > 0) {
        body.documents = documents.map(d => ({ filePath: d.filePath, originalName: d.originalName, mimeType: d.mimeType }))
      }

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

      <h1 className="text-xl font-bold text-gray-900 mt-3 mb-4">{t('common.edit')} {t('loans.loan_short')}</h1>

      {error && (
        <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Customer + Loan Number summary (read-only) */}
        <div className="card p-3 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
              {loan.customer.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{loan.customer.fullName}</p>
              <p className="text-xs text-gray-500">{loan.customer.customerId} · {loan.loanNumber}</p>
            </div>
          </div>
        </div>

        {/* Loan Details — collapsed by default */}
        <div className="card">
          <button type="button" onClick={() => setLoanDetailsOpen(!loanDetailsOpen)} className="w-full p-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('loans.loan_details')}</h2>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                collectionType === 'DAILY' ? 'bg-blue-100 text-blue-700' :
                collectionType === 'WEEKLY' ? 'bg-purple-100 text-purple-700' :
                'bg-orange-100 text-orange-700'
              }`}>
                {collectionType}
              </span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${loanDetailsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </button>
          {loanDetailsOpen && <div className="px-4 pb-4 space-y-4">

          {/* Agent */}
          <div>
            <label className="label">{t('loans.agent')} *</label>
            {filteredAgents.length > 0 ? (
              <select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                {filteredAgents.map((a) => {
                  const roleLabel = a.role === 'OWNER' ? 'Owner' : a.role === 'BUSINESS_ADMIN' ? 'Partner' : 'Agent'
                  return <option key={a.id} value={a.id}>{a.fullName} ({roleLabel})</option>
                })}
              </select>
            ) : (
              <p className="text-sm text-gray-400 py-2">No team members available.</p>
            )}
          </div>

          {/* Loan Creation Date */}
          <div>
            <label className="label">{t('loans.loan_creation_date') || t('loans.start_date')} *</label>
            <input type="date" className="input w-full min-w-0" value={startDate} onChange={(e) => setStartDate(e.target.value)} max={todayISO()} required />
          </div>

          {/* Interest Model */}
          <div>
            <label className="label">{t('loans.interest_model')} *</label>
            <select className="input" value={interestModel} onChange={(e) => handleInterestModelChange(e.target.value)}>
              <option value="ADDON">{t('loans.interest_model_added')}</option>
              <option value="UPFRONT">{t('loans.interest_model_upfront')}</option>
            </select>
          </div>

          <div>
            <label className="label">{t('common.notes')}</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* Attachments */}
          <div>
            <label className="label">{t('loans.attachments') || 'Attachments'}</label>
            <input
              ref={docInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleDocUpload(e.target.files)}
            />
            <div className="flex gap-2 mb-3">
              <button type="button" disabled={docUploading || documents.length >= 10}
                onClick={() => { if (docInputRef.current) { docInputRef.current.removeAttribute('capture'); docInputRef.current.click() } }}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {docUploading ? 'Uploading...' : 'Add Files'}
              </button>
              <button type="button" disabled={docUploading || documents.length >= 10}
                onClick={() => { if (docInputRef.current) { docInputRef.current.setAttribute('capture', 'environment'); docInputRef.current.click() } }}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Camera
              </button>
              <span className="text-[10px] text-gray-400 self-center">{documents.length}/10</span>
            </div>

            {documents.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {documents.map((doc, idx) => (
                  <div key={idx} className="relative group rounded-lg border border-gray-200 overflow-hidden">
                    {doc.previewUrl || doc.mimeType.startsWith('image/') ? (
                      <img src={doc.previewUrl || doc.filePath} alt={doc.originalName} className="w-full h-20 object-cover" />
                    ) : (
                      <div className="w-full h-20 bg-gray-50 flex flex-col items-center justify-center">
                        <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                        </svg>
                        <span className="text-[9px] text-gray-500 mt-0.5 px-1 truncate max-w-full">PDF</span>
                      </div>
                    )}
                    <button type="button" onClick={() => setDocuments(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs opacity-80 hover:opacity-100"
                    >
                      ×
                    </button>
                    <p className="text-[9px] text-gray-500 px-1 py-0.5 truncate">{doc.originalName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Loan Status Override */}
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
          </div>}
        </div>

        {/* Loan Amount */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('loans.loan_amount')}</h2>

          {/* Principal Amount */}
          <div>
            <label className="label">{t('loans.principal_amount_rs')} *</label>
            <input
              type="number"
              className="input text-lg font-semibold"
              value={principalStr}
              onChange={(e) => handlePrincipalChange(e.target.value)}
              placeholder="0"
              min={100}
              required
            />
            <p className="text-[10px] text-gray-400 mt-1">
              {interestModel === 'UPFRONT' ? 'Amount given to customer' : 'Minimum ₹100'}
            </p>
          </div>

          {/* Interest Amount — only for UPFRONT */}
          {interestModel === 'UPFRONT' && (
            <div>
              <label className="label">{t('loans.interest_amount_rs')} *</label>
              <input
                type="number"
                className="input"
                value={upfrontInterestStr}
                onChange={(e) => setUpfrontInterestStr(e.target.value)}
                placeholder="0"
                min={0}
                required
              />
              <p className="text-[10px] text-gray-400 mt-1">Interest deducted upfront from the loan</p>
            </div>
          )}

          {/* WEEKLY: Installment Amount input / DAILY+MONTHLY: Number of Installments input */}
          {isWeekly ? (
            <div>
              <label className="label">{t('loans.installment_rs')} *</label>
              <input
                type="number"
                className="input"
                value={weeklyInstallmentStr}
                onChange={(e) => setWeeklyInstallmentStr(e.target.value)}
                placeholder="0"
                min={1}
                required
              />
              <p className="text-[10px] text-gray-400 mt-1">Amount collected each week</p>
            </div>
          ) : (
            <div>
              <label className="label">{t('loans.num_installments')} *</label>
              <input
                type="number"
                className="input"
                value={numInstallmentsStr}
                onChange={(e) => setNumInstallmentsStr(e.target.value)}
                placeholder="0"
                min={1}
                required
              />
              <div className="flex gap-2 flex-wrap mt-2">
                {(isMonthly ? [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [90, 100, 120, 150]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumInstallmentsStr(String(n))}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Total Repayment Amount — only for ADDON */}
          {interestModel === 'ADDON' && (
            <div>
              <label className="label">{t('loans.total_repayment_amount_rs') || 'Total Repayment Amount (Rs)'} *</label>
              <input
                type="number"
                className="input text-lg font-semibold"
                value={totalRepaymentStr}
                onChange={(e) => handleTotalRepaymentChange(e.target.value)}
                placeholder="0"
                min={1}
                required
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {userEditedTotal ? 'Manually set' : `Auto-calculated: Principal × ${addonMultiplier.toFixed(2)} (editable)`}
              </p>
            </div>
          )}

          {/* Auto-Calculated Summary */}
          {principal >= 100 && totalRepayment > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-0">
              <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-2">Auto-Calculated</p>
              {interestModel === 'ADDON' && (
                <div className="flex justify-between py-1.5 border-b border-green-200">
                  <span className="text-sm text-green-700">{t('loans.interest_amount')}</span>
                  <span className="text-sm font-bold text-green-800">₹{interest.toLocaleString('en-IN')}</span>
                </div>
              )}
              {interestModel === 'UPFRONT' && (
                <div className="flex justify-between py-1.5 border-b border-green-200">
                  <span className="text-sm text-green-700">{t('loans.total_repayment_amount') || 'Total Repayment'}</span>
                  <span className="text-sm font-bold text-green-800">₹{totalRepayment.toLocaleString('en-IN')}</span>
                </div>
              )}
              {isWeekly ? (
                <div className="flex justify-between py-1.5 border-b border-green-200">
                  <span className="text-sm text-green-700">{t('loans.num_weeks') || 'Num Weeks'}</span>
                  <span className="text-sm font-bold text-green-800">
                    {numInstallments > 0 ? numInstallments : '—'}
                    {numInstallments > 0 && lastInstallment !== installmentAmount && lastInstallment > 0 && (
                      <span className="text-[10px] font-normal text-green-600 ml-1">(last: ₹{lastInstallment.toLocaleString('en-IN')})</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between py-1.5 border-b border-green-200">
                  <span className="text-sm text-green-700">{t('loans.installment')}</span>
                  <span className="text-sm font-bold text-green-800">
                    {numInstallments > 0 ? `₹${installmentAmount.toLocaleString('en-IN')}` : '₹0'}
                    {numInstallments > 0 && lastInstallment !== installmentAmount && lastInstallment > 0 && (
                      <span className="text-[10px] font-normal text-green-600 ml-1">(last: ₹{lastInstallment.toLocaleString('en-IN')})</span>
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1.5">
                <span className="text-sm text-green-700">{t('loans.due_date') || 'Due Date'}</span>
                <span className="text-sm font-bold text-green-800">{computedDueDate || '—'}</span>
              </div>
            </div>
          )}
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
