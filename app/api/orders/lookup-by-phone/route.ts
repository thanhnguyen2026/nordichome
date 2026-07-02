import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Dành cho khách quên mã đơn hàng — tra bằng số điện thoại đã đặt. Chỉ trả về
// thông tin tối thiểu (không có địa chỉ) vì đây là endpoint public không yêu cầu
// mã đơn để xác thực; muốn xem chi tiết đầy đủ vẫn phải vào đúng mã đơn.
export async function POST(req: NextRequest) {
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
