'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

interface Village { id: string; name: string }
interface Agent { id: string; fullName: string; role: string; villageAssignments?: { village: { id: string } }[] }
interface CustomerResult { id: string; customerId: string; fullName: string; phone: string; village: { id: string; name: string }; status: string }
interface BusinessSettings { collectionType: string; defaultCollectionDay: string | null; collectionDays: string; repaymentMultiplierDailyWeekly: number; repaymentMultiplierMonthly: number }
interface ActiveLoan { id: string; loanNumber: string; loanAmount: number; totalRepayable: number; status: string; startDate: string }
interface DocAttachment { filePath: string; originalName: string; mimeType: string; previewUrl?: string }

type Step = 'customer' | 'warning' | 'loan'

function formatPaiseShort(paise: number): string {
  const rupees = paise / 100
  if (rupees === Math.floor(rupees)) return `₹${Math.floor(rupees).toLocaleString('en-IN')}`
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function NewLoanPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const businessId = params.businessId as string
  const preselectedCustomerId = searchParams.get('customerId')
  const renewFromLoanId = searchParams.get('renewFromLoanId')

  const [step, setStep] = useState<Step>('customer')
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [villages, setVillages] = useState<Village[]>([])
  const [agents, setAgents] = useState<Agent[]>([])

  // Customer step
  const [customers, setCustomers] = useState<CustomerResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)

  // Active loan warning
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([])
  const [checkingLoans, setCheckingLoans] = useState(false)

  // New customer fields
  const [ncName, setNcName] = useState('')
  const [ncPhone, setNcPhone] = useState('')
  const [ncVillageId, setNcVillageId] = useState('')
  const [ncAge, setNcAge] = useState('')
  const [ncAddress, setNcAddress] = useState('')
  const [ncGuarantorName, setNcGuarantorName] = useState('')
  const [ncGuarantorPhone, setNcGuarantorPhone] = useState('')
  const [ncAltPhone, setNcAltPhone] = useState('')
  const [ncAadhaar, setNcAadhaar] = useState('')
  const [ncJobType, setNcJobType] = useState('')
  const [ncCustomJobType, setNcCustomJobType] = useState('')
  const [ncShowNewJobType, setNcShowNewJobType] = useState(false)
  const [ncJobTypes, setNcJobTypes] = useState<string[]>(['Shop', 'Business', 'Farmer', 'Labour', 'Driver', 'Others'])
  const [ncNotes, setNcNotes] = useState('')
  const [ncPhotoPath, setNcPhotoPath] = useState('')
  const [ncPhotoPreview, setNcPhotoPreview] = useState('')
  const [ncUploading, setNcUploading] = useState(false)
  const ncFileInputRef = useRef<HTMLInputElement>(null)
  const [ncCreating, setNcCreating] = useState(false)

  // Loan step — redesigned
  const [agentId, setAgentId] = useState('')
  const [loanNumber, setLoanNumber] = useState('')
  const [loanIdStatus, setLoanIdStatus] = useState<'loading' | 'available' | 'taken' | ''>('')
  const [loanIdSuggestion, setLoanIdSuggestion] = useState('')
  const [loanDetailsOpen, setLoanDetailsOpen] = useState(false)
  const [startDate, setStartDate] = useState(todayISO)
  const [principalStr, setPrincipalStr] = useState('')
  const [numInstallmentsStr, setNumInstallmentsStr] = useState('')
  const [totalRepaymentStr, setTotalRepaymentStr] = useState('')
  const [userEditedTotal, setUserEditedTotal] = useState(false)
  const [interestModel, setInterestModel] = useState('ADDON')
  const [upfrontInterestStr, setUpfrontInterestStr] = useState('')
  const [weeklyInstallmentStr, setWeeklyInstallmentStr] = useState('')
  const [notes, setNotes] = useState('')

  // Document attachments
  const [documents, setDocuments] = useState<DocAttachment[]>([])
  const [docUploading, setDocUploading] = useState(false)
  const docInputRef = useRef<HTMLInputElement>(null)

  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  // Filter agents by selected customer's village
  const filteredAgents = selectedCustomer
    ? agents.filter(a =>
        !a.villageAssignments || a.villageAssignments.length === 0 ||
        a.villageAssignments.some(va => va.village.id === selectedCustomer.village.id)
      )
    : agents

  // Computed loan values
  const collectionType = settings?.collectionType || 'DAILY'
  const isWeekly = collectionType === 'WEEKLY'
  const isMonthly = collectionType === 'MONTHLY'
  const addonMultiplier = isMonthly
    ? (settings?.repaymentMultiplierMonthly ?? 1.40)
    : (settings?.repaymentMultiplierDailyWeekly ?? 1.20)
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
    const ct = settings?.collectionType || 'DAILY'

    if (ct === 'DAILY') {
      const DAY_CODE_TO_JS: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
      const activeDays = new Set((settings?.collectionDays || 'MON,TUE,WED,THU,FRI,SAT,SUN').split(',').map(c => DAY_CODE_TO_JS[c.trim()]).filter(v => v !== undefined))
      d.setDate(d.getDate() + 1)
      while (!activeDays.has(d.getDay())) d.setDate(d.getDate() + 1)
      let added = 1
      while (added < numInstallments) {
        d.setDate(d.getDate() + 1)
        if (activeDays.has(d.getDay())) added++
      }
    } else if (ct === 'WEEKLY') {
      d.setDate(d.getDate() + (numInstallments - 1) * 7)
    } else {
      d.setMonth(d.getMonth() + numInstallments - 1)
    }
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }, [startDate, numInstallments, settings])

  useEffect(() => {
    fetch(`/api/b/${businessId}/loans/next-id`)
      .then(r => r.json())
      .then(data => { if (data.nextId) setLoanNumber(data.nextId) })
      .catch(() => {})

    Promise.all([
      fetch(`/api/b/${businessId}/settings`).then(r => r.json()),
      fetch(`/api/b/${businessId}/villages`).then(r => r.json()),
      fetch(`/api/b/${businessId}/users`).then(r => r.json()),
      fetch(`/api/b/${businessId}/customers`).then(r => r.json()),
    ]).then(([biz, vils, users, custs]) => {
      setSettings(biz)
      if (Array.isArray(vils)) setVillages(vils)
      if (Array.isArray(users)) {
        const agentList = users.filter((u: Agent) => u.role === 'AGENT')
        setAgents(agentList)
        if (agentList.length > 0 && !agentId) setAgentId(agentList[0].id)
      }
      if (Array.isArray(custs)) {
        setCustomers(custs)
        const defaultJobs = ['Shop', 'Business', 'Farmer', 'Labour', 'Driver', 'Others']
        const existing = new Set(defaultJobs)
        custs.forEach((c: { jobType?: string }) => { if (c.jobType && !existing.has(c.jobType)) existing.add(c.jobType) })
        setNcJobTypes(Array.from(existing))
        if (preselectedCustomerId) {
          const found = custs.find((c: CustomerResult) => c.id === preselectedCustomerId)
          if (found) selectCustomer(found)
        }
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, preselectedCustomerId])

  async function selectCustomer(customer: CustomerResult) {
    setSelectedCustomer(customer)
    // Auto-select first agent matching customer's village
    const matching = agents.filter(a =>
      !a.villageAssignments || a.villageAssignments.length === 0 ||
      a.villageAssignments.some(va => va.village.id === customer.village.id)
    )
    if (matching.length > 0) setAgentId(matching[0].id)
    else setAgentId('')
    setCheckingLoans(true)
    try {
      const res = await fetch(`/api/b/${businessId}/loans?customerId=${customer.id}`)
      const loans = await res.json()
      const active = Array.isArray(loans)
        ? loans.filter((l: ActiveLoan) => l.status !== 'COMPLETED' && l.status !== 'DEFAULTER')
        : []
      setActiveLoans(active)
      if (active.length > 0) {
        setStep('warning')
      } else {
        setStep('loan')
      }
    } catch {
      setStep('loan')
    } finally {
      setCheckingLoans(false)
    }
  }

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers
    const q = searchQuery.toLowerCase()
    return customers.filter(c =>
      c.fullName.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.customerId.toLowerCase().includes(q)
    )
  }, [customers, searchQuery])

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

  async function checkLoanId(id: string) {
    if (!id.trim()) return
    setLoanIdStatus('loading')
    try {
      const res = await fetch(`/api/b/${businessId}/loans/check-id?id=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (data.available) {
        setLoanIdStatus('available')
        setLoanIdSuggestion('')
      } else {
        setLoanIdStatus('taken')
        setLoanIdSuggestion(data.nextAvailable || '')
      }
    } catch { setLoanIdStatus('') }
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

  async function handleNcPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setNcPhotoPreview(URL.createObjectURL(file))
    setNcUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/b/${businessId}/upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Photo upload failed'); setNcPhotoPreview(''); return }
      setNcPhotoPath(data.photoPath)
    } catch { setError('Photo upload failed'); setNcPhotoPreview('') }
    finally { setNcUploading(false) }
  }

  function handleNcJobTypeChange(value: string) {
    if (value === '__new__') { setNcShowNewJobType(true); setNcJobType('') }
    else { setNcShowNewJobType(false); setNcCustomJobType(''); setNcJobType(value) }
  }

  function addNcCustomJobType() {
    const name = ncCustomJobType.trim()
    if (!name) return
    if (!ncJobTypes.includes(name)) setNcJobTypes(prev => [...prev, name])
    setNcJobType(name); setNcCustomJobType(''); setNcShowNewJobType(false)
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNcCreating(true)
    try {
      const body: Record<string, unknown> = { fullName: ncName, phone: ncPhone, villageId: ncVillageId }
      if (ncAge) body.age = parseInt(ncAge)
      if (ncAltPhone) body.altPhone = ncAltPhone
      if (ncAddress) body.address = ncAddress
      if (ncAadhaar) body.aadhaar = ncAadhaar
      if (ncJobType) body.jobType = ncJobType
      if (ncGuarantorName) body.guarantorName = ncGuarantorName
      if (ncGuarantorPhone) body.guarantorPhone = ncGuarantorPhone
      if (ncNotes) body.notes = ncNotes
      if (ncPhotoPath) body.photoPath = ncPhotoPath

      const res = await fetch(`/api/b/${businessId}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create customer')
        return
      }
      const custsRes = await fetch(`/api/b/${businessId}/customers`)
      const custs = await custsRes.json()
      if (Array.isArray(custs)) {
        setCustomers(custs)
        const newCust = custs.find((c: CustomerResult) => c.id === data.id)
        if (newCust) {
          setShowNewCustomer(false)
          selectCustomer(newCust)
        }
      }
    } catch {
      setError('Network error')
    } finally {
      setNcCreating(false)
    }
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
          filePath: data.filePath,
          originalName: data.originalName,
          mimeType: data.mimeType,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        })
      } catch {
        setError(`Failed to upload ${file.name}`)
      }
    }

    setDocuments(prev => [...prev, ...newDocs])
    setDocUploading(false)
    if (docInputRef.current) docInputRef.current.value = ''
  }

  async function handleCreateLoan(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!selectedCustomer) { setError('Select a customer first'); return }
    if (principal < 100) { setError('Principal must be at least ₹100'); return }
    if (interestModel === 'UPFRONT' && upfrontInterest <= 0) { setError('Interest amount must be positive for Upfront'); return }
    if (totalRepayment <= 0) { setError('Total repayment must be positive'); return }
    if (totalRepayment < principal) { setError('Total repayment cannot be less than principal'); return }
    if (numInstallments <= 0) { setError('Number of installments must be positive'); return }
    if (installmentAmount <= 0) { setError('Installment amount must be positive'); return }
    if (lastInstallment <= 0) { setError('Last installment would be zero or negative. Adjust amounts.'); return }

    setCreating(true)
    try {
      const ct = settings?.collectionType || 'DAILY'
      const body: Record<string, unknown> = {
        customerId: selectedCustomer.id,
        loanNumber: loanNumber || undefined,
        loanAmount: principal * 100,
        interestAmount: interest * 100,
        interestModel,
        collectionType: ct,
        installmentAmount: installmentAmount * 100,
        numberOfInstallments: numInstallments,
        startDate,
      }
      if (ct === 'WEEKLY' && settings?.defaultCollectionDay) {
        body.collectionDay = settings.defaultCollectionDay
      }
      if (agentId) body.agentId = agentId
      if (notes) body.notes = notes
      if (renewFromLoanId) body.renewFromLoanId = renewFromLoanId
      if (documents.length > 0) {
        body.documents = documents.map(d => ({ filePath: d.filePath, originalName: d.originalName, mimeType: d.mimeType }))
      }

      const res = await fetch(`/api/b/${businessId}/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.details) {
          setError(Object.values(data.details).flat().join(', '))
        } else {
          setError(data.error || 'Failed to create loan')
        }
        return
      }
      router.push(`/b/${businessId}/customers/${selectedCustomer.id}`)
    } catch {
      setError('Network error')
    } finally {
      setCreating(false)
    }
  }

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    OVERDUE: 'bg-red-100 text-red-700',
    DEFAULTER: 'bg-red-50 text-red-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">{t('loans.new_loan')}</h1>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setStep('customer')}
          className={`text-sm font-medium px-3 py-1 rounded-full ${step === 'customer' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          1. Customer
        </button>
        <div className="w-6 h-px bg-gray-300" />
        <button
          onClick={() => selectedCustomer && (activeLoans.length > 0 ? setStep('warning') : setStep('loan'))}
          className={`text-sm font-medium px-3 py-1 rounded-full ${step === 'loan' || step === 'warning' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'} ${!selectedCustomer ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!selectedCustomer}
        >
          2. {t('loans.loan_details')}
        </button>
      </div>

      {error && (
        <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {checkingLoans && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      )}

      {/* ─── STEP 1: Select or Create Customer ─── */}
      {step === 'customer' && !checkingLoans && (
        <div className="space-y-4">
          {selectedCustomer && !showNewCustomer && (
            <div className="card p-3 border-primary-300 bg-primary-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-200 text-primary-700 flex items-center justify-center text-sm font-bold">
                    {selectedCustomer.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedCustomer.fullName}</p>
                    <p className="text-xs text-gray-500">{selectedCustomer.customerId} &middot; {selectedCustomer.phone} &middot; {selectedCustomer.village.name}</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedCustomer(null); setActiveLoans([]); setSearchQuery('') }} className="text-xs text-gray-500">Change</button>
              </div>
              <button onClick={() => selectCustomer(selectedCustomer)} className="btn-primary w-full mt-3 text-sm">
                Continue to Loan Details &rarr;
              </button>
            </div>
          )}

          {!selectedCustomer && !showNewCustomer && (
            <>
              <div>
                <label className="label">Search Existing Customer</label>
                <input
                  className="input"
                  placeholder="Name, phone, or customer ID"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1 max-h-60 overflow-y-auto">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left card p-3 flex items-center gap-3 hover:border-primary-300 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {c.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.fullName}</p>
                      <p className="text-xs text-gray-500">{c.customerId} &middot; {c.phone} &middot; {c.village.name}</p>
                    </div>
                  </button>
                ))}
                {filteredCustomers.length === 0 && searchQuery && (
                  <p className="text-sm text-gray-400 text-center py-4">No matching customers found</p>
                )}
              </div>

              <div className="text-center pt-2">
                <button onClick={() => setShowNewCustomer(true)} className="text-sm text-primary-600 font-medium">
                  + Create New Customer
                </button>
              </div>
            </>
          )}

          {showNewCustomer && (
            <form onSubmit={handleCreateCustomer} className="card p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-900">New Customer</h3>
                <button type="button" onClick={() => setShowNewCustomer(false)} className="text-xs text-gray-500">Cancel</button>
              </div>

              <div>
                <label className="label">Photo</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden shrink-0">
                    {ncPhotoPreview ? (
                      <img src={ncPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                      </svg>
                    )}
                  </div>
                  <input ref={ncFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleNcPhotoSelect} />
                  <div className="flex gap-2">
                    <button type="button" disabled={ncUploading} onClick={() => { if (ncFileInputRef.current) { ncFileInputRef.current.removeAttribute('capture'); ncFileInputRef.current.click() } }} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                      {ncUploading ? 'Uploading...' : 'Gallery'}
                    </button>
                    <button type="button" disabled={ncUploading} onClick={() => { if (ncFileInputRef.current) { ncFileInputRef.current.setAttribute('capture', 'environment'); ncFileInputRef.current.click() } }} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                      Camera
                    </button>
                    {ncPhotoPreview && (
                      <button type="button" onClick={() => { setNcPhotoPath(''); setNcPhotoPreview(''); if (ncFileInputRef.current) ncFileInputRef.current.value = '' }} className="text-xs px-3 py-1.5 rounded-lg bg-danger-50 text-danger-600 hover:bg-danger-100 transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Full Name *</label>
                <input className="input" value={ncName} onChange={(e) => setNcName(e.target.value)} required />
              </div>
              <div>
                <label className="label">Phone *</label>
                <input className="input" value={ncPhone} onChange={(e) => setNcPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" required />
              </div>
              <div>
                <label className="label">Location *</label>
                <select className="input" value={ncVillageId} onChange={(e) => setNcVillageId(e.target.value)} required>
                  <option value="">Select location</option>
                  {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Age</label>
                  <input type="number" className="input" value={ncAge} onChange={(e) => setNcAge(e.target.value)} min={18} max={100} />
                </div>
                <div>
                  <label className="label">Alt Phone</label>
                  <input className="input" value={ncAltPhone} onChange={(e) => setNcAltPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                </div>
              </div>

              <div>
                <label className="label">Job Type</label>
                {!ncShowNewJobType ? (
                  <select className="input" value={ncJobType} onChange={(e) => handleNcJobTypeChange(e.target.value)}>
                    <option value="">Select job type</option>
                    {ncJobTypes.map((jt) => <option key={jt} value={jt}>{jt}</option>)}
                    <option value="__new__">+ Add New Job Type</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input className="input flex-1" value={ncCustomJobType} onChange={(e) => setNcCustomJobType(e.target.value)} placeholder="Enter new job type" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNcCustomJobType() } }} />
                    <button type="button" onClick={addNcCustomJobType} disabled={!ncCustomJobType.trim()} className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 whitespace-nowrap">Add</button>
                    <button type="button" onClick={() => { setNcShowNewJobType(false); setNcCustomJobType('') }} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Address</label>
                <textarea className="input" rows={2} value={ncAddress} onChange={(e) => setNcAddress(e.target.value)} />
              </div>
              <div>
                <label className="label">Aadhaar Number</label>
                <input className="input" value={ncAadhaar} onChange={(e) => setNcAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="12 digits (stored securely)" maxLength={12} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Guarantor Name</label>
                  <input className="input" value={ncGuarantorName} onChange={(e) => setNcGuarantorName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Guarantor Phone</label>
                  <input className="input" value={ncGuarantorPhone} onChange={(e) => setNcGuarantorPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={ncNotes} onChange={(e) => setNcNotes(e.target.value)} />
              </div>
              <button type="submit" disabled={ncCreating} className="btn-primary w-full text-sm">
                {ncCreating ? 'Creating...' : 'Create Customer & Continue'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ─── ACTIVE LOAN WARNING ─── */}
      {step === 'warning' && selectedCustomer && (
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <h3 className="text-sm font-bold text-yellow-800">{t('loans.active_loan_warning')}</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  <span className="font-semibold">{selectedCustomer.fullName}</span> already has {activeLoans.length} active loan{activeLoans.length > 1 ? 's' : ''}. Please choose how to proceed.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {activeLoans.map((loan) => {
              const parts = loan.startDate.split('-')
              const dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : loan.startDate
              return (
                <div key={loan.id} className="card p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{loan.loanNumber}</p>
                    <p className="text-xs text-gray-500">Started {dateStr}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatPaiseShort(loan.totalRepayable)}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[loan.status] || 'bg-gray-100 text-gray-600'}`}>
                      {loan.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => setStep('loan')}
              className="w-full text-left card p-4 hover:border-primary-300 transition-colors flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Proceed with New Loan</p>
                <p className="text-xs text-gray-500">Create another loan for this customer alongside the existing one</p>
              </div>
            </button>

            <button
              onClick={() => router.back()}
              className="w-full text-left card p-4 hover:border-danger-300 transition-colors flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Cancel Loan Application</p>
                <p className="text-xs text-gray-500">Go back without creating a new loan</p>
              </div>
            </button>

            {activeLoans.length === 1 ? (
              <Link
                href={`/b/${businessId}/loans/${activeLoans[0].id}/edit`}
                className="w-full text-left card p-4 hover:border-blue-300 transition-colors flex items-center gap-3 block"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Edit Existing Loan ({activeLoans[0].loanNumber})</p>
                  <p className="text-xs text-gray-500">Modify the current active loan instead of creating a new one</p>
                </div>
              </Link>
            ) : (
              <div className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Edit an Existing Loan</p>
                    <p className="text-xs text-gray-500">Select which loan to edit</p>
                  </div>
                </div>
                <div className="space-y-1 pl-13">
                  {activeLoans.map((loan) => (
                    <Link
                      key={loan.id}
                      href={`/b/${businessId}/loans/${loan.id}/edit`}
                      className="block text-sm text-primary-600 font-medium hover:underline py-1"
                    >
                      {loan.loanNumber} — {formatPaiseShort(loan.totalRepayable)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="text-center pt-2">
            <button
              onClick={() => { setSelectedCustomer(null); setActiveLoans([]); setSearchQuery(''); setStep('customer') }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              &larr; Select a Different Customer
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Loan Details (Redesigned) ─── */}
      {step === 'loan' && selectedCustomer && (
        <form onSubmit={handleCreateLoan} className="space-y-5">
          {/* Customer summary */}
          <div className="card p-3 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                {selectedCustomer.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{selectedCustomer.fullName}</p>
                <p className="text-xs text-gray-500">{selectedCustomer.customerId} &middot; {selectedCustomer.village.name}</p>
              </div>
              <button type="button" onClick={() => { setStep('customer'); setActiveLoans([]) }} className="ml-auto text-xs text-primary-600">Change</button>
            </div>
          </div>

          {activeLoans.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
              Note: This customer has {activeLoans.length} existing active loan{activeLoans.length > 1 ? 's' : ''}.
            </div>
          )}

          {renewFromLoanId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              Renewing from existing loan. The old loan will be marked as completed.
            </div>
          )}

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

            {/* Loan ID */}
            <div>
              <label className="label">{t('loans.loan_id')}</label>
              <input
                className="input"
                value={loanNumber}
                onChange={(e) => setLoanNumber(e.target.value)}
                onBlur={() => checkLoanId(loanNumber)}
              />
              {loanIdStatus === 'available' && <p className="text-[10px] text-green-600 mt-1">✓ Available</p>}
              {loanIdStatus === 'taken' && (
                <p className="text-[10px] text-red-600 mt-1">
                  ID already assigned.{loanIdSuggestion && (
                    <> Next available: <button type="button" onClick={() => { setLoanNumber(loanIdSuggestion); setLoanIdStatus('available') }} className="text-primary-600 underline">{loanIdSuggestion}</button></>
                  )}
                </p>
              )}
              {loanIdStatus === 'loading' && <p className="text-[10px] text-gray-400 mt-1">Checking...</p>}
            </div>

            {/* Agent */}
            <div>
              <label className="label">{t('loans.agent')} *</label>
              {filteredAgents.length > 0 ? (
                <select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  {filteredAgents.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
                </select>
              ) : (
                <p className="text-sm text-gray-400 py-2">{agents.length > 0 ? 'No agents assigned to this location.' : 'No agents assigned. Add agents from the Team page.'}</p>
              )}
            </div>

            {/* Loan Creation Date */}
            <div>
              <label className="label">{t('loans.loan_creation_date')} *</label>
              <input
                type="date"
                className="input w-full min-w-0 text-xs py-1.5"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={todayISO()}
                required
              />
            </div>

            {/* Interest Model */}
            <div>
              <label className="label">{t('loans.interest_model')} *</label>
              <select
                className="input"
                value={interestModel}
                onChange={(e) => handleInterestModelChange(e.target.value)}
              >
                <option value="ADDON">{t('loans.interest_model_added')}</option>
                <option value="UPFRONT">{t('loans.interest_model_upfront')}</option>
              </select>
            </div>

            <div>
              <label className="label">{t('common.notes')}</label>
              <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div>
              <label className="label">{t('loans.attachments')}</label>
              <input
                ref={docInputRef}
                type="file"
                accept="image/*,.pdf,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleDocUpload(e.target.files)}
              />
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  disabled={docUploading || documents.length >= 10}
                  onClick={() => { if (docInputRef.current) { docInputRef.current.removeAttribute('capture'); docInputRef.current.click() } }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {docUploading ? 'Uploading...' : 'Add Files'}
                </button>
                <button
                  type="button"
                  disabled={docUploading || documents.length >= 10}
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
                      {doc.previewUrl ? (
                        <img src={doc.previewUrl} alt={doc.originalName} className="w-full h-20 object-cover" />
                      ) : (
                        <div className="w-full h-20 bg-gray-50 flex flex-col items-center justify-center">
                          <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                          </svg>
                          <span className="text-[9px] text-gray-500 mt-0.5 px-1 truncate max-w-full">PDF</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setDocuments(prev => prev.filter((_, i) => i !== idx))}
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
            </div>}
          </div>

          {/* Loan Payment */}
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
                <label className="label">{t('loans.total_repayment_amount_rs')} *</label>
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
                    <span className="text-sm text-green-700">{t('loans.total_repayment_amount')}</span>
                    <span className="text-sm font-bold text-green-800">₹{totalRepayment.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {isWeekly ? (
                  <div className="flex justify-between py-1.5 border-b border-green-200">
                    <span className="text-sm text-green-700">{t('loans.num_weeks')}</span>
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
                  <span className="text-sm text-green-700">{t('loans.due_date')}</span>
                  <span className="text-sm font-bold text-green-800">{computedDueDate || '—'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button type="submit" disabled={creating} className="btn-primary flex-1">
              {creating ? `${t('common.loading')}` : t('loans.new_loan_btn')}
            </button>
            <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
