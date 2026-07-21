'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ImageOff, Truck, Star } from 'lucide-react'
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
  // Điểm đánh giá TB + số lượng đã duyệt — optional, chỉ trang gọi truyền vào
  // (dark launch sau cờ reviews_show_on_cards). Không có hoặc count=0 thì
  // không hiện gì, tránh bôi "0 sao" khi catalog còn ít review.
  rating?: { avg: number; count: number } | null
}

export default function ProductCard({ product: p, hasVariants = false, minVariantPrice, priority = false, rating }: Props) {
  const addItem = useCartStore(s => s.addItem)
  const router = useRouter()
  const [hovered, setHovered] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

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
              {/* Skeleton shimmer cho đến khi ảnh chính tải xong — tránh ảnh
                  "hiện bụp" đột ngột, đặc biệt lộ rõ trên mạng chậm. */}
              {!imgLoaded && <div className="absolute inset-0 img-shimmer" aria-hidden="true" />}
              {/* Ảnh chính */}
              <Image
                src={p.cover_image}
                alt={p.name}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                priority={priority}
                loading={priority ? 'eager' : 'lazy'}
                onLoad={() => setImgLoaded(true)}
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

          {/* CTA trượt lên đè ảnh khi hover — chỉ desktop (mobile không có
              hover thật, vẫn dùng nút cố định bên dưới ảnh như cũ). Nút nằm
              trong <Link> nên phải preventDefault/stopPropagation để không
              vừa thêm giỏ vừa điều hướng sang trang chi tiết cùng lúc. */}
          <div className="hidden md:block absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
            <button
              disabled={isDisabled}
              onClick={e => { e.preventDefault(); e.stopPropagation(); handleAddToCart() }}
              className={`w-full text-xs font-bold py-3 backdrop-blur-sm disabled:opacity-40 disabled:cursor-not-allowed ${btnClass}`}
            >
              {btnLabel}
            </button>
          </div>
        </div>

        <div className="p-3">
          <div className="text-[10px] text-stone-600 mb-1">{p.category?.name}</div>
          <div className="font-bold text-sm text-stone-800 leading-tight mb-2 line-clamp-2">{p.name}</div>
          {!!rating?.count && (
            <div className="flex items-center gap-1 text-[11px] text-stone-500 mb-2 -mt-1">
              <Star size={11} className="text-amber-500" fill="currentColor" />
              <span className="font-semibold text-stone-700">{rating.avg.toFixed(1)}</span>
              <span>({rating.count})</span>
            </div>
          )}
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
            <div className="flex items-center gap-1 text-[11px] text-green-600 font-semibold -mt-2 mb-2"><Truck size={11} />Freeship</div>
          )}
        </div>
      </Link>

      {/* Mobile: nút cố định bên dưới ảnh (không có hover thật để dùng CTA
          trượt lên). Desktop: ẩn nút này, dùng CTA trượt lên đè ảnh ở trên. */}
      <div className="px-3 pb-3 md:hidden">
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