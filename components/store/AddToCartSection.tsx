'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { Product, CartProduct } from '@/types'
import { ShoppingCart, Zap, AlertCircle } from 'lucide-react'
import VariantSelector from './VariantSelector'
import { trackAddToCart } from '@/lib/analytics'

interface SelectedVariant {
  id: string
  group_name: string
  option_name: string
  price: number | null
  weight: number
  stock: number
  image_url: string | null  // ← THÊM
}

interface Props {
  product: Product
  onVariantImageChange?: (imageUrl: string | null) => void
  onVariantPriceChange?: (price: number | null) => void
  onVariantLabelChange?: (label: string | null) => void
}

export default function AddToCartSection({ product, onVariantImageChange, onVariantPriceChange, onVariantLabelChange }: Props) {
  const addItem = useCartStore(s => s.addItem)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null)
  const [variantError, setVariantError] = useState(false)
  const router = useRouter()

  const effectivePrice = selectedVariant?.price ?? (product.sale_price ?? product.price)
  const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

  // Sticky bottom bar (mobile) — hiện khi nút mua gốc đã cuộn khỏi màn hình
  const buttonsRef = useRef<HTMLDivElement>(null)
  const [showSticky, setShowSticky] = useState(false)

  useEffect(() => {
    const el = buttonsRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleVariantChange = (v: SelectedVariant | null) => {
    setSelectedVariant(v)
    setVariantError(false)
    onVariantImageChange?.(v?.image_url ?? null)
    onVariantPriceChange?.(v?.price ?? null)
    onVariantLabelChange?.(v ? `${v.group_name}: ${v.option_name}` : null)
  }

  const buildCartProduct = (): CartProduct => ({
    ...product,
    price: effectivePrice,
    weight: selectedVariant?.weight ?? product.weight ?? 0.5,
    selectedVariant: selectedVariant ? {
      id:         selectedVariant.id,
      label:      `${selectedVariant.group_name}: ${selectedVariant.option_name}`,
      image_url:  selectedVariant.image_url,
      cost_price: null, // biến thể phía khách không có cost_price (đã chặn ở PUBLIC_VARIANT_COLUMNS) — dùng variant_cost_price bên dưới
    } : null,
    // Các field riêng để API route dùng
    variant_id:         selectedVariant?.id ?? null,
    variant_label:      selectedVariant ? `${selectedVariant.group_name}: ${selectedVariant.option_name}` : null,
    variant_image:      selectedVariant?.image_url ?? null,
    variant_cost_price: null,
  })

  const handleAddToCart = () => {
    setVariantError(false)
    addItem({ product: buildCartProduct(), quantity: qty })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
    trackAddToCart({
      id:           product.id,
      name:         product.name,
      price:        effectivePrice,
      variantId:    selectedVariant?.id,
      variantLabel: selectedVariant ? `${selectedVariant.group_name}: ${selectedVariant.option_name}` : null,
      category:     product.category?.name,
    }, qty)
  }

  const handleBuyNow = () => {
    setVariantError(false)
    addItem({ product: buildCartProduct(), quantity: qty })
    router.push('/cart')
  }

  if (!product.in_stock && !product.is_preorder) {
    return (
      <div className="inline-flex items-center px-5 py-3 rounded-xl bg-stone-100 text-stone-400 font-semibold text-sm">
        Sản phẩm tạm hết hàng
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <VariantSelector
        productId={product.id}
        basePrice={product.sale_price ?? product.price}
        onVariantChange={handleVariantChange}
      />

      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-stone-600">Số lượng:</span>
        <div className="flex items-center border border-stone-200 rounded-xl overflow-hidden">
          <button onClick={() => setQty(q => Math.max(1, q - 1))}
            className="w-10 h-10 flex items-center justify-center text-lg text-stone-600 hover:bg-stone-100 transition font-bold">−</button>
          <span className="w-12 text-center text-sm font-bold text-stone-800">{qty}</span>
          <button onClick={() => setQty(q => q + 1)}
            className="w-10 h-10 flex items-center justify-center text-lg text-stone-600 hover:bg-stone-100 transition font-bold">+</button>
        </div>
      </div>

      {variantError && (
        <div className="flex items-center gap-2 text-red-500 text-xs">
          <AlertCircle size={14} />
          Vui lòng chọn mẫu mã trước khi thêm vào giỏ
        </div>
      )}

      <div ref={buttonsRef} className="flex flex-col sm:flex-row gap-3">
        <button onClick={handleBuyNow}
          className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white font-bold py-3.5 px-6 rounded-xl hover:bg-stone-700 active:scale-95 transition-all text-sm">
          <Zap size={16} />
          {product.is_preorder ? 'Đặt trước ngay' : 'Mua ngay'}
        </button>
        <button onClick={handleAddToCart}
          className="flex-1 flex items-center justify-center gap-2 bg-white text-stone-900 font-bold py-3.5 px-6 rounded-xl border-2 border-stone-900 hover:bg-stone-50 active:scale-95 transition-all text-sm">
          <ShoppingCart size={16} />
          {added ? '✓ Đã thêm!' : product.is_preorder ? '⏳ Thêm vào giỏ' : 'Thêm vào giỏ'}
        </button>
      </div>

      {/* Sticky bottom bar — chỉ mobile, hiện khi nút mua gốc cuộn khỏi viewport */}
      <div
        className={`md:hidden fixed left-0 right-0 bottom-0 z-40 bg-white border-t border-stone-100 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-4 py-3 transition-transform duration-300 ease-out ${
          showSticky ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-stone-400 truncate">{product.name}</span>
            <span className="font-black text-stone-900 text-base">{fmt(effectivePrice)}</span>
          </div>
          <button onClick={handleBuyNow}
            className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white font-bold py-3 px-4 rounded-xl active:scale-95 transition-all text-sm">
            <Zap size={15} />
            {product.is_preorder ? 'Đặt trước' : 'Mua ngay'}
          </button>
        </div>
      </div>
    </div>
  )
}
