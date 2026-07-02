'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useCartStore } from '@/store/cartStore'
import type { CartProduct } from '@/types'
import type { HotspotProduct } from './ShopTheLook'

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

function buildCartProduct(p: HotspotProduct): CartProduct {
  return {
    ...p,
    selectedVariant: p.variant_id
      ? { id: p.variant_id, label: p.variant_label ?? '', image_url: null, cost_price: null }
      : null,
    variant_id: p.variant_id ?? null,
    variant_label: p.variant_label ?? null,
    variant_image: null,
    variant_cost_price: null,
  }
}

export default function LookBundle({ title, products }: { title: string; products: HotspotProduct[] }) {
  const addItem = useCartStore(s => s.addItem)
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  // Chỉ gộp được 1 tổng giá chắc chắn nếu không sản phẩm nào trong bộ có
  // biến thể lệch giá nhau (price_ambiguous) — nếu có, ẩn nút mua trọn bộ,
  // khách vẫn xem/mua từng món qua link riêng.
  const canBundle = products.length > 0 && products.every(p => !p.price_ambiguous)
  const total = products.reduce((sum, p) => sum + (p.sale_price ?? p.price), 0)

  const handleAddAll = () => {
    setAdding(true)
    for (const p of products) {
      addItem({ product: buildCartProduct(p), quantity: 1 })
    }
    router.push('/cart')
  }

  return (
    <div>
      <h1 className="text-2xl font-serif italic text-stone-900 mb-6">{title}</h1>

      <ul className="space-y-5">
        {products.map((p, i) => (
          <li key={p.id} className="flex items-start gap-4">
            <span className="flex-shrink-0 w-7 h-7 rounded-full border border-stone-300 flex items-center justify-center text-xs font-semibold text-stone-500">
              {i + 1}
            </span>
            <a href={`/products/${p.slug}`} className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-stone-50">
              <Image src={p.cover_image} alt={p.name} width={64} height={64} loading="eager" className="w-full h-full object-cover" />
            </a>
            <a href={`/products/${p.slug}`} className="flex-1 min-w-0">
              <p className="text-sm font-bold text-stone-900 hover:underline leading-snug">{p.name}</p>
              <p className="text-sm text-stone-500 mt-0.5">{fmt(p.sale_price ?? p.price)}</p>
              {p.variant_label && (
                <p className="text-xs text-stone-400 underline decoration-stone-200 mt-0.5">{p.variant_label}</p>
              )}
            </a>
          </li>
        ))}
      </ul>

      {canBundle && (
        <button
          onClick={handleAddAll}
          disabled={adding}
          className="w-full mt-8 bg-stone-900 text-white font-bold py-3.5 rounded-xl hover:bg-stone-700 active:scale-[0.99] transition-all text-sm disabled:opacity-60"
        >
          Thêm vào giỏ | {fmt(total)}
        </button>
      )}
    </div>
  )
}
