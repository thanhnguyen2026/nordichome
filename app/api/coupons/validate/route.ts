import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkCoupon } from '@/lib/coupon'
import type { Coupon } from '@/types'

// Endpoint riêng cho khách xem trước mức giảm lúc nhập mã ở checkout — không
// cho khách SELECT thẳng bảng coupons (RLS chỉ cấp cho authenticated), tránh
// lộ toàn bộ danh sách mã đang có. Đơn hàng vẫn re-validate lại ở /api/orders
// vì subtotal có thể đổi giữa lúc áp mã và lúc bấm đặt hàng.
export async function POST(req: NextRequest) {
  const { code, subtotal } = await req.json()

  if (!code || typeof subtotal !== 'number') {
    return NextResponse.json({ error: 'Thiếu mã giảm giá hoặc tổng tiền' }, { status: 400 })
  }

  const { data: coupon } = await supabaseAdmin
    .from('coupons')
    .select('*')
    .ilike('code', code.trim())
    .maybeSingle<Coupon>()

  if (!coupon) {
    return NextResponse.json({ error: 'Mã giảm giá không tồn tại' }, { status: 404 })
  }

  const result = checkCoupon(coupon, subtotal)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    code: coupon.code,
    discount_amount: result.discount_amount,
  })
}
