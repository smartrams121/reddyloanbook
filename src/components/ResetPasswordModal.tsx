'use client'

import { useState } from 'react'
import { generateRandomPassword } from '@/lib/password-gen'

interface Props {
  userName: string
  onConfirm: (password: string, note: string) => Promise<void>
  onCancel: () => void
}

export default function ResetPasswordModal({ userName, onConfirm, onCancel }: Props) {
  const [password, setPassword] = useState('')
  const [note, setNote] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSpecial = /[^a-zA-Z0-9]/.test(password)
  const isLongEnough = password.length >= 8
  const isValid = hasUpper && hasDigit && hasSpecial && isLongEnough

  function handleGenerate() {
    const pwd = generateRandomPassword(12)
    setPassword(pwd)
    setShowPassword(true)
    setCopied(false)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  async function handleConfirm() {
    if (!isValid) return
    setLoading(true)
    setError('')
    try {
      await onConfirm(password, note)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
          <p className="text-sm text-gray-500 mt-0.5">Set a new password for {userName}</p>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <div>
            <label className="label">New Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setCopied(false) }}
                  placeholder="Enter or generate password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <button type="button" onClick={handleGenerate} className="btn-secondary px-3 text-sm whitespace-nowrap">
                Generate
              </button>
            </div>

            {password && (
              <div className="mt-2 space-y-1">
                <div className={`text-xs flex items-center gap-1 ${isLongEnough ? 'text-green-600' : 'text-gray-400'}`}>
                  {isLongEnough ? '✓' : '○'} At least 8 characters
                </div>
                <div className={`text-xs flex items-center gap-1 ${hasUpper ? 'text-green-600' : 'text-gray-400'}`}>
                  {hasUpper ? '✓' : '○'} Uppercase letter
                </div>
                <div className={`text-xs flex items-center gap-1 ${hasDigit ? 'text-green-600' : 'text-gray-400'}`}>
                  {hasDigit ? '✓' : '○'} Number
                </div>
                <div className={`text-xs flex items-center gap-1 ${hasSpecial ? 'text-green-600' : 'text-gray-400'}`}>
                  {hasSpecial ? '✓' : '○'} Special character
                </div>
              </div>
            )}

            {password && isValid && (
              <button
                type="button"
                onClick={handleCopy}
                className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                {copied ? '✓ Copied!' : '📋 Copy password to clipboard'}
              </button>
            )}
          </div>

          <div>
            <label className="label">Note (optional)</label>
            <input
              type="text"
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Shared via phone call"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button type="button" onClick={onCancel} className="btn-secondary px-4 py-2" disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary px-4 py-2"
            disabled={!isValid || loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
