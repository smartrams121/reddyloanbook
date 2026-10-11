'use client'

import { useState } from 'react'
import { formatPaiseAbbr } from '@/lib/money'

export default function AmountDisplay({ paise, className }: { paise: number; className?: string }) {
  const [showFull, setShowFull] = useState(false)
  const { short, full } = formatPaiseAbbr(paise)
  const isAbbreviated = short !== full

  return (
    <span
      className={`${className || ''} ${isAbbreviated ? 'cursor-pointer' : ''}`}
      title={full}
      onClick={isAbbreviated ? () => setShowFull(f => !f) : undefined}
    >
      {showFull ? full : short}
    </span>
  )
}
