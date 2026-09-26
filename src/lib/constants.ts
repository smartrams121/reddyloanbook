export const Role = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  OWNER: 'OWNER',
  BUSINESS_ADMIN: 'BUSINESS_ADMIN',
  AGENT: 'AGENT',
} as const
export type Role = (typeof Role)[keyof typeof Role]

export const CollectionType = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const
export type CollectionType = (typeof CollectionType)[keyof typeof CollectionType]

export const InterestModel = {
  ADDON: 'ADDON',
  UPFRONT: 'UPFRONT',
} as const
export type InterestModel = (typeof InterestModel)[keyof typeof InterestModel]

export const CustomerStatus = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  DEFAULTER: 'DEFAULTER',
} as const
export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus]

export const LoanStatus = {
  ACTIVE: 'ACTIVE',
  OVERDUE: 'OVERDUE',
  IN_GRACE: 'IN_GRACE',
  DEFAULTER: 'DEFAULTER',
  COMPLETED: 'COMPLETED',
  COMPLETED_RENEWED: 'COMPLETED_RENEWED',
  SETTLED: 'SETTLED',
  WRITTEN_OFF: 'WRITTEN_OFF',
} as const
export type LoanStatus = (typeof LoanStatus)[keyof typeof LoanStatus]

export const DayOfWeek = {
  MONDAY: 'MONDAY',
  TUESDAY: 'TUESDAY',
  WEDNESDAY: 'WEDNESDAY',
  THURSDAY: 'THURSDAY',
  FRIDAY: 'FRIDAY',
  SATURDAY: 'SATURDAY',
  SUNDAY: 'SUNDAY',
} as const
export type DayOfWeek = (typeof DayOfWeek)[keyof typeof DayOfWeek]

export const DAY_OF_WEEK_JS_MAP: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
}

export const JS_TO_DAY_OF_WEEK: Record<number, string> = {
  0: 'SUNDAY',
  1: 'MONDAY',
  2: 'TUESDAY',
  3: 'WEDNESDAY',
  4: 'THURSDAY',
  5: 'FRIDAY',
  6: 'SATURDAY',
}

export const ACTIVE_LOAN_STATUSES = [
  LoanStatus.ACTIVE,
  LoanStatus.OVERDUE,
  LoanStatus.IN_GRACE,
  LoanStatus.DEFAULTER,
] as const

export const CLOSED_LOAN_STATUSES = [
  LoanStatus.COMPLETED,
  LoanStatus.COMPLETED_RENEWED,
  LoanStatus.SETTLED,
  LoanStatus.WRITTEN_OFF,
] as const

export const RATING_LABELS: Record<number, string> = {
  4: 'Excellent',
  3: 'Good',
  2: 'Average',
  1: 'Bad',
}
