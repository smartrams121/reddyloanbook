/**
 * All money stored as integers in paise (1 rupee = 100 paise).
 * ₹10,000 = 1,000,000 paise.
 */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

export function paiseToRupees(paise: number): number {
  return paise / 100
}

export function formatPaise(paise: number): string {
  const rupees = paiseToRupees(paise)
  return formatRupees(rupees)
}

export function formatRupees(amount: number): string {
  const isNegative = amount < 0
  const abs = Math.abs(amount)
  const parts = abs.toFixed(2).split('.')
  const intPart = parts[0]
  const decPart = parts[1]

  const formatted = formatIndianNumber(intPart)
  const result = `₹${formatted}.${decPart}`
  return isNegative ? `-${result}` : result
}

export function formatPaiseShort(paise: number): string {
  const rupees = paiseToRupees(paise)
  const isNegative = rupees < 0
  const abs = Math.abs(rupees)

  if (abs === Math.floor(abs)) {
    const formatted = formatIndianNumber(String(Math.floor(abs)))
    const result = `₹${formatted}`
    return isNegative ? `-${result}` : result
  }
  return formatPaise(paise)
}

function formatIndianNumber(numStr: string): string {
  const len = numStr.length
  if (len <= 3) return numStr

  let result = numStr.slice(-3)
  let remaining = numStr.slice(0, -3)

  while (remaining.length > 0) {
    const chunk = remaining.slice(-2)
    result = chunk + ',' + result
    remaining = remaining.slice(0, -2)
  }

  return result
}

export function parseRupeesInput(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '')
  const num = parseFloat(cleaned)
  if (isNaN(num) || num < 0) return null
  return rupeesToPaise(num)
}
