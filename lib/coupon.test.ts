import { describe, it, expect } from 'vitest'
import { checkCoupon } from './coupon'
import type { Coupon } from '@/types'

const baseCoupon: Coupon = {
  id: '1',
  code: 'SALE20',
  discount_type: 'percent',
  discount_value: 20,
  min_order_amount: 0,
  max_discount_amount: null,
  starts_at: null,
  ends_at: null,
  usage_limit: null,
  used_count: 0,
  is_active: true,
  created_at: new Date().toISOString(),
}

describe('checkCoupon', () => {
  it('tính đúng giảm giá theo %', () => {
    const result = checkCoupon(baseCoupon, 500_000)
    expect(result).toEqual({ ok: true, discount_amount: 100_000 })
  })

  it('tính đúng giảm giá số tiền cố định', () => {
    const result = checkCoupon({ ...baseCoupon, discount_type: 'fixed', discount_value: 50_000 }, 500_000)
    expect(result).toEqual({ ok: true, discount_amount: 50_000 })
  })

  it('giảm % bị chặn ở max_discount_amount', () => {
    const result = checkCoupon({ ...baseCoupon, max_discount_amount: 30_000 }, 1_000_000)
    // 20% của 1tr = 200k, nhưng bị chặn ở 30k
    expect(result).toEqual({ ok: true, discount_amount: 30_000 })
  })

  it('không bao giờ giảm quá tiền hàng (mã fixed lớn hơn subtotal)', () => {
    const result = checkCoupon({ ...baseCoupon, discount_type: 'fixed', discount_value: 999_000 }, 100_000)
    expect(result).toEqual({ ok: true, discount_amount: 100_000 })
  })

  it('từ chối mã đã tắt', () => {
    const result = checkCoupon({ ...baseCoupon, is_active: false }, 500_000)
    expect(result.ok).toBe(false)
  })

  it('từ chối khi chưa tới ngày bắt đầu', () => {
    const result = checkCoupon({ ...baseCoupon, starts_at: new Date(Date.now() + 86_400_000).toISOString() }, 500_000)
    expect(result.ok).toBe(false)
  })

  it('từ chối khi đã hết hạn', () => {
    const result = checkCoupon({ ...baseCoupon, ends_at: new Date(Date.now() - 86_400_000).toISOString() }, 500_000)
    expect(result.ok).toBe(false)
  })

  it('từ chối khi đã hết lượt dùng', () => {
    const result = checkCoupon({ ...baseCoupon, usage_limit: 5, used_count: 5 }, 500_000)
    expect(result.ok).toBe(false)
  })

  it('cho phép dùng khi còn đúng 1 lượt cuối', () => {
    const result = checkCoupon({ ...baseCoupon, usage_limit: 5, used_count: 4 }, 500_000)
    expect(result.ok).toBe(true)
  })

  it('từ chối khi chưa đạt đơn tối thiểu', () => {
    const result = checkCoupon({ ...baseCoupon, min_order_amount: 1_000_000 }, 500_000)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('1.000.000')
  })

  it('cho phép khi đạt đúng đơn tối thiểu', () => {
    const result = checkCoupon({ ...baseCoupon, min_order_amount: 500_000 }, 500_000)
    expect(result.ok).toBe(true)
  })
})
