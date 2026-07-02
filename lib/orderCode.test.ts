import { describe, it, expect } from 'vitest'
import { generateOrderCode } from './orderCode'

describe('generateOrderCode', () => {
  it('có định dạng NH + YYMMDD + 4 ký tự random viết hoa', () => {
    const code = generateOrderCode(new Date('2026-07-02T10:00:00'))
    expect(code).toMatch(/^NH260702[A-Z0-9]{4}$/)
  })

  it('đổi ngày thì đổi phần YYMMDD tương ứng', () => {
    const code = generateOrderCode(new Date('2025-01-05T00:00:00'))
    expect(code.slice(0, 8)).toBe('NH250105')
  })

  it('sinh ra các mã khác nhau giữa các lần gọi (phần random không trùng lặp liên tiếp)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOrderCode()))
    // Khó tuyệt đối không trùng (random), nhưng với 20 lần thì gần như chắc chắn khác nhau
    expect(codes.size).toBeGreaterThan(15)
  })
})
