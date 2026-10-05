import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@/lib/constants'
import { z } from 'zod'

const schema = z.object({
  language: z.enum(['en', 'te']),
})

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (user.role === Role.PLATFORM_ADMIN) {
      return NextResponse.json({ error: 'Platform Admin language is always English' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { preferredLanguage: parsed.data.language },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Language update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
