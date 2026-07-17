import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getClientIp, rateLimit } from '@/lib/rateLimit'

// Dành cho khách quên mã đơn hàng — tra bằng số điện thoại đã đặt. Chỉ trả về
// thông tin tối thiểu (không có địa chỉ) vì đây là endpoint public không yêu cầu
// mã đơn để xác thực; muốn xem chi tiết đầy đủ vẫn phải vào đúng mã đơn.
//
// Rủi ro còn lại (chấp nhận được ở quy mô hiện tại, cần biết): endpoint này chỉ
// cần SĐT là lấy được mã đơn, mà mã đơn + SĐT lại là đủ để xem địa chỉ đầy đủ ở
// /orders/[code] — nghĩa là ai biết SĐT của một người là tra ra được đơn + địa
// chỉ của người đó, không cần xác thực gì thêm. Rate-limit chặt ở đây làm chậm
// việc dò hàng loạt nhiều SĐT khác nhau, nhưng không loại bỏ được rủi ro với
// MỘT SĐT cụ thể mà kẻ xấu đã biết trước. Muốn đóng hẳn lỗ hổng này cần thêm một
// lớp xác thực thật (OTP gửi SMS/email) — nằm ngoài phạm vi một lần siết nhanh.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  if (!rateLimit(`lookup-phone:${ip}`, 5, 5 * 60_000)) {
    return NextResponse.json({ error: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút' }, { status: 429 })
  }

  const { phone } = await req.json()
  const p = (phone || '').trim()

  if (!p) return NextResponse.json({ error: 'Thiếu số điện thoại' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('order_code, created_at, status, total')
    .eq('customer_phone', p)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ orders: data ?? [] })
}
