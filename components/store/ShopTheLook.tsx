'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { X } from 'lucide-react'
import type { Product } from '@/types'

// Kế thừa toàn bộ Product (không chỉ vài field hiển thị) vì danh sách "mua
// trọn bộ" cần build CartProduct hợp lệ (weight, sku, category_id, ... đều
// được đọc ở nơi khác như tính phí ship / order) — xem LookBundle.tsx.
export interface HotspotProduct extends Product {
  // Biến thể mặc định được chọn sẵn cho sản phẩm này trong "look" (server tính
  // trước ở trang chi tiết) — null nếu sản phẩm không có biến thể.
  variant_id?: string | null
  variant_label?: string | null
  // Biến thể của cùng sản phẩm có giá khác nhau → không thể gộp 1 tổng giá chắc chắn
  price_ambiguous?: boolean
}

export interface Hotspot {
  id: string
  x_percent: number
  y_percent: number
  product: HotspotProduct | null
}

export interface Look {
  id: string
  title: string
  description?: string
  image_url: string
  hotspots: Hotspot[]
}

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

function HotspotDot({ hotspot, open, onToggle, onClose }: { hotspot: Hotspot; open: boolean; onToggle: () => void; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  // Pattern chuẩn để biết component đã mount ở client (dùng cho createPortal
  // bên dưới, tránh lệch hydration SSR/client) — không có cách nào khác để
  // phát hiện "đã qua lần render đầu ở client" ngoài effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  const p = hotspot.product
  if (!p) return null

  // Xác định hướng popup để không bị ra ngoài khung ảnh
  const popupLeft  = hotspot.x_percent < 60
  const popupAbove = hotspot.y_percent > 65

  return (
    <div
      style={{ left: `${hotspot.x_percent}%`, top: `${hotspot.y_percent}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
    >
      {/* Nút dot */}
      <button
        onClick={e => { e.stopPropagation(); onToggle() }}
        className="relative flex items-center justify-center w-7 h-7 focus:outline-none"
        aria-label={p.name}
      >
        {/* Vòng pulse */}
        {!open && (
          <span className="absolute inset-0 rounded-full bg-white/60 animate-ping" />
        )}
        {/* Dot chính */}
        <span className={`relative w-5 h-5 rounded-full flex items-center justify-center shadow-lg border transition-all duration-200
          ${open
            ? 'bg-stone-900 border-stone-900 scale-110'
            : 'bg-white border-white hover:scale-110'}`}
        >
          <span className={`text-xs font-black leading-none transition-colors ${open ? 'text-white' : 'text-stone-900'}`}>
            {open ? <X size={10} /> : '+'}
          </span>
        </span>
      </button>

      {/* Product popup desktop — card nổi cạnh dot (không cần portal, không bị ảnh hưởng bởi transform) */}
      {open && (
        <div
          className={`hidden md:block absolute z-20 w-44 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden
            ${popupLeft  ? 'left-6'   : 'right-6'}
            ${popupAbove ? 'bottom-6' : 'top-6'}`}
          onClick={e => e.stopPropagation()}
        >
          <HotspotCardContent product={p} />
        </div>
      )}

      {/* Bottom sheet mobile — render qua portal vào <body> để thoát khỏi containing block
          do transform (-translate-x-1/2) của div cha tạo ra, nếu không "fixed" sẽ bị giam trong dot nhỏ */}
      {open && mounted && createPortal(
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-[100] bg-black/40"
            onClick={onClose}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[101] bg-white rounded-t-3xl shadow-2xl overflow-hidden animate-sheet-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="w-9 h-1 rounded-full bg-stone-200" />
            </div>
            <div className="flex gap-3 p-4">
              <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-stone-100">
                <Image src={p.cover_image} alt={p.name} fill sizes="96px" className="object-cover" />
                {p.sale_price && (
                  <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    -{Math.round((1 - p.sale_price / p.price) * 100)}%
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <p className="text-sm font-bold text-stone-900 leading-snug mb-1 line-clamp-2">{p.name}</p>
                {p.variant_label && (
                  <p className="text-xs text-stone-400 mb-1">{p.variant_label}</p>
                )}
                <div className="flex items-baseline gap-1.5 mb-auto">
                  <span className="text-base font-black text-amber-700">{fmt(p.sale_price ?? p.price)}</span>
                  {p.sale_price && (
                    <span className="text-xs text-stone-400 line-through">{fmt(p.price)}</span>
                  )}
                </div>
                <a
                  href={`/products/${p.slug}`}
                  className="block w-full bg-stone-900 text-white text-center text-xs font-bold py-2.5 rounded-xl hover:bg-stone-700 transition mt-2"
                >
                  Xem sản phẩm →
                </a>
              </div>
            </div>
            <div className="pb-[env(safe-area-inset-bottom)]" />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function HotspotCardContent({ product: p }: { product: HotspotProduct }) {
  return (
    <>
      {/* Ảnh sản phẩm */}
      <div className="relative h-24">
        <Image src={p.cover_image} alt={p.name} fill sizes="176px" className="object-cover" />
        {p.sale_price && (
          <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            -{Math.round((1 - p.sale_price / p.price) * 100)}%
          </span>
        )}
      </div>

      {/* Thông tin */}
      <div className="p-2.5">
        <p className="text-xs font-bold text-stone-900 leading-snug mb-1 line-clamp-2">{p.name}</p>
        {p.variant_label && (
          <p className="text-[10px] text-stone-400 mb-1">{p.variant_label}</p>
        )}
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-xs font-black text-amber-700">
            {fmt(p.sale_price ?? p.price)}
          </span>
          {p.sale_price && (
            <span className="text-[10px] text-stone-400 line-through">{fmt(p.price)}</span>
          )}
        </div>
        <a
          href={`/products/${p.slug}`}
          className="block w-full bg-stone-900 text-white text-center text-[11px] font-bold py-2 rounded-lg hover:bg-stone-700 transition"
        >
          Xem sản phẩm →
        </a>
      </div>
    </>
  )
}

export default function ShopTheLook({ look }: { look: Look }) {
  const activeHotspots = look.hotspots.filter(h => h.product)
  // Chỉ 1 hotspot được mở tại 1 thời điểm — bấm dot khác thì dot đang mở tự đóng
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden bg-stone-100" onClick={() => setOpenId(null)}>
        {/* image_url có thể là link dán tay bất kỳ (xem admin/looks), next/image không dùng được */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={look.image_url}
          alt={look.title}
          className="w-full max-h-[85vh] object-contain block"
          draggable={false}
        />

        {activeHotspots.map(h => (
          <HotspotDot
            key={h.id}
            hotspot={h}
            open={openId === h.id}
            onToggle={() => setOpenId(id => id === h.id ? null : h.id)}
            onClose={() => setOpenId(null)}
          />
        ))}

        {activeHotspots.length > 0 && (
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm">
            {activeHotspots.length} sản phẩm trong ảnh
          </div>
        )}
      </div>
    </div>
  )
}
