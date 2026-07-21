import { supabase, PUBLIC_PRODUCT_COLUMNS, PUBLIC_REVIEW_COLUMNS } from '@/lib/supabase'
import Header from '@/components/store/Header'
import Footer from '@/components/store/Footer'
import { notFound } from 'next/navigation'
import ProductCard from '@/components/store/ProductCard'
import ProductDetailClient from '@/components/store/ProductDetailClient'
import ProductReviews, { type PublicReview } from '@/components/store/ProductReviews'
import RevealOnScroll from '@/components/store/RevealOnScroll'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { Product, Campaign } from '@/types'
import { applyCampaignsToProduct, applyCampaignsToProducts } from '@/lib/campaignPrice'
import { getCategoryTree } from '@/lib/categories'
import { safeJsonLd } from '@/lib/text'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { data: product } = await supabase
    .from('products')
    .select('name,short_desc,meta_title,meta_description,cover_image')
    .eq('slug', slug)
    .eq('is_visible', true)
    .single()

  if (!product) return {}

  const title = product.meta_title || product.name
  const description = product.meta_description || product.short_desc || undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: product.cover_image ? [{ url: product.cover_image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: product.cover_image ? [product.cover_image] : undefined,
    },
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const [{ data: settings }, { data: productRaw }, { data: campaignsRaw }, categoryTree] = await Promise.all([
    supabase.from('settings').select('key,value'),
    supabase
      .from('products')
      .select(`${PUBLIC_PRODUCT_COLUMNS},category:categories(name,slug)`)
      .eq('slug', slug)
      .eq('is_visible', true)
      .single(),
    supabase.from('campaigns').select('*').eq('is_active', true),
    getCategoryTree(),
  ])

  const s = Object.fromEntries(settings?.map(r => [r.key, r.value]) ?? [])
  if (!productRaw) return notFound()
  // Tên cột select() truyền qua biến khiến Supabase không suy luận được kiểu
  // trả về tĩnh (chỉ literal string mới suy luận được) — ép kiểu tường minh.
  const now = new Date()
  const campaigns = (campaignsRaw ?? []) as unknown as Campaign[]
  // Khuyến mãi đang chạy — trừ sản phẩm đã tự set giá khuyến mãi riêng.
  const product = applyCampaignsToProduct(productRaw as unknown as Product, campaigns, now)

  const allImages: string[] = [
    product.cover_image,
    ...(product.images || []),
  ].filter(Boolean)

  // Fetch related trước, rồi fetch variant counts của related.
  // Truyền tên cột dạng biến khiến Supabase không suy luận được kiểu trả về
  // tĩnh (chỉ literal string mới suy luận được) — ép kiểu tường minh ở đây.
  // Cờ bật/tắt tính năng đánh giá (dark launch) — mặc định TẮT tới khi admin bật
  // reviews_is_active='1' ở Cài đặt. Fetch review đã duyệt song song với sản phẩm
  // liên quan để không thêm round-trip.
  const reviewsEnabled = s.reviews_is_active === '1'
  const [{ data: relatedRaw }, reviewsRes] = await Promise.all([
    supabase
      .from('products')
      .select(PUBLIC_PRODUCT_COLUMNS)
      .eq('category_id', product.category_id)
      .neq('id', product.id)
      .eq('is_visible', true)
      .limit(4),
    reviewsEnabled
      ? supabase
          .from('reviews')
          .select(PUBLIC_REVIEW_COLUMNS)
          .eq('product_id', product.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  // Bảng reviews có thể CHƯA tạo (migration chưa chạy) — coi lỗi/thiếu là rỗng để
  // trang không vỡ; tính năng chỉ "mọc" ra khi đã chạy migration + bật cờ.
  const approvedReviews = ((reviewsRes as { data: unknown[] | null }).data ?? []) as PublicReview[]
  const reviewCount = approvedReviews.length
  const reviewAvg = reviewCount ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0

  let related = relatedRaw ? applyCampaignsToProducts(relatedRaw as unknown as Product[], campaigns, now) : []

  // Danh mục chưa đủ 4 sản phẩm khác (catalog còn mỏng) — bù thêm bằng hàng
  // mới nhất bất kỳ danh mục nào, để mục "Có thể bạn sẽ thích" không bao giờ
  // trống hoặc cụt ngủn, tránh khách hết hành trình mua sắm giữa chừng.
  if (related.length < 4) {
    const excludeIds = new Set([product.id, ...related.map(p => p.id)])
    const { data: fallbackRaw } = await supabase
      .from('products')
      .select(PUBLIC_PRODUCT_COLUMNS)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(4 - related.length + excludeIds.size)
    const fallback = (fallbackRaw as unknown as Product[] | null)
      ?.filter(p => !excludeIds.has(p.id))
      .slice(0, 4 - related.length) ?? []
    related = [...related, ...applyCampaignsToProducts(fallback, campaigns, now)]
  }

  const relatedIds = related?.map(p => p.id) ?? []
  const { data: variantRows } = relatedIds.length
    ? await supabase.from('product_variants').select('product_id, price').in('product_id', relatedIds)
    : { data: [] }

  const productIdsWithVariants = new Set(variantRows?.map(v => v.product_id) ?? [])

  const minVariantPriceMap: Record<string, number> = {}
  variantRows?.forEach(v => {
    if (v.price == null) return
    const cur = minVariantPriceMap[v.product_id]
    if (cur == null || v.price < cur) minVariantPriceMap[v.product_id] = v.price
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.short_desc || product.meta_description || undefined,
    image: allImages,
    sku: product.sku || undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'VND',
      price: product.sale_price ?? product.price,
      availability: product.in_stock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/products/${product.slug}`,
    },
    // Rich snippet sao vàng trên Google — CHỈ khi có đánh giá thật đã duyệt
    // (không bịa aggregateRating khi chưa có review → đúng policy của Google).
    ...(reviewCount > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: reviewAvg.toFixed(1),
        reviewCount,
      },
      review: approvedReviews.slice(0, 5).map(r => ({
        '@type': 'Review',
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
        author: { '@type': 'Person', name: r.author_name },
        reviewBody: r.comment || undefined,
        datePublished: r.created_at?.slice(0, 10),
      })),
    } : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <Header settings={s} categories={categoryTree} campaigns={campaigns} />
      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-stone-400 mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-stone-600 transition">Trang chủ</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-stone-600 transition">Sản phẩm</Link>
          {product.category && (
            <>
              <span>/</span>
              <Link
                href={`/products?category=${product.category.slug}`}
                className="hover:text-stone-600 transition"
              >
                {product.category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-stone-700 font-semibold">{product.name}</span>
        </div>

        <ProductDetailClient product={product} allImages={allImages} settings={s} />

        {/* Đánh giá khách hàng — chỉ render khi bật cờ (dark launch); component tự
            ẩn phần điểm/danh sách nếu chưa có review duyệt (Cách B). */}
        {reviewsEnabled && (
          <ProductReviews
            productId={product.id}
            reviews={approvedReviews}
            avg={reviewAvg}
            count={reviewCount}
          />
        )}

        {/* Sản phẩm liên quan */}
        {!!related?.length && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-black">Sản phẩm liên quan</h2>
              <div className="flex-1 border-t border-stone-100" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {related.map((p, i) => (
                <RevealOnScroll key={p.id} index={i} blur={false}>
                  <ProductCard
                    product={p}
                    hasVariants={productIdsWithVariants.has(p.id)}
                    minVariantPrice={minVariantPriceMap[p.id] ?? null}
                  />
                </RevealOnScroll>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer settings={s} />
    </>
  )
}
