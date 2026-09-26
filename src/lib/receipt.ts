import { prisma } from './db'

export async function nextReceiptNumber(businessId: string): Promise<string> {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: { receiptSeq: { increment: 1 } },
    select: { receiptPrefix: true, receiptSeq: true },
  })

  const prefix = business.receiptPrefix || 'REC'
  return `${prefix}-${String(business.receiptSeq).padStart(5, '0')}`
}

export async function nextLoanNumber(businessId: string): Promise<string> {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: { loanSeq: { increment: 1 } },
    select: { receiptPrefix: true, loanSeq: true },
  })

  const prefix = business.receiptPrefix || 'LN'
  return `${prefix}-L${String(business.loanSeq).padStart(5, '0')}`
}

export async function nextCustomerId(businessId: string): Promise<string> {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: { customerSeq: { increment: 1 } },
    select: { receiptPrefix: true, customerSeq: true },
  })

  const prefix = business.receiptPrefix || 'CUS'
  return `${prefix}-C${String(business.customerSeq).padStart(4, '0')}`
}
