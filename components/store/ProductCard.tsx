'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ImageOff } from 'lucide-react'
import { Product } from '@/types'
import { useCartStore } from '@/store/cartStore'

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

interface Props {
  product: Product
  hasVariants?: boolean
  minVariantPrice?: number | null
  // Ảnh trong khung nhìn đầu tiên nên tải ngay (không lazy) — trên iOS Safari,
  // ảnh fill + lazy-load đôi khi tải/giải mã xong nhưng không tự vẽ lại, hiện
  // mờ (frame cũ) cho tới khi người dùng cuộn để trình duyệt buộc phải repaint.
  priority?: boolean
}

export default function ProductCard({ product: p, hasVariants = false, minVariantPrice, priority = false }: Props) {
  const addItem = useCartStore(s => s.addItem)
  const router = useRouter()
  const [hovered, setHovered] = useState(false)

  const secondImage = p.images?.[0]

  const handleAddToCart = () => {
    if (hasVariants) {
      router.push(`/products/${p.slug}`)
      return
    }
    addItem({ product: p, quantity: 1 })
  }

  const isDisabled = !hasVariants && !p.is_preorder && !p.in_stock

  const btnLabel = hasVariants
    ? 'Chọn mẫu →'
    : p.is_preorder
      ? (p.preorder_note ? `Đặt trước (${p.preorder_note})` : 'Đặt trước')
      : p.in_stock
        ? 'Thêm vào giỏ'
        : 'Hết hàng'

  const btnClass = 'bg-stone-900 text-amber-100 hover:bg-stone-700'

  // Card nhỏ trên mobile không đủ chỗ xếp chồng nhiều badge cùng lúc (dễ rối
  // mắt) — chỉ hiện 1 badge quan trọng nhất theo thứ tự ưu tiên, freeship
  // đưa xuống dòng chữ nhỏ cạnh giá thay vì badge riêng.
  const primaryBadge = p.is_preorder
    ? { label: 'ĐẶT TRƯỚC', className: 'bg-stone-900/80 text-amber-300' }
    : !p.in_stock
      ? { label: 'HẾT HÀNG', className: 'bg-stone-400/80 text-white' }
      : p.sale_price
        ? { label: 'SALE', className: 'bg-red-500 text-white' }
        : p.is_new
          ? { label: 'MỚI', className: 'bg-stone-900 text-amber-200' }
          : null

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-stone-100 hover:-translate-y-1 hover:shadow-lg transition group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={`/products/${p.slug}`} className="block">
        <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden flex items-center justify-center">
          {p.cover_image ? (
            <>
              {/* Ảnh chính */}
              <Image
                src={p.cover_image}
                alt={p.name}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                priority={priority}
                loading={priority ? 'eager' : 'lazy'}
                className={`object-cover transition-all duration-500 ${
                  hovered && secondImage ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
                }`}
              />
              {/* Ảnh hover — chỉ render nếu có ảnh thứ 2 */}
              {secondImage && (
                <Image
                  src={secondImage}
                  alt={p.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className={`object-cover transition-all duration-500 ${
                    hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                  }`}
                />
              )}
            </>
          ) : (
            <ImageOff size={36} className="text-stone-300" />
          )}

          {primaryBadge && (
            <div className="absolute top-2 left-2">
              <span className={`${primaryBadge.className} text-[10px] font-bold px-2.5 py-0.5 rounded-sm tracking-wide`}>
                {primaryBadge.label}
              </span>
            </div>
          )}
          {hasVariants && (
            <div className="absolute top-2 right-2">
              <span className="bg-white/90 text-stone-700 text-[10px] font-bold px-2.5 py-0.5 rounded-sm tracking-wide shadow-sm">NHIỀU MẪU</span>
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="text-[10px] text-stone-600 mb-1">{p.category?.name}</div>
          <div className="font-bold text-sm text-stone-800 leading-tight mb-2 line-clamp-2">{p.name}</div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="font-black text-stone-900">
              {hasVariants && minVariantPrice != null
                ? fmt(minVariantPrice)
                : fmt(p.sale_price ?? p.price)}
            </span>
            {!hasVariants && p.sale_price && (
              <span className="text-xs text-stone-500 line-through">{fmt(p.price)}</span>
            )}
          </div>
          {p.free_shipping && (
            <div className="text-[11px] text-green-600 font-semibold -mt-2 mb-2">🚚 Freeship</div>
          )}
        </div>
      </Link>

      <div className="px-3 pb-3">
        <button
          disabled={isDisabled}
          onClick={handleAddToCart}
          className={`w-full text-xs font-bold py-2.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${btnClass}`}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  )
}