import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { assertPermission(user, 'manage_registration_requests') } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.trim()

  const where: Record<string, unknown> = {}
  if (status && status !== 'ALL') {
    where.status = status
  }

  if (search) {
    where.OR = [
      { fullName: { contains: search } },
      { username: { contains: search } },
      { phone: { contains: search } },
      { businessName: { contains: search } },
    ]
  }

  const requests = await prisma.registrationRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  const phones = requests.map((r) => r.phone)
  const duplicatePhones = new Set<string>()

  if (phones.length > 0) {
    const phoneCounts = new Map<string, number>()
    for (const p of phones) {
      phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1)
    }
    phoneCounts.forEach((count, p) => {
      if (count > 1) duplicatePhones.add(p)
    })

    const existingUsers = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { phone: true },
    })
    for (const u of existingUsers) {
      if (u.phone) duplicatePhones.add(u.phone)
    }
  }

  const result = requests.map((r) => ({
    ...r,
    villages: JSON.parse(r.villages),
    duplicatePhone: duplicatePhones.has(r.phone),
  }))

  return NextResponse.json(result)
}
