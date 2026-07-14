import type { Coupon } from '@/types'

// .ilike() coi %, _ là ký tự đại diện — nếu không escape, khách gửi code
// dạng "%" hoặc "SALE%" có thể khớp bừa vào 1 mã bất kỳ thay vì đúng y hệt
// mã đó, lộ ra mã giảm giá không định cho public dùng. Escape \ trước tiên
// (kẻo bị hiểu là ký tự escape), rồi mới escape % và _.
export function escapeLikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export type CouponCheckResult =
  | { ok: true; discount_amount: number }
  | { ok: false; error: string }

// Dùng chung cho /api/coupons/validate (xem trước lúc khách nhập mã) và
// /api/orders (chốt đơn) — validate lại ở cả 2 nơi vì giỏ hàng/subtotal có
// thể đổi giữa lúc khách áp mã và lúc bấm đặt hàng.
export function checkCoupon(coupon: Coupon, subtotal: number): CouponCheckResult {
  if (!coupon.is_active) return { ok: false, error: 'Mã giảm giá không còn hiệu lực' }

  const now = Date.now()
  if (coupon.starts_at && now < new Date(coupon.starts_at).getTime()) {
    return { ok: false, error: 'Mã giảm giá chưa bắt đầu áp dụng' }
  }
  if (coupon.ends_at && now > new Date(coupon.ends_at).getTime()) {
    return { ok: false, error: 'Mã giảm giá đã hết hạn' }
  }
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    return { ok: false, error: 'Mã giảm giá đã hết lượt sử dụng' }
  }
  if (subtotal < coupon.min_order_amount) {
    return { ok: false, error: `Đơn hàng cần tối thiểu ${Math.round(coupon.min_order_amount).toLocaleString('vi-VN')}₫ để áp dụng mã này` }
  }

  const raw = coupon.discount_type === 'percent'
    ? subtotal * (coupon.discount_value / 100)
    : coupon.discount_value

  const capped = coupon.discount_type === 'percent' && coupon.max_discount_amount != null
    ? Math.min(raw, coupon.max_discount_amount)
    : raw

  // Không bao giờ giảm quá tiền hàng
  const discount_amount = Math.round(Math.min(capped, subtotal))

  return { ok: true, discount_amount }
}
