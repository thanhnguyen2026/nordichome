'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, ImageOff } from 'lucide-react'
import { useCartStore, itemKey } from '@/store/cartStore'
import { supabase } from '@/lib/supabase'
import { trackBeginCheckout } from '@/lib/analytics'

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

export default function CartPage() {
  const { items, removeItem, updateQty, total } = useCartStore()
  const [settings, setSettings] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.from('settings').select('key,value').then(({ data }) => {
      setSettings(Object.fromEntries(data?.map(r => [r.key, r.value || '']) ?? []))
    })
  }, [])

  return (
    <>
      <header className="bg-white border-b border-stone-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            {settings.logo_url && (
              <Image src={settings.logo_url} alt="Logo" width={48} height={48} className="h-12 w-12 object-contain rounded-lg" />
            )}
            <div>
              <div className="text-base md:text-lg font-black text-stone-900 tracking-wide leading-tight">
                {settings.site_name || 'NORDIC HOME'}
              </div>
              <div className="font-serif italic font-semibold text-[10px] text-amber-700 tracking-[2px]">
                Simplify & Enjoy
              </div>
            </div>
          </Link>
          <Link href="/products" className="text-sm font-semibold text-stone-600 hover:text-stone-900">← Tiếp tục mua sắm</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-black mb-6 flex items-center gap-2"><ShoppingCart size={22} /> Giỏ hàng của bạn</h1>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart size={48} className="mx-auto mb-4 text-stone-300" />
            <p className="text-stone-500 mb-6">Giỏ hàng của bạn đang trống</p>
            <Link href="/products" className="bg-stone-900 text-amber-100 px-6 py-3 rounded-lg text-sm font-bold inline-block">
              Khám phá sản phẩm →
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden mb-6">
              {items.map(item => {
                const key = itemKey(item)
                const variantLabel = item.product.variant_label
                const variantImage = item.product.variant_image
                const displayImage = variantImage || item.product.cover_image
                return (
                  <div key={key} className="flex gap-4 p-4 border-b border-stone-50 last:border-0">
                    <div className="relative w-20 h-20 bg-stone-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                      {displayImage
                        ? <Image src={displayImage} alt={item.product.name} fill sizes="80px" className="object-cover" />
                        : <ImageOff size={28} className="text-stone-300" />}
                    </div>
                    <div className="flex-1">
                      <Link href={`/products/${item.product.slug}`} className="font-bold text-sm hover:text-amber-700">
                        {item.product.name}
                      </Link>
                      {/* Hiển thị biến thể đã chọn */}
                      {variantLabel && (
                        <div className="text-[11px] text-stone-600 mt-0.5">{variantLabel}</div>
                      )}
                      <div className="text-amber-700 font-bold text-sm mt-1">
                        {fmt(item.product.sale_price ?? item.product.price)}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center border border-stone-200 rounded-lg">
                          <button onClick={() => updateQty(key, item.quantity - 1)} aria-label="Giảm số lượng" className="w-9 h-9 text-sm">−</button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <button onClick={() => updateQty(key, item.quantity + 1)} aria-label="Tăng số lượng" className="w-9 h-9 text-sm">+</button>
                        </div>
                        <button onClick={() => removeItem(key)} className="text-red-500 text-xs hover:underline">Xoá</button>
                      </div>
                    </div>
                    <div className="text-right font-bold text-sm">
                      {fmt((item.product.sale_price ?? item.product.price) * item.quantity)}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 p-6">
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-stone-500">Tạm tính</span>
                <span className="font-semibold">{fmt(total())}</span>
              </div>
              <div className="flex justify-between mb-4 text-lg font-black border-t border-stone-100 pt-3">
                <span>Tổng cộng</span>
                <span className="text-amber-700">{fmt(total())}</span>
              </div>
              <Link
                href="/checkout"
                onClick={() => trackBeginCheckout(items, total())}
                className="block w-full bg-stone-900 text-amber-100 text-center font-bold py-3.5 rounded-lg text-sm hover:bg-stone-800 transition"
              >
                Tiến hành đặt hàng →
              </Link>
            </div>
          </>
        )}
      </main>
    </>
  )
}