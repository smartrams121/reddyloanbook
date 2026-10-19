import { Role } from '@/lib/constants'
import { nowIST, addDays, addMonths, formatDateISO } from '@/lib/date'
import type { AuthUser } from '@/lib/auth'

function getBackdateCutoff(user: AuthUser): Date | null {
  if (user.role !== Role.AGENT) return null
  const now = nowIST()
  const value = user.backdateValue ?? 4
  const unit = user.backdateUnit ?? 'HOURS'
  switch (unit) {
    case 'HOURS':
      return new Date(now.getTime() - value * 60 * 60 * 1000)
    case 'DAYS':
      return addDays(now, -value)
    case 'MONTHS':
      return addMonths(now, -value)
    default:
      return new Date(now.getTime() - 4 * 60 * 60 * 1000)
  }
}

export function getBackdateMinDate(user: AuthUser): string | null {
  const cutoff = getBackdateCutoff(user)
  if (!cutoff) return null
  return formatDateISO(cutoff)
}

export function assertBackdateAllowed(user: AuthUser, dateStr: string) {
  const minDate = getBackdateMinDate(user)
  if (!minDate) return
  if (dateStr < minDate) {
    const unit = (user.backdateUnit ?? 'HOURS').toLowerCase()
    throw new Error(`Payment date is beyond your allowed backdate limit (${user.backdateValue ?? 4} ${unit})`)
  }
}

export function assertRecordEditAllowed(user: AuthUser, recordCreatedAt: Date) {
  if (user.role !== Role.AGENT) return
  const now = nowIST()
  const value = user.backdateValue ?? 4
  const unit = user.backdateUnit ?? 'HOURS'

  let editDeadline: Date
  switch (unit) {
    case 'HOURS':
      editDeadline = new Date(recordCreatedAt.getTime() + value * 60 * 60 * 1000)
      break
    case 'DAYS':
      editDeadline = addDays(new Date(recordCreatedAt), value)
      break
    case 'MONTHS':
      editDeadline = addMonths(new Date(recordCreatedAt), value)
      break
    default:
      editDeadline = new Date(recordCreatedAt.getTime() + 4 * 60 * 60 * 1000)
  }

  if (now > editDeadline) {
    throw new Error(`This record was created outside your allowed edit window (${value} ${unit.toLowerCase()})`)
  }
}
