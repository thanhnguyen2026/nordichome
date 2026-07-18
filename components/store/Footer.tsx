import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Mail, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Settings {
  logo_url?: string
  site_name?: string
  address?: string
  email?: string
  hotline?: string
  footer_description?: string
  footer_copyright?: string
}

async function getSocialChannels() {
  const { data } = await supabase
    .from('social_channels')
    .select('*')
    .order('sort_order')
  return data || []
}

export default async function Footer({ settings }: { settings: Settings }) {
  const socialChannels = await getSocialChannels()

  return (
    <footer className="bg-stone-900 text-stone-400 px-4 py-14 overflow-hidden">
      {/* Wordmark editorial khổng lồ — chỉ trang trí, ẩn khỏi screen reader
          vì tên thương hiệu đã có sẵn trong phần Brand ngay bên dưới. */}
      <div className="max-w-6xl mx-auto mb-8 -mt-2" aria-hidden="true">
        <p className="font-serif italic font-black text-white/[0.06] text-[3.5rem] sm:text-[5rem] md:text-[7rem] leading-none tracking-tight whitespace-nowrap select-none">
          {settings.site_name || 'Nordic Home'}
        </p>
      </div>
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">

        {/* Brand */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            {settings.logo_url && (
              <Image
                src={settings.logo_url}
                alt="Logo"
                width={48}
                height={48}
                className="h-12 w-12 object-contain rounded-lg bg-white p-0.5"
              />
            )}
            <div>
              <div className="text-base font-black text-amber-50">
                {settings.site_name || 'NORDIC HOME'}
              </div>
              <div className="font-serif italic font-semibold text-[10px] text-amber-600 tracking-[2px]">
                Simplify & Enjoy
              </div>
            </div>
          </div>
          <p className="text-sm leading-relaxed mt-3">
            {settings.footer_description || 'Nội thất phong cách tối giản, tinh tế và mộc mạc.'}
          </p>
        </div>

        {/* Sản phẩm */}
        <div>
          <div className="font-bold text-amber-100 mb-4 text-sm tracking-wide">Sản phẩm</div>
          <div className="flex flex-col gap-2.5 text-sm">
            <Link href="/products" className="hover:text-amber-200 transition">Tất cả sản phẩm</Link>
            <Link href="/products?featured=true" className="hover:text-amber-200 transition">Nổi bật</Link>
            <Link href="/products?new=true" className="hover:text-amber-200 transition">Hàng mới</Link>
            <Link href="/orders/track" className="hover:text-amber-200 transition">Theo dõi đơn hàng</Link>
          </div>
        </div>

        {/* Liên hệ */}
        <div>
          <div className="font-bold text-amber-100 mb-4 text-sm tracking-wide">Liên hệ</div>
          <div className="flex flex-col gap-3 text-sm">
            {settings.address && (
              <div className="flex items-start gap-2.5">
                <MapPin size={15} className="text-stone-500 flex-shrink-0 mt-0.5" />
                <span>{settings.address}</span>
              </div>
            )}
            {settings.hotline && (
              <div className="flex items-center gap-2.5">
                <Phone size={15} className="text-stone-500 flex-shrink-0" />
                <a href={`tel:${settings.hotline}`} className="hover:text-amber-200 transition">
                  {settings.hotline}
                </a>
              </div>
            )}
            {settings.email && (
              <div className="flex items-center gap-2.5">
                <Mail size={15} className="text-stone-500 flex-shrink-0" />
                <a href={`mailto:${settings.email}`} className="hover:text-amber-200 transition break-all">
                  {settings.email}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Kết nối — lấy từ database */}
        <div>
          <div className="font-bold text-amber-100 mb-4 text-sm tracking-wide">Kết nối</div>
          <div className="flex flex-col gap-3">
            {socialChannels.length === 0 ? (
              <p className="text-stone-600 text-xs">Chưa có kênh nào</p>
            ) : (
              socialChannels.map(ch => (
                <a
                  key={ch.id}
                  href={ch.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-stone-400 hover:text-amber-200 transition-colors duration-200 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center group-hover:bg-stone-700 transition-colors overflow-hidden flex-shrink-0">
                    {ch.icon_url ? (
                      <Image
                        src={ch.icon_url}
                        alt={ch.name}
                        width={20}
                        height={20}
                        className="w-5 h-5 object-contain"
                      />
                    ) : (
                      <span className="text-xs font-black text-stone-300">
                        {ch.name?.[0] || '?'}
                      </span>
                    )}
                  </div>
                  <span>{ch.name}</span>
                </a>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-stone-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-stone-400">
        <span>{settings.footer_copyright || `© ${new Date().getFullYear()} ${settings.site_name || 'Nordic Home'}. All rights reserved.`}</span>
        <div className="flex gap-4">
          <Link href="/chinh-sach-bao-mat" className="hover:text-white transition">Chính sách bảo mật</Link>
          <Link href="/dieu-khoan-su-dung" className="hover:text-white transition">Điều khoản sử dụng</Link>
          <Link href="/chinh-sach-doi-tra" className="hover:text-white transition">Chính sách đổi trả</Link>
        </div>
      </div>
    </footer>
  )
}