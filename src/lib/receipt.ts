import { prisma } from './db'
import { generateId, getCustomerIdConfig, getLoanIdConfig, getReceiptIdConfig } from './id-generator'

export async function nextReceiptNumber(businessId: string): Promise<string> {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: { receiptSeq: { increment: 1 } },
    select: {
      receiptSeq: true,
      receiptIdFormat: true, receiptIdPrefix: true, receiptIdPadding: true,
      receiptIdStart: true, receiptIdMax: true,
    },
  })

  const config = getReceiptIdConfig(business)
  const seq = Math.max(business.receiptSeq, config.start)
  return generateId(config, seq)
}

export async function nextLoanNumber(businessId: string): Promise<string> {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: { loanSeq: { increment: 1 } },
    select: {
      loanSeq: true,
      loanIdFormat: true, loanIdPrefix: true, loanIdPadding: true,
      loanIdStart: true, loanIdMax: true,
    },
  })

  const config = getLoanIdConfig(business)
  const seq = Math.max(business.loanSeq, config.start)
  return generateId(config, seq)
}

export async function nextCustomerId(businessId: string): Promise<string> {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: { customerSeq: { increment: 1 } },
    select: {
      customerSeq: true,
      customerIdFormat: true, customerIdPrefix: true, customerIdPadding: true,
      customerIdStart: true, customerIdMax: true,
    },
  })

  const config = getCustomerIdConfig(business)
  const seq = Math.max(business.customerSeq, config.start)
  return generateId(config, seq)
}
