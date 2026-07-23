'use client'
import { useState, useEffect, useRef, Fragment } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import ProductGallery from './ProductGallery'
import AddToCartSection from './AddToCartSection'
import ChatConsultBlock from './ChatConsultBlock'
import { Product } from '@/types'
import { trackViewItem } from '@/lib/analytics'
import { Clock, Check, Star, Truck, ClipboardList } from 'lucide-react'

interface Props {
  product: Product
  allImages: string[]
  settings: Record<string, string>
}

// Nhúng video (Facebook SDK script) khá nặng và không phải sản phẩm nào
// cũng có — chỉ tải khi thực sự cần, không cộng vào bundle ban đầu.
const ProductVideoPlayer = dynamic(() => import('./ProductVideoPlayer'), { ssr: false })

export default function ProductDetailClient({ product, allImages, settings }: Props) {
  const [variantImage,  setVariantImage]  = useState<string | null>(null)
  const [variantPrice,  setVariantPrice]  = useState<number | null>(null)
  const [variantLabel,  setVariantLabel]  = useState<string | null>(null)

  // Chọn mẫu đổi ảnh trên mobile → tự cuộn lên khung ảnh nếu nó đã bị cuộn
  // khuất khỏi màn hình, đỡ phải kéo tay lên đầu trang mới thấy ảnh mới.
  const galleryRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (!variantImage) return
    if (window.innerWidth >= 768) return // desktop: ảnh & nút mua đã nằm cạnh nhau
    const el = galleryRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.top < 0) {
      // scrollIntoView canh mép trên khung ảnh vào y=0, nhưng header đang
      // sticky top-0 nên sẽ đè lên che mất phần trên — trừ thêm chiều cao
      // header thực tế (đo trực tiếp, không hard-code) để ảnh lộ hết ra.
      const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 0
      const targetY = window.scrollY + rect.top - headerHeight - 12
      window.scrollTo({ top: targetY, behavior: 'smooth' })
    }
  }, [variantImage])

  useEffect(() => {
    trackViewItem({
      id:        product.id,
      name:      product.name,
      price:     product.price,
      sale_price: product.sale_price,
      category:  product.category?.name,
      slug:      product.slug,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Khi chọn variant có ảnh → đẩy ảnh đó lên đầu gallery
  const displayImages = variantImage
    ? [variantImage, ...allImages.filter(img => img !== variantImage)]
    : allImages

  return (
    <>
    <div className="grid md:grid-cols-2 gap-10 mb-16">
      {/* Left — ảnh + video · min-w-0 bắt buộc: nếu không, item grid sẽ giãn theo
          chiều rộng nội dung của thanh trượt ảnh bên trong (ProductGallery dùng
          width tính theo %) thay vì co lại theo khung grid, gây tràn ngang trên mobile */}
      <div className="space-y-4 min-w-0" ref={galleryRef}>
        <ProductGallery images={displayImages} productName={product.name} />
        {product.video_url && (
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
              🎬 Video sản phẩm
            </div>
            <ProductVideoPlayer videoUrl={product.video_url} />
          </div>
        )}
      </div>

      {/* Right — thông tin + nút mua */}
      <div>
        <div className="text-xs text-stone-500 mb-2">
          {product.category?.name}
        </div>
        <h1 className="font-serif text-3xl font-semibold mb-2 leading-tight">{product.name}</h1>
        {product.sku && (
          <div className="text-xs text-stone-500 mb-4 font-mono">
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
              <span className="text-base text-stone-500 line-through">
                {product.price.toLocaleString('vi-VN')}₫
              </span>
              <span className="text-xs bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full">
                -{Math.round((1 - product.sale_price / product.price) * 100)}%
              </span>
            </>
          )}
        </div>

        {/* Badge trạng thái */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {product.is_preorder ? (
            <span className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-orange-50 text-orange-600 font-semibold border border-orange-100 shadow-sm">
              <Clock size={11} />Đặt trước{product.preorder_note ? ` (${product.preorder_note})` : ''}
            </span>
          ) : product.in_stock ? (
            <span className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-green-50 text-green-700 font-semibold border border-green-100">
              <Check size={11} />Còn hàng
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
            <span className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-100">
              <Star size={11} />Nổi bật
            </span>
          )}
          {product.free_shipping && (
            <span className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-green-50 text-green-700 font-semibold border border-green-100">
              <Truck size={11} />Freeship
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
            <h2 className="flex items-center gap-1.5 font-bold text-sm mb-3 text-stone-700"><ClipboardList size={15} />Mô tả chi tiết</h2>
            <div className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">
              {product.description}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Thông số kỹ thuật — full-width, dạng bảng.
        Trước đây dùng flex justify-between + khung ép cứng 320px trên mobile:
        nhãn ngắn ("Chất liệu") bị ngắt dòng xấu do không đủ chỗ, còn giá trị
        dài lại canh phải nên xuống dòng lởm chởm (mép trái so le). Đổi sang
        CSS Grid DÙNG CHUNG 1 khung cho cả danh sách (không phải mỗi dòng 1
        flex riêng) để 2 cột luôn thẳng hàng nhau xuyên suốt; cột nhãn
        auto-size + whitespace-nowrap (không ngắt dòng), cột giá trị còn lại
        (1fr) canh trái nên xuống dòng tự nhiên, dễ đọc hơn hẳn so với canh
        phải khi giá trị dài. */}
    {product.specs?.length > 0 && (
      <div className="mb-16 max-w-3xl mx-auto">
        <h2 className="font-serif text-2xl font-semibold text-center mb-6">Thông số sản phẩm</h2>
        <div className="max-w-xl mx-auto border-t border-stone-200 grid grid-cols-[auto_1fr] gap-x-6 sm:gap-x-10">
          {product.specs.map((spec, i) => (
            <Fragment key={i}>
              <span className="py-4 border-b border-stone-100 font-medium text-stone-500 text-sm whitespace-nowrap">
                {spec.label}
              </span>
              <span className="py-4 border-b border-stone-100 font-medium text-stone-700 text-sm">
                {spec.value}
              </span>
            </Fragment>
          ))}
        </div>
      </div>
    )}

    {/* Mô tả kèm ảnh minh hoạ — khung bo góc, rộng hơn cột nội dung nhưng
        không tràn hết màn hình (tràn full-bleed từng thử nhưng object-contain
        để lại 2 dải nền trống 2 bên trên PC, xấu hơn cả có viền). Không ép
        tỷ lệ khung cứng — ảnh tự hiện đúng theo tỷ lệ gốc, không cắt/không
        đệm màu thừa. */}
    {product.content_blocks?.length > 0 && (
      <div className="mb-16 space-y-10">
        {product.content_blocks.map((block, i) => (
          <div key={i}>
            {block.text && (
              <p className="max-w-3xl mx-auto font-serif font-medium text-xl md:text-2xl text-stone-700 leading-snug text-center mb-5 whitespace-pre-line">
                {block.text}
              </p>
            )}
            {block.image_url && (
              // Mobile: rộng hết khung, cao tự nhiên theo tỷ lệ ảnh — ổn vì
              // màn hình hẹp. Desktop: ảnh dọc/chân dung theo tỷ lệ gốc sẽ bị
              // kéo quá cao so với 1 màn hình — chặn chiều cao tối đa, để
              // chiều rộng tự co theo (không cắt, không méo ảnh).
              <div className="max-w-4xl mx-auto rounded-xl overflow-hidden bg-stone-50 md:flex md:justify-center">
                <Image
                  src={block.image_url}
                  alt={block.text || product.name}
                  width={1200}
                  height={800}
                  sizes="(max-width: 896px) 100vw, 896px"
                  className="w-full h-auto md:w-auto md:max-w-full md:max-h-[70vh]"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    )}
    </>
  )
}