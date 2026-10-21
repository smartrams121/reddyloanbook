import { Role } from '@/lib/constants'
import { nowIST, addDays, addMonths, formatDateISO, formatDateDisplay } from '@/lib/date'
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

  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const createdAtIST = new Date(recordCreatedAt.getTime() + IST_OFFSET_MS)

  let editDeadline: Date
  switch (unit) {
    case 'HOURS':
      editDeadline = new Date(createdAtIST.getTime() + value * 60 * 60 * 1000)
      break
    case 'DAYS':
      editDeadline = addDays(createdAtIST, value)
      break
    case 'MONTHS':
      editDeadline = addMonths(createdAtIST, value)
      break
    default:
      editDeadline = new Date(createdAtIST.getTime() + 4 * 60 * 60 * 1000)
  }

  if (now.getTime() > editDeadline.getTime()) {
    throw new Error(`This record was created outside your allowed edit window (${value} ${unit.toLowerCase()})`)
  }
}

export function getPaymentMinDate(user: AuthUser): string | null {
  if (user.role !== Role.AGENT) return null
  if (user.backdatingDays === null || user.backdatingDays === undefined) return null
  const today = nowIST()
  if (user.backdatingDays === 0) return formatDateISO(today)
  return formatDateISO(addDays(today, -user.backdatingDays))
}

export function assertPaymentDateAllowed(user: AuthUser, dateStr: string): void {
  const minDate = getPaymentMinDate(user)
  if (!minDate) return
  if (dateStr < minDate) {
    const display = formatDateDisplay(minDate)
    if (user.backdatingDays === 0) {
      throw new Error('You can only record payments for today.')
    }
    throw new Error(
      `Payment date exceeds your backdating limit of ${user.backdatingDays} day(s). Earliest allowed: ${display}`
    )
  }
}
