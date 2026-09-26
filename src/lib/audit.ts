import { prisma } from './db'

export async function createAuditLog(params: {
  action: string
  entityType: string
  entityId: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  reason?: string
  userId: string
  businessId: string
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValues: params.oldValues ? JSON.stringify(params.oldValues) : null,
      newValues: params.newValues ? JSON.stringify(params.newValues) : null,
      reason: params.reason,
      userId: params.userId,
      businessId: params.businessId,
    },
  })
}
