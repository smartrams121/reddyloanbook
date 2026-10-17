import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024

function getUploadBase() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads')
}

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  if (!IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid image type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
  }

  const ext = path.extname(file.name || '.jpg')
  const fileName = `${crypto.randomUUID()}${ext}`
  const dir = path.join(getUploadBase(), 'profiles')
  fs.mkdirSync(dir, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(path.join(dir, fileName), buffer)

  const photoPath = `/uploads/profiles/${fileName}`
  await prisma.user.update({ where: { id: user.id }, data: { photoPath } })

  return NextResponse.json({ photoPath })
}

export async function DELETE() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { photoPath: true } })
  if (dbUser?.photoPath) {
    const filePath = path.join(getUploadBase(), dbUser.photoPath.replace('/uploads/', ''))
    try { fs.unlinkSync(filePath) } catch {}
    await prisma.user.update({ where: { id: user.id }, data: { photoPath: null } })
  }

  return NextResponse.json({ ok: true })
}
