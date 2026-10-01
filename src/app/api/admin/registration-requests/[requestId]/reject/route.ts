import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'
import { rejectRegistrationSchema } from '@/lib/validators'

interface Props {
  params: Promise<{ requestId: string }>
}

export async function POST(request: Request, { params }: Props) {
  const { requestId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { assertPermission(user, 'manage_registration_requests') } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const body = await request.json()
  const parsed = rejectRegistrationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
  }

  const regRequest = await prisma.registrationRequest.findUnique({ where: { id: requestId } })
  if (!regRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (regRequest.status !== 'PENDING') {
    return NextResponse.json({ error: 'Only pending requests can be rejected' }, { status: 400 })
  }

  await prisma.registrationRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      rejectionReason: parsed.data.reason,
      reviewedBy: user.id,
      reviewedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true })
}
