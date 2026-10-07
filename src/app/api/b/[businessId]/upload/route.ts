import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { assertBusinessAccess } from '@/lib/scope'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

interface Props {
  params: Promise<{ businessId: string }>
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf']

function getUploadBase() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads')
}

export async function POST(request: Request, { params }: Props) {
  const { businessId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertBusinessAccess(user, businessId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }

  const url = new URL(request.url)
  const type = url.searchParams.get('type') || 'photo'

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (type === 'document') {
    if (!DOCUMENT_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only images and PDF files are allowed' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }
  } else {
    if (!IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filename = `${crypto.randomUUID()}.${ext}`
  const subDir = type === 'document' ? 'documents' : 'customers'
  const uploadDir = path.join(getUploadBase(), subDir)

  await mkdir(uploadDir, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(uploadDir, filename), buffer)

  const filePath = `/uploads/${subDir}/${filename}`

  if (type === 'document') {
    return NextResponse.json({
      filePath,
      originalName: file.name,
      mimeType: file.type,
    }, { status: 201 })
  }

  return NextResponse.json({ photoPath: filePath }, { status: 201 })
}
