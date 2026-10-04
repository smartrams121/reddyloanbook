export interface IdConfig {
  format: string   // 'NUMERIC' | 'STRING'
  prefix: string   // e.g. 'CUS', 'VF', '' (blank)
  padding: number  // zero-pad width for STRING format
  start: number
  max: number
}

export function generateId(config: IdConfig, seq: number): string {
  const { format, prefix, padding } = config
  if (format === 'STRING') {
    const padded = String(seq).padStart(padding, '0')
    return prefix ? `${prefix}-${padded}` : padded
  }
  // NUMERIC
  return prefix ? `${prefix}-${seq}` : String(seq)
}

export function parseNumericPart(id: string, prefix: string): number | null {
  if (prefix && id.startsWith(prefix + '-')) {
    const num = parseInt(id.slice(prefix.length + 1))
    return isNaN(num) ? null : num
  }
  const num = parseInt(id)
  return isNaN(num) ? null : num
}

export function matchesFormat(id: string, config: IdConfig): boolean {
  if (config.format === 'NUMERIC') {
    if (config.prefix) return /^\d+$/.test(id.replace(config.prefix + '-', ''))
    return /^\d+$/.test(id)
  }
  // STRING — check if it's zero-padded
  if (config.prefix) {
    if (!id.startsWith(config.prefix + '-')) return false
    const rest = id.slice(config.prefix.length + 1)
    return rest.length === config.padding && /^\d+$/.test(rest)
  }
  return id.length === config.padding && /^\d+$/.test(id)
}

export function getCustomerIdConfig(business: {
  customerIdFormat: string; customerIdPrefix: string
  customerIdPadding: number; customerIdStart: number; customerIdMax: number
}): IdConfig {
  return {
    format: business.customerIdFormat,
    prefix: business.customerIdPrefix,
    padding: business.customerIdPadding,
    start: business.customerIdStart,
    max: business.customerIdMax,
  }
}

export function getLoanIdConfig(business: {
  loanIdFormat: string; loanIdPrefix: string
  loanIdPadding: number; loanIdStart: number; loanIdMax: number
}): IdConfig {
  return {
    format: business.loanIdFormat,
    prefix: business.loanIdPrefix,
    padding: business.loanIdPadding,
    start: business.loanIdStart,
    max: business.loanIdMax,
  }
}

export function getReceiptIdConfig(business: {
  receiptIdFormat: string; receiptIdPrefix: string
  receiptIdPadding: number; receiptIdStart: number; receiptIdMax: number
}): IdConfig {
  return {
    format: business.receiptIdFormat,
    prefix: business.receiptIdPrefix,
    padding: business.receiptIdPadding,
    start: business.receiptIdStart,
    max: business.receiptIdMax,
  }
}
