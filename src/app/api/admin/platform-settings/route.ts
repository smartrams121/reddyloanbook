import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'

const VALID_KEYS = ['contact_us', 'faq'] as const

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.platformSetting.findMany({
    where: { key: { in: [...VALID_KEYS] } },
  })

  const result: Record<string, unknown> = {}
  for (const s of settings) {
    try {
      result[s.key] = JSON.parse(s.value)
    } catch {
      result[s.key] = null
    }
  }

  return NextResponse.json(result)
}

export async function PUT(request: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { assertPermission(user, 'manage_platform_settings') } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const { key, value } = body

  if (!VALID_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }

  if (value === undefined || value === null) {
    return NextResponse.json({ error: 'Value is required' }, { status: 400 })
  }

  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value), updatedBy: user.id },
    update: { value: JSON.stringify(value), updatedBy: user.id },
  })

  return NextResponse.json({ success: true })
}
