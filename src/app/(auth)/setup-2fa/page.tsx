'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Setup2FAPage() {
  const router = useRouter()
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'setup' | 'verify' | 'recovery'>('setup')

  useEffect(() => {
    fetch('/api/auth/2fa/setup', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        setQrDataUrl(data.qrDataUrl)
        setSecret(data.secret)
      })
      .catch(() => setError('Failed to generate 2FA setup'))
  }, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: verifyCode }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Invalid code')
      setLoading(false)
      return
    }

    setRecoveryCodes(data.recoveryCodes)
    setStep('recovery')
    setLoading(false)
  }

  if (step === 'recovery') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Recovery Codes</h1>
            <p className="text-gray-500 mt-1 text-sm">Save these codes somewhere safe. You will need them if you lose your authenticator.</p>
          </div>
          <div className="card p-6">
            <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-sm space-y-1">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="text-gray-700">{code}</div>
              ))}
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-primary w-full btn-lg"
            >
              I&apos;ve Saved My Codes — Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Scan the QR code with Google Authenticator or Microsoft Authenticator
          </p>
        </div>

        <div className="card p-6">
          {qrDataUrl && (
            <div className="flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="2FA QR Code" width={200} height={200} />
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-500 mb-1">Manual entry key:</p>
            <p className="font-mono text-sm text-gray-700 break-all">{secret}</p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            {error && (
              <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
            )}

            <div>
              <label htmlFor="code" className="label">Enter the 6-digit code from your app</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="input text-center text-lg tracking-widest"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full btn-lg">
              {loading ? 'Verifying...' : 'Verify & Enable 2FA'}
            </button>
          </form>
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full text-center text-sm text-gray-400 mt-4 hover:text-gray-600"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
