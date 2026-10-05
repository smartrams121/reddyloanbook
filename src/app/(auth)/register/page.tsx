'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

export default function RegisterPage() {
  const { t, locale, setLocale } = useTranslation()
  const [step, setStep] = useState<'form' | 'success'>('form')

  const [businessName, setBusinessName] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [declaration, setDeclaration] = useState(false)

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const checkUsername = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 4) {
      setUsernameStatus('idle')
      return
    }
    setUsernameStatus('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(value)}`)
        const data = await res.json()
        setUsernameStatus(data.available ? 'available' : 'taken')
      } catch {
        setUsernameStatus('idle')
      }
    }, 300)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleUsernameChange(value: string) {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9._]/g, '')
    setUsername(cleaned)
    checkUsername(cleaned)
  }

  const pwChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
  const passwordStrong = pwChecks.length && pwChecks.uppercase && pwChecks.number && pwChecks.special

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (usernameStatus === 'taken') {
      setError(t('register.username_taken'))
      return
    }

    if (!passwordStrong) {
      setError(t('auth.password_rules'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwords_not_match'))
      return
    }

    if (!declaration) {
      setError('You must accept the declaration')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          fullName,
          phone,
          city,
          email: email || undefined,
          username,
          password,
          confirmPassword,
          declaration: true,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.details) {
          const msgs = Object.entries(data.details)
            .map(([, v]) => (Array.isArray(v) ? v.join(', ') : String(v)))
            .join('. ')
          setError(msgs)
        } else {
          setError(data.error || 'Registration failed')
        }
        return
      }

      setStep('success')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('register.success_title')}</h1>
          <p className="text-sm text-gray-600 mb-6">
            {t('register.success_message')}
          </p>
          <Link href="/login" className="btn-primary inline-block px-8">
            {t('register.back_to_login')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-primary-50 to-white px-4 py-8 relative">
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setLocale(locale === 'en' ? 'te' : 'en')}
          className="text-xs font-medium px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
        >
          {locale === 'en' ? 'తెలుగు' : 'English'}
        </button>
      </div>
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 mb-3">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('register.page_title')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          {/* Business Details */}
          <div className="card p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('register.step1_title')}</h2>

            <div>
              <label className="label">{t('register.organization_name')} *</label>
              <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={t('register.organization_name_placeholder')} required />
            </div>

            <div>
              <label className="label">{t('register.owner_name')} *</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('register.owner_name_placeholder')} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('register.phone_number')} *</label>
                <input
                  className="input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder={t('register.phone_placeholder')}
                  required
                  maxLength={10}
                />
              </div>
              <div>
                <label className="label">{t('register.email')} *</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('register.email_placeholder')} required />
              </div>
            </div>

            <div>
              <label className="label">{t('common.city')} *</label>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Visakhapatnam" required />
            </div>
          </div>

          {/* Login Details */}
          <div className="card p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('register.step2_title')}</h2>

            <div>
              <label className="label">{t('register.username')} *</label>
              <input
                className="input"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder={t('register.username_placeholder')}
                required
                minLength={4}
                maxLength={20}
                autoCapitalize="none"
              />
              {usernameStatus === 'checking' && (
                <p className="text-xs text-gray-400 mt-1">{t('register.username_checking')}</p>
              )}
              {usernameStatus === 'available' && (
                <p className="text-xs text-green-600 mt-1">{t('register.username_available')}</p>
              )}
              {usernameStatus === 'taken' && (
                <p className="text-xs text-danger-600 mt-1">{t('register.username_taken')}</p>
              )}
            </div>

            <div>
              <label className="label">{t('register.password')} *</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('register.password_placeholder')}
                required
                autoComplete="new-password"
              />
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <PwCheck met={pwChecks.length} label={t('auth.password_min')} />
                  <PwCheck met={pwChecks.uppercase} label={t('auth.password_uppercase')} />
                  <PwCheck met={pwChecks.number} label={t('auth.password_number')} />
                  <PwCheck met={pwChecks.special} label={t('auth.password_special')} />
                </div>
              )}
            </div>

            <div>
              <label className="label">{t('register.confirm_password')} *</label>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('register.confirm_password_placeholder')}
                required
                autoComplete="new-password"
              />
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <p className="text-xs text-danger-600 mt-1">{t('auth.passwords_not_match')}</p>
              )}
            </div>
          </div>

          {/* Declaration */}
          <div className="card p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={declaration}
                onChange={(e) => setDeclaration(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm text-gray-700">
                {t('register.declaration')}
              </span>
            </label>
          </div>

          {/* Submit */}
          <div className="space-y-3 pt-2">
            <button type="submit" disabled={loading || usernameStatus === 'taken' || !declaration} className="btn-primary w-full btn-lg">
              {loading ? t('register.submitting') : t('register.submit')}
            </button>
            <p className="text-center text-sm text-gray-500">
              {t('register.already_have_account')}{' '}
              <Link href="/login" className="text-primary-600 font-medium">
                {t('register.sign_in')}
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

function PwCheck({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {met ? (
        <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className={met ? 'text-green-600' : 'text-gray-400'}>{label}</span>
    </div>
  )
}
