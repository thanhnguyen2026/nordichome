'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { Store } from 'lucide-react'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({})

  // Trang đăng nhập tải riêng (không nằm trong AdminLayout) nên phải tự lấy
  // logo/tên shop, thay vì để cứng logo mặc định không khớp thương hiệu thật.
  useEffect(() => {
    supabase.from('settings').select('key,value').then(({ data }) => {
      setSettings(Object.fromEntries(data?.map(r => [r.key, r.value || '']) ?? []))
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Đăng nhập thất bại'); setLoading(false); return }
    // Tải lại cả trang (không dùng router.push) để browser client Supabase
    // đọc lại cookie phiên vừa được server set — session được tạo qua API
    // route này, không qua supabase.auth trực tiếp trên client như trước.
    window.location.href = '/admin'
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md">
        <div className="text-center mb-8">
          {settings.logo_url ? (
            <Image src={settings.logo_url} alt="Logo" width={56} height={56}
              className="mx-auto mb-3 h-14 w-14 object-contain rounded-lg" />
          ) : (
            <div className="w-14 h-14 mx-auto mb-3 rounded-lg bg-stone-100 flex items-center justify-center">
              <Store size={26} className="text-stone-400" />
            </div>
          )}
          <h1 className="text-xl font-black">{settings.site_name || 'Nordic Home'} Admin</h1>
          <p className="text-stone-400 text-sm mt-1">Đăng nhập để quản lý cửa hàng</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-stone-600 block mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-stone-400"
              placeholder="you@example.com" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 block mb-1">Mật khẩu</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-stone-400"
              placeholder="••••••••" required />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-stone-800 text-white font-bold py-3 rounded-lg hover:bg-stone-700 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}