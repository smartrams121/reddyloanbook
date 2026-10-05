import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import AppShell from '@/components/layout/AppShell'
import { I18nProvider, Locale } from '@/lib/i18n'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSession()

  if (!user) {
    redirect('/login')
  }

  if (user.mustChangePassword) {
    redirect('/change-password')
  }

  return (
    <I18nProvider initialLocale={user.preferredLanguage as Locale}>
      <AppShell user={user}>{children}</AppShell>
    </I18nProvider>
  )
}
