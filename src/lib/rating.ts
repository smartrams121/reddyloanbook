import { CollectionType, RATING_LABELS } from './constants'
import { parseISODate, daysBetween, weeksBetween, monthsBetween } from './date'

export interface RatingConfig {
  gracePeriodDaily: number
  gracePeriodWeekly: number
  gracePeriodMonthly: number
  ratingGoodMaxPct: number
  ratingAverageMaxPct: number
}

export function calculateLoanRating(
  expectedEndDate: string,
  actualCompletionDate: string,
  collectionType: CollectionType,
  config: RatingConfig,
  isWrittenOff: boolean
): number {
  if (isWrittenOff) return 1

  const expected = parseISODate(expectedEndDate)
  const actual = parseISODate(actualCompletionDate)

  if (actual <= expected) return 4 // Completed on or before time → Excellent

  let additionalUnits: number
  let gracePeriod: number

  if (collectionType === CollectionType.DAILY) {
    additionalUnits = daysBetween(expected, actual)
    gracePeriod = config.gracePeriodDaily
  } else if (collectionType === CollectionType.WEEKLY) {
    additionalUnits = weeksBetween(expected, actual)
    gracePeriod = config.gracePeriodWeekly
  } else {
    additionalUnits = monthsBetween(expected, actual)
    gracePeriod = config.gracePeriodMonthly
  }

  if (gracePeriod === 0) return additionalUnits === 0 ? 4 : 1

  const pctUsed = (additionalUnits / gracePeriod) * 100

  if (pctUsed <= 0) return 4
  if (pctUsed <= config.ratingGoodMaxPct) return 3
  if (pctUsed <= config.ratingAverageMaxPct) return 2
  return 1
}

export function calculateCustomerRating(loanRatings: number[]): number | null {
  if (loanRatings.length === 0) return null
  const sum = loanRatings.reduce((a, b) => a + b, 0)
  return Math.round((sum / loanRatings.length) * 10) / 10
}

export function getRatingLabel(rating: number): string {
  const rounded = Math.round(rating)
  return RATING_LABELS[rounded] || 'Unknown'
}

export function getRatingColor(rating: number): string {
  if (rating >= 3.5) return 'text-success-600'
  if (rating >= 2.5) return 'text-primary-600'
  if (rating >= 1.5) return 'text-warning-600'
  return 'text-danger-600'
}
