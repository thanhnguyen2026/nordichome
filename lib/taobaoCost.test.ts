import { describe, it, expect } from 'vitest'
import { calcTaobaoCost } from './taobaoCost'

describe('calcTaobaoCost', () => {
  it('tính đúng giá vốn từ giá Taobao + phí + ship', () => {
    const result = calcTaobaoCost({
      priceCny: 20,
      weightKg: 0.5,
      exchangeRate: 3650,
      feePercent: 3,
      shippingPerKg: 25000,
    })
    // 20 * 3650 * 1.03 + 25000 * 0.5 = 75190 + 12500 = 87690 → làm tròn 1.000đ = 88000
    expect(result).toBe(88000)
  })

  it('bỏ qua ship khi cân nặng bằng 0', () => {
    const result = calcTaobaoCost({
      priceCny: 10,
      weightKg: 0,
      exchangeRate: 3650,
      feePercent: 0,
      shippingPerKg: 25000,
    })
    // 10 * 3650 = 36500 → làm tròn 1.000đ gần nhất = 37000
    expect(result).toBe(37000)
  })
})
