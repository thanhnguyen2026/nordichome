import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAdminUser } from '@/lib/adminAuth'

// Admin duyệt/ẩn 1 đánh giá + phản hồi. Chỉ cho sửa status và admin_reply — không
// cho sửa nội dung/điểm của khách (giữ tính toàn vẹn của đánh giá gốc).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 })

  const patch: { status?: string; admin_reply?: string | null } = {}

  if (body.status !== undefined) {
    if (!['pending', 'approved', 'rejected'].includes(body.status)) {
      return NextResponse.json({ error: 'Trạng thái không hợp lệ' }, { status: 400 })
    }
    patch.status = body.status
  }
  if (body.admin_reply !== undefined) {
    patch.admin_reply = String(body.admin_reply || '').trim() || null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('reviews').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// Xoá hẳn 1 đánh giá (dùng khi cần dọn spam rõ ràng, không chỉ ẩn).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const { id } = await params
  const { error } = await supabaseAdmin.from('reviews').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
