import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { assertBusinessAccess } from '@/lib/scope'

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) redirect('/login')

  try {
    await assertBusinessAccess(user, businessId)
  } catch {
    redirect('/dashboard')
  }

  return <>{children}</>
}
