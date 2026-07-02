import { describe, it, expect } from 'vitest'
import { roundUpToHalfKg, calcTotalWeight } from './shipping'

describe('roundUpToHalfKg', () => {
  it('làm tròn lên bội số 0.5 gần nhất', () => {
    expect(roundUpToHalfKg(0.1)).toBe(0.5)
    expect(roundUpToHalfKg(0.5)).toBe(0.5)
    expect(roundUpToHalfKg(0.6)).toBe(1)
    expect(roundUpToHalfKg(1.5)).toBe(1.5)
    expect(roundUpToHalfKg(0)).toBe(0)
  })
})

describe('calcTotalWeight', () => {
  it('cộng dồn cân nặng theo số lượng, mặc định 0.5kg nếu sản phẩm không khai cân nặng', () => {
    const { totalWeight } = calcTotalWeight([
      { product: { weight: 0.4 }, quantity: 2 },
      { product: {}, quantity: 1 }, // không có weight → mặc định 0.5
    ])
    // 0.4*2 + 0.5 = 1.3 → làm tròn lên 1.5
    expect(totalWeight).toBe(1.5)
  })

  it('hasBulky = false khi không có sản phẩm nào đánh dấu cồng kềnh', () => {
    const { hasBulky } = calcTotalWeight([
      { product: { weight: 1, is_bulky: false }, quantity: 1 },
    ])
    expect(hasBulky).toBe(false)
  })

  it('hasBulky = true nếu BẤT KỲ sản phẩm nào trong giỏ được đánh dấu cồng kềnh', () => {
    const { hasBulky } = calcTotalWeight([
      { product: { weight: 0.5, is_bulky: false }, quantity: 1 },
      { product: { weight: 20, is_bulky: true }, quantity: 1 },
    ])
    expect(hasBulky).toBe(true)
  })

  it('giỏ hàng rỗng trả về 0kg, không cồng kềnh', () => {
    const { totalWeight, hasBulky } = calcTotalWeight([])
    expect(totalWeight).toBe(0)
    expect(hasBulky).toBe(false)
  })
})
