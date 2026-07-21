import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAdminUser } from '@/lib/adminAuth'

// Danh sách đánh giá cho trang duyệt của admin — trả VỀ ĐỦ cột (gồm author_phone,
// status) qua service role, khác hẳn endpoint public phía khách. Bảng reviews bật
// RLS chỉ cho anon đọc dòng 'approved', nên admin bắt buộc đi qua route này (không
// đọc trực tiếp bằng anon client như các trang admin khác).
export async function GET(req: NextRequest) {
  const user = await getAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status') // 'pending' | 'approved' | 'rejected' | null(=tất cả)

  let query = supabaseAdmin
    .from('reviews')
    .select('id, product_id, author_name, author_phone, rating, comment, images, is_verified_purchase, status, admin_reply, created_at, products(name, slug)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reviews: data ?? [] })
}
