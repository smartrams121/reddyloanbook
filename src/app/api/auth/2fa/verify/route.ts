import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { authenticator } from 'otplib'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { code } = await request.json()

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpSecret: true },
  })

  if (!dbUser?.totpSecret) {
    return NextResponse.json({ error: 'TOTP not set up' }, { status: 400 })
  }

  const isValid = authenticator.verify({
    token: code,
    secret: dbUser.totpSecret,
  })

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid code. Try again.' }, { status: 400 })
  }

  const recoveryCodes: string[] = []
  for (let i = 0; i < 8; i++) {
    recoveryCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase())
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true },
  })

  await prisma.recoveryCode.deleteMany({ where: { userId: user.id } })
  await prisma.recoveryCode.createMany({
    data: recoveryCodes.map((code) => ({
      userId: user.id,
      code,
    })),
  })

  return NextResponse.json({ success: true, recoveryCodes })
}
