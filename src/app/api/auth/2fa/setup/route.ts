import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'

export async function POST() {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secret = authenticator.generateSecret()

  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: secret },
  })

  const otpauth = authenticator.keyuri(user.username, 'DailyFinance', secret)
  const qrDataUrl = await QRCode.toDataURL(otpauth)

  return NextResponse.json({ secret, qrDataUrl })
}
