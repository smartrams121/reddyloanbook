'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwords_not_match'))
      return
    }

    if (newPassword.length < 8) {
      setError(t('auth.password_min'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to change password')
        setLoading(false)
        return
      }

      router.push(data.redirectTo || '/dashboard')
    } catch {
      setError('Network error')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.change_password')}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('auth.force_change_message')}</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
            )}

            <div>
              <label htmlFor="new-password" className="label">{t('auth.new_password')}</label>
              <input
                id="new-password"
                type="password"
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('auth.password_min')}
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('auth.password_rules')}
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="label">{t('auth.confirm_password')}</label>
              <input
                id="confirm-password"
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.confirm_password')}
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full btn-lg">
              {loading ? t('auth.changing') : t('auth.change_password')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
