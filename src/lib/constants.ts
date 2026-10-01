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
} as const
export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus]

export const LoanStatus = {
  ACTIVE: 'ACTIVE',
  OVERDUE: 'OVERDUE',
  COMPLETED: 'COMPLETED',
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


export const RegistrationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const
export type RegistrationStatus = (typeof RegistrationStatus)[keyof typeof RegistrationStatus]

export const PasswordResetStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const
export type PasswordResetStatus = (typeof PasswordResetStatus)[keyof typeof PasswordResetStatus]

export const RATING_LABELS: Record<number, string> = {
  4: 'Excellent',
  3: 'Good',
  2: 'Average',
  1: 'Bad',
}
