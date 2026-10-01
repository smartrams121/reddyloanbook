import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, hashPassword } from '@/lib/auth'
import { passwordSchema } from '@/lib/validators'
import { Role } from '@/lib/constants'

export async function POST(request: NextRequest) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { newPassword } = await request.json()

  const result = passwordSchema.safeParse(newPassword)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0].message },
      { status: 400 }
    )
  }

  const passwordHash = await hashPassword(newPassword)

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  })

  return NextResponse.json({ success: true, redirectTo: '/dashboard' })
}
