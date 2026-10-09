'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

export default function LoginPage() {
  const router = useRouter()
  const { t, locale, setLocale } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      router.push(data.redirectTo || '/dashboard')
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4">
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setLocale(locale === 'en' ? 'te' : 'en')}
          className="text-xs font-medium px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
        >
          {locale === 'en' ? 'తెలుగు' : 'English'}
        </button>
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('common.app_name')}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('auth.finance_collection_management')}</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="label">{t('auth.username')}</label>
              <input
                id="username"
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.username')}
                autoComplete="username"
                autoCapitalize="none"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="label">{t('auth.password')}</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.password')}
                autoComplete="current-password"
                required
              />
              <div className="mt-1 text-right">
                <Link href="/forgot-password" className="text-xs text-primary-600 hover:text-primary-700">
                  {t('auth.forgot_password')}
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full btn-lg"
            >
              {loading ? t('auth.submitting') : t('auth.sign_in')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            {t('auth.dont_have_account')}{' '}
            <Link href="/register" className="text-primary-600 font-medium">
              {t('auth.sign_up')}
            </Link>
          </p>

          <a
            href="https://github.com/smartrams121/reddyloanbook/releases/download/v1.0.0/dailyfinance.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 mt-4 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.523 2.234a.767.767 0 0 0-1.055.278l-1.26 2.156A8.855 8.855 0 0 0 12 4.003a8.87 8.87 0 0 0-3.208.665L7.532 2.512a.767.767 0 1 0-1.333.757L7.4 5.372A8.904 8.904 0 0 0 3 12.997h18a8.904 8.904 0 0 0-4.4-7.625l1.201-2.103a.767.767 0 0 0-.278-1.055ZM8.5 10.498a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM3 13.997v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7H3Z"/></svg>
            Download App for Android
          </a>
        </div>
      </div>
    </div>
  )
}
