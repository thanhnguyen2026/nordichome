import type { NextRequest } from 'next/server'

// Giới hạn tần suất gọi cho các API public không yêu cầu đăng nhập (tra cứu
// đơn theo SĐT, kiểm tra mã giảm giá) — chặn dò quét/brute-force hàng loạt.
// Lưu đếm trong bộ nhớ tiến trình (reset khi restart, không chia sẻ giữa
// nhiều instance) — đủ dùng ở quy mô 1 server hiện tại của shop.
const buckets = new Map<string, { count: number; resetAt: number }>()

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || 'unknown'
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= limit) return false

  bucket.count++
  return true
}
