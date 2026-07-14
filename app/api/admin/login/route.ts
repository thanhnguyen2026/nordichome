import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { getClientIp, isLoginLocked, recordFailedLogin, resetLoginAttempts } from '@/lib/rateLimit'

// Đăng nhập admin đi qua route này (thay vì gọi thẳng supabase.auth từ trình
// duyệt như trước) để có thể chặn dò mật khẩu theo IP — mật khẩu đúng luôn
// được vào ngay, chỉ các lần gõ sai liên tiếp mới bị làm chậm (xem lib/rateLimit.ts).
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password) {
    return NextResponse.json({ error: 'Thiếu email hoặc mật khẩu' }, { status: 400 })
  }

  // Quan trọng: kiểm tra khoá KHÔNG được chặn trước khi xác thực — phải luôn
  // thử xác thực thật trước, để mật khẩu đúng luôn vào được ngay kể cả đang
  // trong lúc bị tạm khoá do trước đó gõ sai. Chỉ chặn khi xác thực THẤT BẠI
  // và đang bị khoá.
  const ip = getClientIp(req.headers)
  const wasLocked = isLoginLocked(ip)

  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: toSet => { cookiesToSet.push(...toSet) },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (!error) {
    resetLoginAttempts(ip)
    const response = NextResponse.json({ ok: true })
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  }

  if (wasLocked) {
    return NextResponse.json({ error: 'Bạn thử sai quá nhiều lần, vui lòng thử lại sau ít phút' }, { status: 429 })
  }
  recordFailedLogin(ip)
  return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 })
}
