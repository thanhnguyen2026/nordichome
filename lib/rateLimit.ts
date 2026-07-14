// Giới hạn tần suất gọi cho các API public không yêu cầu đăng nhập (tra cứu
// đơn theo SĐT, kiểm tra mã giảm giá, tạo đơn...) — chặn dò quét/brute-force
// hàng loạt. Lưu đếm trong bộ nhớ tiến trình (reset khi restart, không chia
// sẻ giữa nhiều instance) — đủ dùng ở quy mô 1 server hiện tại của shop.
const buckets = new Map<string, { count: number; resetAt: number }>()

// Nhận thẳng Headers thay vì NextRequest — dùng được cả trong Route Handler
// (req.headers) lẫn Server Component (await headers() từ next/headers), vì
// trang tra cứu đơn hàng theo mã+SĐT là Server Component, không có NextRequest.
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
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

// Chống dò mật khẩu đăng nhập admin — chỉ làm chậm các lần gõ SAI liên tiếp,
// KHÔNG bao giờ chặn mật khẩu đúng (kể cả đang trong lúc bị tạm khoá do trước
// đó gõ sai), nên admin gõ nhầm nhiều lần vẫn luôn vào được ngay khi nhớ ra
// mật khẩu — không có rủi ro tự khoá mình ra ngoài.
const failedLogins = new Map<string, { count: number; lockedUntil: number }>()
const MAX_FAILED_LOGINS = 5
const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60_000

export function isLoginLocked(key: string): boolean {
  const entry = failedLogins.get(key)
  if (!entry) return false
  if (Date.now() > entry.lockedUntil) {
    failedLogins.delete(key)
    return false
  }
  return entry.count >= MAX_FAILED_LOGINS
}

export function recordFailedLogin(key: string): void {
  const now = Date.now()
  const entry = failedLogins.get(key)
  if (!entry || now > entry.lockedUntil) {
    failedLogins.set(key, { count: 1, lockedUntil: now + LOGIN_LOCKOUT_WINDOW_MS })
  } else {
    entry.count++
  }
}

export function resetLoginAttempts(key: string): void {
  failedLogins.delete(key)
}
