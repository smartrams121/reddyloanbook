'use client'

import { useState } from 'react'

interface Props {
  faqs: { question: string; answer: string }[]
}

export default function FaqAccordion({ faqs }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? faqs.filter(f =>
        f.question.toLowerCase().includes(search.toLowerCase()) ||
        f.answer.toLowerCase().includes(search.toLowerCase())
      )
    : faqs

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
          onChange={(e) => { setSearch(e.target.value); setOpenIndex(null) }}
        />
      </div>
      {filtered.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-400">No matching FAQs found.</p>
        </div>
      )}
    <div className="space-y-2">
      {filtered.map((faq, i) => (
        <div key={i} className="card overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-900 pr-2">{faq.question}</span>
            <svg
              className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${openIndex === i ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {openIndex === i && (
            <div className="px-4 pb-3 border-t border-gray-100">
              <p className="text-sm text-gray-600 pt-3 whitespace-pre-line">{faq.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
    </div>
  )
}
