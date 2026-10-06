'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ContactUs {
  phone: string
  email: string
  address: string
  notes: string
}

interface FaqItem {
  question: string
  answer: string
}

export default function PlatformSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'banner' | 'contact' | 'faq'>('banner')
  const [message, setMessage] = useState('')

  const [bannerText, setBannerText] = useState('')
  const [contact, setContact] = useState<ContactUs>({ phone: '', email: '', address: '', notes: '' })
  const [faqs, setFaqs] = useState<FaqItem[]>([])

  useEffect(() => {
    fetch('/api/auth/profile')
      .then((r) => r.json())
      .then((p) => {
        if (p.role !== 'PLATFORM_ADMIN') {
          router.replace('/dashboard')
          return
        }
        return fetch('/api/admin/platform-settings').then((r) => r.json())
      })
      .then((data) => {
        if (!data) return
        if (data.system_banner !== undefined) setBannerText(data.system_banner || '')
        if (data.contact_us) setContact(data.contact_us)
        if (data.faq) setFaqs(data.faq)
      })
      .finally(() => setLoading(false))
  }, [router])

  async function saveBanner() {
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/admin/platform-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'system_banner', value: bannerText.trim() }),
    })
    setSaving(false)
    if (res.ok) setMessage(bannerText.trim() ? 'Banner published' : 'Banner cleared')
    else setMessage('Failed to save')
  }

  async function saveContact() {
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/admin/platform-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'contact_us', value: contact }),
    })
    setSaving(false)
    if (res.ok) setMessage('Contact information saved')
    else setMessage('Failed to save')
  }

  async function saveFaqs() {
    setSaving(true)
    setMessage('')
    const filtered = faqs.filter((f) => f.question.trim() || f.answer.trim())
    const res = await fetch('/api/admin/platform-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'faq', value: filtered }),
    })
    setSaving(false)
    if (res.ok) {
      setFaqs(filtered.length > 0 ? filtered : [])
      setMessage('FAQ saved')
    } else {
      setMessage('Failed to save')
    }
  }

  function addFaq() {
    setFaqs([...faqs, { question: '', answer: '' }])
  }

  function removeFaq(index: number) {
    setFaqs(faqs.filter((_, i) => i !== index))
  }

  function updateFaq(index: number, field: 'question' | 'answer', value: string) {
    const updated = [...faqs]
    updated[index] = { ...updated[index], [field]: value }
    setFaqs(updated)
  }

  if (loading) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Platform Settings</h1>
      <p className="text-sm text-gray-500 mb-6">Manage Contact Us and FAQ content visible to all users</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => { setActiveTab('banner'); setMessage('') }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'banner' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Banner
        </button>
        <button
          onClick={() => { setActiveTab('contact'); setMessage('') }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'contact' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Contact Us
        </button>
        <button
          onClick={() => { setActiveTab('faq'); setMessage('') }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'faq' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          FAQ
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {message}
        </div>
      )}

      {/* Banner Tab */}
      {activeTab === 'banner' && (
        <div className="card p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System Banner Message</label>
            <textarea
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value)}
              className="input"
              rows={3}
              placeholder="e.g. Scheduled maintenance on 07/10/2026, 2AM-4AM IST. Service may be unavailable."
            />
            <p className="text-[10px] text-gray-400 mt-1">This message shows as a yellow banner at the top of every page for all owners and agents. Leave empty to hide the banner.</p>
          </div>
          {bannerText.trim() && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <p className="text-sm text-amber-800">Preview: {bannerText.trim()}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={saveBanner} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : bannerText.trim() ? 'Publish Banner' : 'Clear Banner'}
            </button>
          </div>
        </div>
      )}

      {/* Contact Us Tab */}
      {activeTab === 'contact' && (
        <div className="card p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              className="input"
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
              className="input"
              placeholder="support@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              value={contact.address}
              onChange={(e) => setContact({ ...contact, address: e.target.value })}
              className="input"
              rows={3}
              placeholder="Office address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
            <textarea
              value={contact.notes}
              onChange={(e) => setContact({ ...contact, notes: e.target.value })}
              className="input"
              rows={3}
              placeholder="Working hours, other contact methods, etc."
            />
          </div>
          <button onClick={saveContact} disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : 'Save Contact Information'}
          </button>
        </div>
      )}

      {/* FAQ Tab */}
      {activeTab === 'faq' && (
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-gray-400 mt-2">Q{i + 1}</span>
                <button
                  onClick={() => removeFaq(i)}
                  className="text-xs text-red-500 hover:text-red-700 shrink-0"
                >
                  Remove
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                <input
                  value={faq.question}
                  onChange={(e) => updateFaq(i, 'question', e.target.value)}
                  className="input"
                  placeholder="Enter question"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
                <textarea
                  value={faq.answer}
                  onChange={(e) => updateFaq(i, 'answer', e.target.value)}
                  className="input"
                  rows={3}
                  placeholder="Enter answer"
                />
              </div>
            </div>
          ))}
          <button
            onClick={addFaq}
            className="btn-secondary w-full"
          >
            + Add FAQ
          </button>
          {faqs.length > 0 && (
            <button onClick={saveFaqs} disabled={saving} className="btn-primary w-full">
              {saving ? 'Saving...' : 'Save FAQ'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
