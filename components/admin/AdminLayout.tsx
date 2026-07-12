'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/admin', label: '📊 Tổng quan', icon: '📊' },
  { href: '/admin/products', label: '📦 Sản phẩm', icon: '📦' },
  { href: '/admin/categories', label: '🗂️ Danh mục', icon: '🗂️' },
  { href: '/admin/orders', label: '🛒 Đơn hàng', icon: '🛒' },
  { href: '/admin/coupons', label: '🏷️ Mã giảm giá', icon: '🏷️' },
  { href: '/admin/promotions', label: '🎉 Khuyến mãi', icon: '🎉' },
  { href: '/admin/settings', label: '⚙️ Cài đặt', icon: '⚙️' },
  { href: '/admin/looks', label: '🖼️ Shop the Look', icon: '🖼️' },
  { href: '/admin/social', label: '📣 Kênh bán hàng', icon: '📣' },
  { href: '/admin/analytics', label: '📊 Thống kê', icon: '📊' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/admin/login')
      } else {
        setEmail(data.session.user.email || '')
        setChecking(false)
      }
    })
    supabase.from('settings').select('key,value').then(({ data }) => {
      setSettings(Object.fromEntries(data?.map(r => [r.key, r.value || '']) ?? []))
    })
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-400 text-sm">
        Đang kiểm tra đăng nhập...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-stone-900 text-amber-50 flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} aria-label="Mở menu" className="text-2xl leading-none">
          ☰
        </button>
        <span className="text-sm font-black tracking-wide">{settings.site_name || 'NORDIC HOME'}</span>
        <span className="w-6" />
      </div>

      {/* Overlay khi sidebar mở trên mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-black/50 z-40"
        />
      )}

      {/* Sidebar — off-canvas trên mobile, cố định trên desktop */}
      <aside className={`
        w-56 bg-stone-900 text-stone-300 flex flex-col flex-shrink-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-200
        md:static md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-stone-800">
          <Link href="/" className="flex items-center gap-3">
            {settings.logo_url
              ? <Image src={settings.logo_url} alt="Logo" width={40} height={40} className="h-10 w-10 object-contain rounded-lg flex-shrink-0" />
              : <div className="h-10 w-10 rounded-lg bg-stone-700 flex-shrink-0" />
            }
            <div>
              <div className="text-sm font-black text-amber-50 tracking-wide leading-tight">
                {settings.site_name || 'NORDIC HOME'}
              </div>
              <div className="font-serif italic font-semibold text-[8px] text-amber-600 tracking-[2px]">
                Simplify & Enjoy
              </div>
            </div>
          </Link>
          <div className="text-[10px] text-stone-500 tracking-[2px] uppercase mt-3">Admin Panel</div>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm hover:bg-stone-800 hover:text-amber-100 transition mb-1">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-stone-800">
          <div className="text-xs text-stone-500 mb-2 truncate">{email}</div>
          <button onClick={handleLogout}
            className="w-full text-left text-xs text-stone-400 hover:text-red-400 transition">
            🚪 Đăng xuất
          </button>
          <Link href="/" className="block mt-2 text-xs text-stone-400 hover:text-amber-200 transition">
            ← Về trang chủ
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 pt-20 md:p-8 md:pt-8 overflow-x-hidden min-w-0">
        {children}
      </main>
    </div>
  )
}