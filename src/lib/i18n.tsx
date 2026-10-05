'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

import enCommon from '../../locales/en/common.json'
import enDashboard from '../../locales/en/dashboard.json'
import enCustomers from '../../locales/en/customers.json'
import enLoans from '../../locales/en/loans.json'
import enPayments from '../../locales/en/payments.json'
import enReports from '../../locales/en/reports.json'
import enProfile from '../../locales/en/profile.json'
import enAuth from '../../locales/en/auth.json'
import enSettings from '../../locales/en/settings.json'
import enRegister from '../../locales/en/register.json'

import teCommon from '../../locales/te/common.json'
import teDashboard from '../../locales/te/dashboard.json'
import teCustomers from '../../locales/te/customers.json'
import teLoans from '../../locales/te/loans.json'
import tePayments from '../../locales/te/payments.json'
import teReports from '../../locales/te/reports.json'
import teProfile from '../../locales/te/profile.json'
import teAuth from '../../locales/te/auth.json'
import teSettings from '../../locales/te/settings.json'
import teRegister from '../../locales/te/register.json'

export type Locale = 'en' | 'te'

const translations: Record<Locale, Record<string, Record<string, string>>> = {
  en: {
    common: enCommon,
    dashboard: enDashboard,
    customers: enCustomers,
    loans: enLoans,
    payments: enPayments,
    reports: enReports,
    profile: enProfile,
    auth: enAuth,
    settings: enSettings,
    register: enRegister,
  },
  te: {
    common: teCommon,
    dashboard: teDashboard,
    customers: teCustomers,
    loans: teLoans,
    payments: tePayments,
    reports: teReports,
    profile: teProfile,
    auth: teAuth,
    settings: teSettings,
    register: teRegister,
  },
}

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key: string) => key,
})

export function useTranslation() {
  return useContext(I18nContext)
}

function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem('preferred_language')
    if (stored === 'te') return 'te'
  } catch {}
  return 'en'
}

interface I18nProviderProps {
  children: ReactNode
  initialLocale?: Locale
}

export function T({ k, params }: { k: string; params?: Record<string, string | number> }) {
  const { t } = useTranslation()
  return <>{t(k, params)}</>
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || 'en')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!initialLocale) {
      setLocaleState(getStoredLocale())
    }
    setHydrated(true)
  }, [initialLocale])

  useEffect(() => {
    if (hydrated) {
      document.documentElement.lang = locale
      if (locale === 'te') {
        document.documentElement.style.fontFamily = "'Noto Sans Telugu', 'Arial', sans-serif"
      } else {
        document.documentElement.style.fontFamily = ''
      }
    }
  }, [locale, hydrated])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try { localStorage.setItem('preferred_language', newLocale) } catch {}
    fetch('/api/profile/language', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: newLocale }),
    }).catch(() => {})
  }, [])

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const [namespace, ...rest] = key.split('.')
    const translationKey = rest.join('.')

    const dict = translations[locale]?.[namespace]
    let value = dict?.[translationKey]

    if (!value) {
      const fallback = translations.en?.[namespace]
      value = fallback?.[translationKey]
    }

    if (!value) return key

    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
    }

    return value
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}
