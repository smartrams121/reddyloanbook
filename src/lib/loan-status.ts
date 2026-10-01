import { nowIST } from './date'

export type DerivedLoanStatus = 'ACTIVE' | 'OVERDUE' | 'DEFAULTER' | 'COMPLETED'
export type DerivedCustomerStatus = DerivedLoanStatus | 'NO LOANS'

export function deriveLoanStatus(
  expectedEndDate: string,
  totalRepayable: number,
  totalPaid: number,
): DerivedLoanStatus {
  if (totalPaid >= totalRepayable) return 'COMPLETED'

  const today = nowIST()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(expectedEndDate + 'T00:00:00')

  if (today <= dueDate) return 'ACTIVE'

  const oneYearAfterDue = new Date(dueDate)
  oneYearAfterDue.setFullYear(oneYearAfterDue.getFullYear() + 1)

  if (today <= oneYearAfterDue) return 'OVERDUE'

  return 'DEFAULTER'
}

export function deriveCustomerStatus(
  loanStatuses: DerivedLoanStatus[],
): DerivedCustomerStatus {
  if (loanStatuses.length === 0) return 'NO LOANS'
  if (loanStatuses.includes('ACTIVE')) return 'ACTIVE'
  if (loanStatuses.includes('OVERDUE')) return 'OVERDUE'
  if (loanStatuses.includes('DEFAULTER')) return 'DEFAULTER'
  return 'COMPLETED'
}
