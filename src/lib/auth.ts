import { prisma } from './db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { Role } from './constants'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS || '24')

export interface SessionPayload {
  sessionId: string
  userId: string
  role: Role
}

export interface AuthUser {
  id: string
  username: string
  fullName: string
  role: Role
  isActive: boolean
  mustChangePassword: boolean
  activeBusinessId: string | null
  businessIds: string[]
  villageIds: string[]
  ownerId: string | null
  organizationName: string | null
  preferredLanguage: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SESSION_EXPIRY_HOURS}h` })
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(
  userId: string,
  role: Role,
  activeBusinessId?: string
): Promise<string> {
  const expiresAt = new Date()
  if (role === Role.OWNER) {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  } else {
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS)
  }

  const session = await prisma.session.create({
    data: {
      userId,
      token: crypto.randomUUID(),
      activeBusinessId: activeBusinessId || null,
      expiresAt,
    },
  })

  const token = signToken({
    sessionId: session.id,
    userId,
    role,
  })

  return token
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: {
      user: {
        include: {
          businessAssignments: true,
          villageAssignments: true,
          ownedBusinesses: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!session) return null
  if (new Date() > session.expiresAt) return null
  if (!session.user.isActive) return null

  if (session.user.role !== 'OWNER') {
    const autoLogoutMs = 30 * 60 * 1000
    const inactiveMs = Date.now() - session.lastActivityAt.getTime()
    if (inactiveMs > autoLogoutMs) {
      await prisma.session.delete({ where: { id: session.id } })
      return null
    }
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastActivityAt: new Date() },
  })

  const user = session.user
  const businessIds =
    user.role === Role.OWNER
      ? user.ownedBusinesses.map((b) => b.id)
      : user.businessAssignments.map((a) => a.businessId)

  let ownerId: string | null = null
  let organizationName: string | null = null
  if (user.role === Role.OWNER) {
    ownerId = user.id
    organizationName = user.organizationName || user.ownedBusinesses[0]?.name || null
  } else if (
    user.role === Role.BUSINESS_ADMIN ||
    user.role === Role.AGENT
  ) {
    if (businessIds.length > 0) {
      const biz = await prisma.business.findFirst({
        where: { id: businessIds[0] },
        select: { ownerId: true, owner: { select: { organizationName: true } } },
      })
      ownerId = biz?.ownerId || null
      organizationName = biz?.owner?.organizationName || null
    }
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role as Role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    activeBusinessId: session.activeBusinessId,
    businessIds,
    villageIds: user.villageAssignments.map((a) => a.villageId),
    ownerId,
    organizationName,
    preferredLanguage: user.preferredLanguage || 'en',
  }
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
}

export async function setActiveBusiness(
  sessionId: string,
  businessId: string
): Promise<void> {
  const payload = await getSessionPayloadFromCookie()
  if (!payload) return

  await prisma.session.update({
    where: { id: payload.sessionId },
    data: { activeBusinessId: businessId },
  })
}

async function getSessionPayloadFromCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  return verifyToken(token)
}
