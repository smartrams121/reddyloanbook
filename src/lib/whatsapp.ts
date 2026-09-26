import { formatPaiseShort } from './money'
import { formatDateDisplay } from './date'

export function buildWhatsAppUrl(
  phone: string,
  template: string,
  data: {
    businessName: string
    amount: number  // paise
    date: string    // YYYY-MM-DD
    outstanding: number // paise
    customerName?: string
    receiptNumber?: string
  }
): string {
  const message = template
    .replace('{{businessName}}', data.businessName)
    .replace('{{amount}}', formatPaiseShort(data.amount))
    .replace('{{date}}', formatDateDisplay(data.date))
    .replace('{{outstanding}}', formatPaiseShort(data.outstanding))
    .replace('{{customerName}}', data.customerName || '')
    .replace('{{receiptNumber}}', data.receiptNumber || '')

  const fullPhone = phone.startsWith('+91') ? phone : `+91${phone}`
  return `https://wa.me/${fullPhone.replace('+', '')}?text=${encodeURIComponent(message)}`
}
