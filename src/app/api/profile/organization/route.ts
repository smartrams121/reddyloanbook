import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@/lib/constants'
import { z } from 'zod'

const schema = z.object({
  organizationName: z.string().min(1).max(100),
})

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (user.role !== Role.OWNER && user.role !== Role.BUSINESS_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid organization name' }, { status: 400 })
    }

    const targetUserId = user.role === Role.OWNER ? user.id : user.ownerId
    if (!targetUserId) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

    await prisma.user.update({
      where: { id: targetUserId },
      data: { organizationName: parsed.data.organizationName },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Organization update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
