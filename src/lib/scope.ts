import { prisma } from './db'
import type { AuthUser } from './auth'
import { Role } from './constants'

export class ScopeError extends Error {
  constructor(message = 'Access denied') {
    super(message)
    this.name = 'ScopeError'
  }
}

export async function assertBusinessAccess(
  user: AuthUser,
  businessId: string
): Promise<void> {
  if (user.role === Role.PLATFORM_ADMIN) {
    const access = await prisma.supportAccess.findFirst({
      where: {
        adminId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        owner: {
          include: {
            ownedBusinesses: { where: { id: businessId }, select: { id: true } },
          },
        },
      },
    })
    if (!access || access.owner.ownedBusinesses.length === 0) {
      throw new ScopeError()
    }
    return
  }

  if (user.role === Role.OWNER) {
    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: user.id },
      select: { id: true },
    })
    if (!business) throw new ScopeError()
    return
  }

  if (!user.businessIds.includes(businessId)) {
    throw new ScopeError()
  }
}

export async function assertVillageAccess(
  user: AuthUser,
  villageId: string
): Promise<void> {
  if (user.role === Role.AGENT) {
    if (!user.villageIds.includes(villageId)) {
      throw new ScopeError()
    }
  }
}

export function businessWhere(
  user: AuthUser,
  businessId: string
): { businessId: string } {
  return { businessId }
}

export async function getAccessibleBusinessIds(
  user: AuthUser
): Promise<string[]> {
  if (user.role === Role.PLATFORM_ADMIN) {
    const accesses = await prisma.supportAccess.findMany({
      where: {
        adminId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        owner: {
          include: {
            ownedBusinesses: { select: { id: true } },
          },
        },
      },
    })
    return accesses.flatMap((a) => a.owner.ownedBusinesses.map((b) => b.id))
  }

  if (user.role === Role.OWNER) {
    const businesses = await prisma.business.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    })
    return businesses.map((b) => b.id)
  }

  return user.businessIds
}

export async function getAccessibleVillageIds(
  user: AuthUser,
  businessId: string
): Promise<string[] | 'all'> {
  if (user.role === Role.AGENT) {
    const villages = await prisma.village.findMany({
      where: {
        businessId,
        id: { in: user.villageIds },
        isActive: true,
      },
      select: { id: true },
    })
    return villages.map((v) => v.id)
  }
  return 'all'
}

export function villageFilter(
  accessibleVillageIds: string[] | 'all'
): object | undefined {
  if (accessibleVillageIds === 'all') return undefined
  return { villageId: { in: accessibleVillageIds } }
}
