import { nowIST } from './date'

export type DerivedLoanStatus = 'ACTIVE' | 'OVERDUE' | 'DEFAULTER' | 'COMPLETED'
export type DerivedCustomerStatus = DerivedLoanStatus | 'NO LOANS'

export function deriveLoanStatus(
  expectedEndDate: string,
  totalRepayable: number,
  totalPaid: number,
  gracePeriod: number = 0,
  collectionType: string = 'DAILY',
  defaulterPeriodDays: number = 365,
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

  const defaulterDate = new Date(graceEndDate)
  defaulterDate.setDate(defaulterDate.getDate() + defaulterPeriodDays)

  if (today <= defaulterDate) return 'OVERDUE'

  return 'DEFAULTER'
}

export interface GracePeriodConfig {
  gracePeriodDaily: number
  gracePeriodWeekly: number
  gracePeriodMonthly: number
  defaulterPeriodDays?: number
}

export function getGracePeriod(config: GracePeriodConfig, collectionType: string): number {
  if (collectionType === 'WEEKLY') return config.gracePeriodWeekly
  if (collectionType === 'MONTHLY') return config.gracePeriodMonthly
  return config.gracePeriodDaily
}

export interface LoanForStatus {
  expectedEndDate: string
  totalRepayable: number
  numberOfInstallments: number
  collectionType: string
  statusOverride?: string | null
  statusOverrideDate?: string | null
}

function calculateOverrideEndDate(overrideDate: string, numberOfInstallments: number, collectionType: string): string {
  const d = new Date(overrideDate + 'T00:00:00')
  if (collectionType === 'WEEKLY') {
    d.setDate(d.getDate() + numberOfInstallments * 7)
  } else if (collectionType === 'MONTHLY') {
    d.setMonth(d.getMonth() + numberOfInstallments)
  } else {
    d.setDate(d.getDate() + numberOfInstallments)
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function resolveLoanStatus(
  loan: LoanForStatus,
  totalPaid: number,
  gracePeriod: number,
  collectionType: string,
  defaulterPeriodDays: number = 365,
): DerivedLoanStatus {
  if (totalPaid >= loan.totalRepayable) return 'COMPLETED'

  if (!loan.statusOverride) {
    return deriveLoanStatus(loan.expectedEndDate, loan.totalRepayable, totalPaid, gracePeriod, collectionType, defaulterPeriodDays)
  }

  if (loan.statusOverride === 'ACTIVE' && loan.statusOverrideDate) {
    const newEndDate = calculateOverrideEndDate(loan.statusOverrideDate, loan.numberOfInstallments, loan.collectionType)
    return deriveLoanStatus(newEndDate, loan.totalRepayable, totalPaid, gracePeriod, collectionType, defaulterPeriodDays)
  }

  return loan.statusOverride as DerivedLoanStatus
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
