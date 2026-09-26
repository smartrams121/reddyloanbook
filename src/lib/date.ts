const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

export function nowIST(): Date {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utc + IST_OFFSET_MS)
}

export function todayIST(): string {
  return formatDateISO(nowIST())
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDateDisplay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

export function parseISODate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7)
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  const targetMonth = result.getMonth() + months
  result.setMonth(targetMonth)
  if (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setDate(0)
  }
  return result
}

export function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

export function dayOfWeekJS(date: Date): number {
  return date.getDay()
}

export function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((endDay.getTime() - startDay.getTime()) / msPerDay)
}

export function weeksBetween(start: Date, end: Date): number {
  return Math.floor(daysBetween(start, end) / 7)
}

export function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  )
}

export function formatDateTimeFull(date: Date): string {
  const d = formatDateDisplay(formatDateISO(date))
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${d} ${h}:${m}`
}
