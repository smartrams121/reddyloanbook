import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import AppShell from '@/components/layout/AppShell'

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

  return <AppShell user={user}>{children}</AppShell>
}
