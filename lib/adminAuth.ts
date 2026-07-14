import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

// Các route /api/admin/** và /api/upload không nằm trong matcher của proxy.ts
// (chỉ chặn trang /admin/*), nên phải tự xác thực phiên đăng nhập Supabase ở
// từng route bằng hàm dùng chung này.
export async function getAdminUser(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
