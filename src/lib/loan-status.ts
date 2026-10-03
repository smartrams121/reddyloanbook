import { nowIST } from './date'

export type DerivedLoanStatus = 'ACTIVE' | 'OVERDUE' | 'DEFAULTER' | 'COMPLETED'
export type DerivedCustomerStatus = DerivedLoanStatus | 'NO LOANS'

export function deriveLoanStatus(
  expectedEndDate: string,
  totalRepayable: number,
  totalPaid: number,
  gracePeriod: number = 0,
  collectionType: string = 'DAILY',
): DerivedLoanStatus {
  if (totalPaid >= totalRepayable) return 'COMPLETED'

  const today = nowIST()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(expectedEndDate + 'T00:00:00')

  // Add grace period to the due date
  const graceEndDate = new Date(dueDate)
  if (collectionType === 'WEEKLY') {
    graceEndDate.setDate(graceEndDate.getDate() + gracePeriod * 7)
  } else if (collectionType === 'MONTHLY') {
    graceEndDate.setMonth(graceEndDate.getMonth() + gracePeriod)
  } else {
    graceEndDate.setDate(graceEndDate.getDate() + gracePeriod)
  }

  if (today <= graceEndDate) return 'ACTIVE'

  const oneYearAfterGrace = new Date(graceEndDate)
  oneYearAfterGrace.setFullYear(oneYearAfterGrace.getFullYear() + 1)

  if (today <= oneYearAfterGrace) return 'OVERDUE'

  return 'DEFAULTER'
}

export interface GracePeriodConfig {
  gracePeriodDaily: number
  gracePeriodWeekly: number
  gracePeriodMonthly: number
}

export function getGracePeriod(config: GracePeriodConfig, collectionType: string): number {
  if (collectionType === 'WEEKLY') return config.gracePeriodWeekly
  if (collectionType === 'MONTHLY') return config.gracePeriodMonthly
  return config.gracePeriodDaily
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
