import { prisma } from './db'

export async function createAuditLog(params: {
  action: string
  entityType: string
  entityId: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  reason?: string
  userId: string
  businessId?: string
}): Promise<void> {
  try {
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
  } catch {
    // Audit logging should never break the main operation
  }
}

export function diffFields(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields: string[]
): { old: Record<string, unknown>; new: Record<string, unknown> } | null {
  const oldDiff: Record<string, unknown> = {}
  const newDiff: Record<string, unknown> = {}
  let hasChanges = false
  for (const f of fields) {
    const o = oldObj[f] ?? null
    const n = newObj[f] ?? null
    if (String(o) !== String(n)) {
      oldDiff[f] = o
      newDiff[f] = n
      hasChanges = true
    }
  }
  return hasChanges ? { old: oldDiff, new: newDiff } : null
}
