'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const colors = {
    success: 'bg-success-600',
    error: 'bg-danger-600',
    info: 'bg-primary-600',
  }

  return (
    <div
      className={`fixed top-4 right-4 left-4 md:left-auto md:w-96 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className={`${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg text-sm`}>
        {message}
      </div>
    </div>
  )
}
