import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Ảnh gốc từ điện thoại/máy ảnh thường 10-20MB, khiến next/image optimizer
// timeout ngẫu nhiên (500) khi resize lúc runtime. Nén ngay lúc upload để
// tránh lặp lại vấn đề này với mọi ảnh admin thêm sau này.
const MAX_DIMENSION = 2000

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const inputBuffer = Buffer.from(await file.arrayBuffer())
  const isImage = file.type.startsWith('image/')

  let buffer: Buffer = inputBuffer
  let contentType = file.type
  let ext = file.name.split('.').pop() || 'bin'

  if (isImage && file.type !== 'image/svg+xml') {
    buffer = await sharp(inputBuffer)
      .rotate() // áp dụng EXIF orientation rồi bỏ metadata gốc
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    contentType = 'image/jpeg'
    ext = 'jpg'
  }

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabaseAdmin.storage
    .from('images').upload(filename, buffer, { contentType })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabaseAdmin.storage.from('images').getPublicUrl(filename)
  return NextResponse.json({ url: data.publicUrl })
}