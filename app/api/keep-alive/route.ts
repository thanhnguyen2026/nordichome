import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase gói miễn phí tự tạm dừng (pause) dự án nếu ~7 ngày không có hoạt
// động — khi đó cả web lẫn admin "mất sạch" dữ liệu vì không kết nối được DB.
// Vercel Cron (xem vercel.json) gọi route này mỗi ngày một lần, đọc nhẹ 1 dòng
// để dự án luôn được tính là đang hoạt động. Chỉ đọc, không ghi gì.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Vercel tự gửi "Authorization: Bearer <CRON_SECRET>" khi biến này được đặt.
  // Nếu chưa đặt thì vẫn chạy được — route chỉ đọc 1 id sản phẩm công khai.
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { error } = await supabase.from('products').select('id').limit(1)
  if (error) {
    console.error('[keep-alive] Supabase query failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() })
}
