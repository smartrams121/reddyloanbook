import { CollectionType, InterestModel } from './constants'

export interface LoanInput {
  loanAmount: number      // paise
  interestAmount: number  // paise
  interestModel: InterestModel
  collectionType: CollectionType
  installmentAmount: number // paise
  numberOfInstallments: number
}

export interface LoanCalcResult {
  totalRepayable: number    // paise
  amountGiven: number       // paise
  lastInstallmentAmount: number // paise
  dailyInstallment: number  // paise (same as installmentAmount for display)
}

export function calculateLoan(input: LoanInput): LoanCalcResult {
  const { loanAmount, interestAmount, interestModel, installmentAmount, numberOfInstallments } = input

  const totalRepayable = loanAmount + interestAmount

  let amountGiven: number
  if (interestModel === InterestModel.UPFRONT) {
    amountGiven = loanAmount - interestAmount
  } else {
    amountGiven = loanAmount
  }

  const regularTotal = installmentAmount * (numberOfInstallments - 1)
  const lastInstallmentAmount = totalRepayable - regularTotal

  return {
    totalRepayable,
    amountGiven,
    lastInstallmentAmount,
    dailyInstallment: installmentAmount,
  }
}

export function validateLoanAmounts(input: LoanInput): string | null {
  const result = calculateLoan(input)

  if (result.totalRepayable <= 0) {
    return 'Total repayable must be positive'
  }

  if (result.amountGiven <= 0) {
    return 'Amount given to customer must be positive'
  }

  if (result.lastInstallmentAmount <= 0) {
    return 'Installment amount is too large for the total repayable'
  }

  if (result.lastInstallmentAmount > input.installmentAmount * 2) {
    return 'Last installment would be more than double the regular installment — adjust the amounts'
  }

  return null
}

export interface LoanBalanceInfo {
  totalRepayable: number
  totalPaid: number
  outstanding: number
  installmentAmount: number
  collectionType: CollectionType
  installmentsCompleted: number
  installmentsRemaining: number
  expectedPaidByToday: number
  arrears: number       // positive = behind, negative = ahead
  missedInstallments: number
  status: 'on_track' | 'slightly_behind' | 'seriously_overdue'
}

export function calculateBalance(
  totalRepayable: number,
  totalPaid: number,
  installmentAmount: number,
  numberOfInstallments: number,
  expectedInstallmentsByToday: number,
  collectionType: CollectionType
): LoanBalanceInfo {
  const outstanding = totalRepayable - totalPaid
  const installmentsCompleted = Math.floor(totalPaid / installmentAmount)
  const installmentsRemaining = numberOfInstallments - installmentsCompleted
  const expectedPaidByToday = Math.min(
    expectedInstallmentsByToday * installmentAmount,
    totalRepayable
  )
  const arrears = expectedPaidByToday - totalPaid
  const missedInstallments = Math.max(
    0,
    expectedInstallmentsByToday - installmentsCompleted
  )

  let status: 'on_track' | 'slightly_behind' | 'seriously_overdue'
  if (arrears <= 0) {
    status = 'on_track'
  } else if (missedInstallments <= 3) {
    status = 'slightly_behind'
  } else {
    status = 'seriously_overdue'
  }

  return {
    totalRepayable,
    totalPaid,
    outstanding,
    installmentAmount,
    collectionType,
    installmentsCompleted,
    installmentsRemaining,
    expectedPaidByToday,
    arrears,
    missedInstallments,
    status,
  }
}

export function shouldAutoComplete(
  totalRepayable: number,
  totalPaidAfterPayment: number
): boolean {
  return totalPaidAfterPayment >= totalRepayable
}

export function calculateRenewalAmountGiven(
  newLoanAmount: number,
  newInterestAmount: number,
  newInterestModel: InterestModel,
  oldOutstanding: number
): number {
  let baseGiven: number
  if (newInterestModel === InterestModel.UPFRONT) {
    baseGiven = newLoanAmount - newInterestAmount
  } else {
    baseGiven = newLoanAmount
  }
  return baseGiven - oldOutstanding
}

