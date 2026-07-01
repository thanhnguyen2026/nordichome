'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { X } from 'lucide-react'

interface HotspotProduct {
  id: string
  name: string
  slug: string
  cover_image: string
  price: number
  sale_price: number | null
}

interface Hotspot {
  id: string
  x_percent: number
  y_percent: number
  product: HotspotProduct | null
}

interface Look {
  id: string
  title: string
  description?: string
  image_url: string
  hotspots: Hotspot[]
}

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

function HotspotDot({ hotspot, index }: { hotspot: Hotspot; index: number }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
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
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="relative flex items-center justify-center w-9 h-9 focus:outline-none"
        aria-label={p.name}
      >
        {/* Vòng pulse */}
        {!open && (
          <span className="absolute inset-0 rounded-full bg-white/60 animate-ping" />
        )}
        {/* Dot chính */}
        <span className={`relative w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 transition-all duration-200
          ${open
            ? 'bg-stone-900 border-stone-900 scale-110'
            : 'bg-white border-white hover:scale-110'}`}
        >
          <span className={`text-sm font-black leading-none transition-colors ${open ? 'text-white' : 'text-stone-900'}`}>
            {open ? <X size={12} /> : '+'}
          </span>
        </span>
      </button>

      {/* Product popup desktop — card nổi cạnh dot (không cần portal, không bị ảnh hưởng bởi transform) */}
      {open && (
        <div
          className={`hidden md:block absolute z-20 w-52 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden
            ${popupLeft  ? 'left-8'   : 'right-8'}
            ${popupAbove ? 'bottom-8' : 'top-8'}`}
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
            onClick={() => setOpen(false)}
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
                <p className="text-sm font-bold text-stone-900 leading-snug mb-1.5 line-clamp-2">{p.name}</p>
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
      <div className="relative h-36">
        <Image src={p.cover_image} alt={p.name} fill sizes="208px" className="object-cover" />
        {p.sale_price && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            -{Math.round((1 - p.sale_price / p.price) * 100)}%
          </span>
        )}
      </div>

      {/* Thông tin */}
      <div className="p-3">
        <p className="text-xs font-bold text-stone-900 leading-snug mb-2 line-clamp-2">{p.name}</p>
        <div className="flex items-baseline gap-1.5 mb-3">
          <span className="text-sm font-black text-amber-700">
            {fmt(p.sale_price ?? p.price)}
          </span>
          {p.sale_price && (
            <span className="text-[11px] text-stone-400 line-through">{fmt(p.price)}</span>
          )}
        </div>
        <a
          href={`/products/${p.slug}`}
          className="block w-full bg-stone-900 text-white text-center text-xs font-bold py-2.5 rounded-xl hover:bg-stone-700 transition"
        >
          Xem sản phẩm →
        </a>
      </div>
    </>
  )
}

export default function ShopTheLook({ look }: { look: Look }) {
  const activeHotspots = look.hotspots.filter(h => h.product)

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden bg-stone-100">
        <img
          src={look.image_url}
          alt={look.title}
          className="w-full max-h-[85vh] object-contain block"
          draggable={false}
        />

        {activeHotspots.map((h, i) => (
          <HotspotDot key={h.id} hotspot={h} index={i} />
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
