import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { readFile, stat } from 'fs/promises'
import path from 'path'

interface Props {
  params: Promise<{ path: string[] }>
}

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
}

function getUploadBase() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads')
}

export async function GET(_request: Request, { params }: Props) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const segments = (await params).path
  const safePath = segments.map(s => s.replace(/[^a-zA-Z0-9._-]/g, '')).join('/')
  const filePath = path.join(getUploadBase(), safePath)

  if (!filePath.startsWith(getUploadBase())) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  try {
    await stat(filePath)
    const buffer = await readFile(filePath)
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
