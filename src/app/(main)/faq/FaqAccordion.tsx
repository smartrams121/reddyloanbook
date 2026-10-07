'use client'

import { useState } from 'react'

interface FaqGroup {
  key: string
  label: string
  items: { question: string; answer: string; category?: string }[]
}

interface Props {
  grouped: FaqGroup[]
}

export default function FaqAccordion({ grouped }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const allItems = grouped.flatMap(g => g.items.map((item, i) => ({ ...item, id: `${g.key}-${i}`, groupKey: g.key })))

  const filtered = search.trim()
    ? allItems.filter(f =>
        f.question.toLowerCase().includes(search.toLowerCase()) ||
        f.answer.toLowerCase().includes(search.toLowerCase())
      )
    : null

  return (
    <div>
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          className="input pl-9 text-sm"
          placeholder="Search FAQ..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpenId(null) }}
        />
      </div>

      {/* Data security note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
        <p className="text-xs text-blue-800">
          <span className="font-semibold">Note:</span> Data is stored on Oracle Cloud securely with high availability. However, we recommend taking regular backups to keep owners tension-free and always safe.
        </p>
      </div>

      {filtered ? (
        filtered.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-gray-400">No matching FAQs found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(faq => (
              <FaqItem key={faq.id} id={faq.id} question={faq.question} answer={faq.answer} openId={openId} setOpenId={setOpenId} />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.key}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{group.label}</h2>
              <div className="space-y-2">
                {group.items.map((faq, i) => {
                  const id = `${group.key}-${i}`
                  return <FaqItem key={id} id={id} question={faq.question} answer={faq.answer} openId={openId} setOpenId={setOpenId} />
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FaqItem({ id, question, answer, openId, setOpenId }: { id: string; question: string; answer: string; openId: string | null; setOpenId: (id: string | null) => void }) {
  const isOpen = openId === id
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpenId(isOpen ? null : id)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-900 pr-2">{question}</span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-3 border-t border-gray-100">
          <p className="text-sm text-gray-600 pt-3 whitespace-pre-line">{answer}</p>
        </div>
      )}
    </div>
  )
}
