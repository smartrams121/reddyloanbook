import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { assertBusinessAccess } from '@/lib/scope'
import { hasPermission } from '@/lib/permissions'
import { Role } from '@/lib/constants'
import EditLoanForm from './EditLoanForm'

interface Props {
  params: Promise<{ businessId: string; loanId: string }>
}

export default async function EditLoanPage({ params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) redirect('/login')

  try { await assertBusinessAccess(user, businessId) } catch { redirect('/dashboard') }

  if (!hasPermission(user.role as Role, 'edit_loan')) {
    redirect(`/b/${businessId}/loans`)
  }

  return <EditLoanForm />
}
