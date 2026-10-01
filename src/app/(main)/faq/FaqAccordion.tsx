'use client'

import { useState } from 'react'

interface Props {
  faqs: { question: string; answer: string }[]
}

export default function FaqAccordion({ faqs }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {faqs.map((faq, i) => (
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
  )
}
