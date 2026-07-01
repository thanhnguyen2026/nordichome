'use client'
import { useState, useEffect } from 'react'
import ProductGallery from './ProductGallery'
import ProductVideoPlayer from './ProductVideoPlayer'
import AddToCartSection from './AddToCartSection'
import ChatConsultBlock from './ChatConsultBlock'
import { Product } from '@/types'
import { trackViewItem } from '@/lib/analytics'

interface Props {
  product: Product & { [key: string]: any }
  allImages: string[]
  settings: Record<string, string>
}

export default function ProductDetailClient({ product, allImages, settings }: Props) {
  const [variantImage,  setVariantImage]  = useState<string | null>(null)
  const [variantPrice,  setVariantPrice]  = useState<number | null>(null)
  const [variantLabel,  setVariantLabel]  = useState<string | null>(null)

  useEffect(() => {
    trackViewItem({
      id:        product.id,
      name:      product.name,
      price:     product.price,
      sale_price: product.sale_price,
      category:  (product as any).category?.name,
      slug:      product.slug,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Khi chọn variant có ảnh → đẩy ảnh đó lên đầu gallery
  const displayImages = variantImage
    ? [variantImage, ...allImages.filter(img => img !== variantImage)]
    : allImages

  return (
    <div className="grid md:grid-cols-2 gap-10 mb-16">
      {/* Left — ảnh + video */}
      <div className="space-y-4">
        <ProductGallery images={displayImages} />
        {product.video_url && (
          <div>
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
              🎬 Video sản phẩm
            </div>
            <ProductVideoPlayer videoUrl={product.video_url} />
          </div>
        )}
      </div>

      {/* Right — thông tin + nút mua */}
      <div>
        <div className="text-xs text-stone-400 mb-2">
          {product.category?.name}
        </div>
        <h1 className="font-serif text-3xl font-semibold mb-2 leading-tight">{product.name}</h1>
        {product.sku && (
          <div className="text-xs text-stone-400 mb-4 font-mono">
            Mã SP: {product.sku}
          </div>
        )}

        {/* Giá — ưu tiên giá biến thể nếu đã chọn */}
        <div className="flex items-baseline gap-3 mb-5">
          <span className="text-3xl font-black text-amber-700">
            {(variantPrice ?? product.sale_price ?? product.price).toLocaleString('vi-VN')}₫
          </span>
          {/* Chỉ hiện giá gạch ngang khi KHÔNG có variant price */}
          {!variantPrice && product.sale_price && (
            <>
              <span className="text-base text-stone-400 line-through">
                {product.price.toLocaleString('vi-VN')}₫
              </span>
              <span className="text-xs bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full">
                -{Math.round((1 - product.sale_price / product.price) * 100)}%
              </span>
            </>
          )}
        </div>

        {/* Badge trạng thái */}
        <div className="flex items-center gap-2 mb-5">
          {product.is_preorder ? (
            <span className="text-xs px-3 py-1 rounded-full bg-orange-50 text-orange-600 font-semibold border border-orange-100 shadow-sm">
              ⏳ Đặt trước (7-10 ngày)
            </span>
          ) : product.in_stock ? (
            <span className="text-xs px-3 py-1 rounded-full bg-green-50 text-green-700 font-semibold border border-green-100">
              ✓ Còn hàng
            </span>
          ) : (
            <span className="text-xs px-3 py-1 rounded-full bg-red-50 text-red-600 font-semibold border border-red-100">
              Hết hàng
            </span>
          )}
          {product.is_new && (
            <span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-100">
              Mới
            </span>
          )}
          {product.is_featured && (
            <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-100">
              ⭐ Nổi bật
            </span>
          )}
        </div>

        {/* Mô tả ngắn */}
        {product.short_desc && (
          <p className="text-stone-500 text-sm leading-relaxed mb-6 border-l-2 border-stone-200 pl-4">
            {product.short_desc}
          </p>
        )}

        {/* Nút mua — truyền callback đổi ảnh */}
        <AddToCartSection
          product={product}
          onVariantImageChange={setVariantImage}
          onVariantPriceChange={setVariantPrice}
          onVariantLabelChange={setVariantLabel}
        />

        {/* Khối tư vấn chat */}
        <ChatConsultBlock
          settings={settings}
          product={{
            name:         product.name,
            sku:          product.sku,
            price:        product.price,
            sale_price:   product.sale_price,
            variantLabel: variantLabel,
            variantPrice: variantPrice,
            pageUrl:      typeof window !== 'undefined' ? window.location.href : '',
          }}
        />

        <div className="border-t border-stone-100 my-6" />

        {/* Mô tả chi tiết */}
        {product.description && (
          <div>
            <h2 className="font-bold text-sm mb-3 text-stone-700">📋 Mô tả chi tiết</h2>
            <div className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">
              {product.description}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}