import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPermission } from '@/lib/permissions'

interface Props {
  params: Promise<{ requestId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { requestId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { assertPermission(user, 'manage_registration_requests') } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const regRequest = await prisma.registrationRequest.findUnique({ where: { id: requestId } })
  if (!regRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...regRequest, villages: JSON.parse(regRequest.villages) })
}

export async function DELETE(request: Request, { params }: Props) {
  const { requestId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { assertPermission(user, 'manage_registration_requests') } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const regRequest = await prisma.registrationRequest.findUnique({ where: { id: requestId } })
  if (!regRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (regRequest.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Only rejected requests can be deleted' }, { status: 400 })
  }

  await prisma.registrationRequest.delete({ where: { id: requestId } })

  return NextResponse.json({ success: true })
}
