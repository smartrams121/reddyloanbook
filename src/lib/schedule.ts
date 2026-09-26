import {
  CollectionType,
  DayOfWeek,
  DAY_OF_WEEK_JS_MAP,
} from './constants'
import { parseISODate, formatDateISO, addDays, addMonths, isSunday } from './date'

export interface ScheduleEntry {
  installmentNumber: number
  dueDate: string // YYYY-MM-DD
  amount: number  // paise
}

export interface ScheduleInput {
  startDate: string         // YYYY-MM-DD
  numberOfInstallments: number
  installmentAmount: number // paise
  lastInstallmentAmount: number // paise
  collectionType: CollectionType
  collectionDay?: DayOfWeek // required for WEEKLY
  collectOnSundays: boolean
  holidays: string[]        // YYYY-MM-DD[]
}

export function generateSchedule(input: ScheduleInput): ScheduleEntry[] {
  const {
    startDate,
    numberOfInstallments,
    installmentAmount,
    lastInstallmentAmount,
    collectionType,
    collectionDay,
    collectOnSundays,
    holidays,
  } = input

  const holidaySet = new Set(holidays)
  const entries: ScheduleEntry[] = []

  if (collectionType === CollectionType.DAILY) {
    let currentDate = parseISODate(startDate)
    let installmentNum = 0

    while (installmentNum < numberOfInstallments) {
      const dateStr = formatDateISO(currentDate)

      const isHoliday = holidaySet.has(dateStr)
      const isSun = isSunday(currentDate) && !collectOnSundays

      if (!isHoliday && !isSun) {
        installmentNum++
        const amount =
          installmentNum === numberOfInstallments
            ? lastInstallmentAmount
            : installmentAmount

        entries.push({
          installmentNumber: installmentNum,
          dueDate: dateStr,
          amount,
        })
      }

      currentDate = addDays(currentDate, 1)
    }
  } else if (collectionType === CollectionType.WEEKLY) {
    const targetDayJS = DAY_OF_WEEK_JS_MAP[collectionDay || DayOfWeek.SATURDAY]
    let currentDate = parseISODate(startDate)

    // Find the first occurrence of the collection day on or after start date
    while (currentDate.getDay() !== targetDayJS) {
      currentDate = addDays(currentDate, 1)
    }

    for (let i = 1; i <= numberOfInstallments; i++) {
      const dateStr = formatDateISO(currentDate)
      const amount =
        i === numberOfInstallments ? lastInstallmentAmount : installmentAmount

      entries.push({
        installmentNumber: i,
        dueDate: dateStr,
        amount,
      })

      currentDate = addDays(currentDate, 7)
    }
  } else if (collectionType === CollectionType.MONTHLY) {
    const start = parseISODate(startDate)
    const dayOfMonth = start.getDate()

    for (let i = 1; i <= numberOfInstallments; i++) {
      let dueDate = new Date(start.getFullYear(), start.getMonth() + i, dayOfMonth)
      // Handle months where the day doesn't exist (e.g., 31st in February)
      if (dueDate.getDate() !== dayOfMonth) {
        dueDate = new Date(start.getFullYear(), start.getMonth() + i + 1, 0)
      }

      const amount =
        i === numberOfInstallments ? lastInstallmentAmount : installmentAmount

      entries.push({
        installmentNumber: i,
        dueDate: formatDateISO(dueDate),
        amount,
      })
    }
  }

  return entries
}

export function getExpectedEndDate(schedule: ScheduleEntry[]): string {
  if (schedule.length === 0) return ''
  return schedule[schedule.length - 1].dueDate
}

export function countExpectedInstallmentsByDate(
  schedule: ScheduleEntry[],
  upToDate: string
): number {
  return schedule.filter((e) => e.dueDate <= upToDate).length
}

export function getNextDueDate(
  schedule: ScheduleEntry[],
  afterDate: string
): ScheduleEntry | null {
  return schedule.find((e) => e.dueDate > afterDate) || null
}

export function isDueToday(
  schedule: ScheduleEntry[],
  today: string
): boolean {
  return schedule.some((e) => e.dueDate === today)
}
