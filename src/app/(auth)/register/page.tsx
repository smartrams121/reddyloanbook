'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'

export default function RegisterPage() {
  const [step, setStep] = useState<'form' | 'success'>('form')

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
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
      setError('Username is already taken')
      return
    }

    if (!passwordStrong) {
      setError('Password does not meet all requirements')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
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
          fullName,
          phone,
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
          <h1 className="text-xl font-bold text-gray-900 mb-2">Registration Submitted</h1>
          <p className="text-sm text-gray-600 mb-6">
            Your registration request has been submitted successfully. The platform admin will review
            your request and approve your account. You will be able to log in once approved.
          </p>
          <Link href="/login" className="btn-primary inline-block px-8">
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-primary-50 to-white px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 mb-3">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Register as Owner</h1>
          <p className="text-gray-500 mt-1 text-sm">Create your finance collection business</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          {/* Personal Info */}
          <div className="card p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Personal Information</h2>

            <div>
              <label className="label">Full Name *</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Phone Number *</label>
                <input
                  className="input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile"
                  required
                  maxLength={10}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="card p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Account</h2>

            <div>
              <label className="label">Username *</label>
              <input
                className="input"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="4-20 chars (letters, numbers, . _)"
                required
                minLength={4}
                maxLength={20}
                autoCapitalize="none"
              />
              {usernameStatus === 'checking' && (
                <p className="text-xs text-gray-400 mt-1">Checking availability...</p>
              )}
              {usernameStatus === 'available' && (
                <p className="text-xs text-green-600 mt-1">Username is available</p>
              )}
              {usernameStatus === 'taken' && (
                <p className="text-xs text-danger-600 mt-1">Username is already taken</p>
              )}
            </div>

            <div>
              <label className="label">Password *</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                autoComplete="new-password"
              />
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <PwCheck met={pwChecks.length} label="At least 8 characters" />
                  <PwCheck met={pwChecks.uppercase} label="One uppercase letter" />
                  <PwCheck met={pwChecks.number} label="One number" />
                  <PwCheck met={pwChecks.special} label="One special character" />
                </div>
              )}
            </div>

            <div>
              <label className="label">Confirm Password *</label>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                autoComplete="new-password"
              />
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <p className="text-xs text-danger-600 mt-1">Passwords do not match</p>
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
                I declare that the information provided is accurate and I agree to the terms of use of this platform. I understand that my account will be reviewed and approved by the platform administrator.
              </span>
            </label>
          </div>

          {/* Submit */}
          <div className="space-y-3 pt-2">
            <button type="submit" disabled={loading || usernameStatus === 'taken' || !declaration} className="btn-primary w-full btn-lg">
              {loading ? 'Submitting...' : 'Submit Registration'}
            </button>
            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/login" className="text-primary-600 font-medium">
                Sign In
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
