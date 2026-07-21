import { supabase, PUBLIC_PRODUCT_COLUMNS } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'
import ProductCard from '@/components/store/ProductCard'
import Header from '@/components/store/Header'
import Footer from '@/components/store/Footer'
import Hero from '@/components/store/Hero'
import SectionHeading from '@/components/store/SectionHeading'
import Marquee, { MARQUEE_PRESETS, type MarqueePresetKey } from '@/components/store/Marquee'
import ParallaxQuote from '@/components/store/ParallaxQuote'
import RevealOnScroll from '@/components/store/RevealOnScroll'
import type { Look } from '@/components/store/ShopTheLook'
import type { Product, Campaign } from '@/types'
import { applyCampaignsToProducts } from '@/lib/campaignPrice'
import { Sofa } from 'lucide-react'
import { getCategoryTree } from '@/lib/categories'
import { getRatingSummaries } from '@/lib/reviewsSummary'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata() {
  const { data } = await supabase.from('settings').select('key,value')
  const s = Object.fromEntries(data?.map(r => [r.key, r.value]) ?? [])
  const title = s.meta_title || 'Nordic Home - Simplify & Enjoy'
  const description = s.meta_description || 'Nội thất phong cách Bắc Âu — thiết kế tinh tế, chất liệu tự nhiên bền vững.'
  return {
    // absolute: bỏ qua template "%s | Nordic Home" của layout gốc — trang chủ
    // đã tự mang tên thương hiệu, áp template vào sẽ bị lặp "Nordic Home" 2 lần.
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      images: s.banner_url ? [{ url: s.banner_url }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: s.banner_url ? [s.banner_url] : undefined,
    },
  }
}


export default async function HomePage() {
  const [{ data: settings }, { data: featuredRaw }, { data: newProdsRaw }, { data: cats }, { data: variantRows }, { data: looksRaw }, { data: campaignsRaw }, categoryTree] =
    await Promise.all([
      supabase.from('settings').select('key,value'),
      supabase.from('products').select(`${PUBLIC_PRODUCT_COLUMNS},category:categories(name,slug)`)
        .eq('is_featured', true).eq('is_visible', true).limit(8),
      supabase.from('products').select(`${PUBLIC_PRODUCT_COLUMNS},category:categories(name,slug)`)
        .eq('is_new', true).eq('is_visible', true).limit(8),
      supabase.from('categories').select('*').is('parent_id', null).eq('is_visible', true).order('sort_order'),
      supabase.from('product_variants').select('product_id, price'),
      supabase.from('looks').select(`
        id, title, description, image_url,
        hotspots:look_hotspots(
          id, x_percent, y_percent,
          product:products(id, name, slug, cover_image, price, sale_price)
        )
      `).eq('is_active', true).order('sort_order').order('created_at').limit(4),
      supabase.from('campaigns').select('*').eq('is_active', true),
      getCategoryTree(),
    ])

  // Tên cột select() truyền qua biến khiến Supabase không suy luận được kiểu
  // trả về tĩnh (chỉ literal string mới suy luận được) — ép kiểu tường minh.
  const featuredRawTyped = featuredRaw as unknown as Product[] | null
  const newProdsRawTyped = newProdsRaw as unknown as Product[] | null

  const looks = (looksRaw ?? []) as unknown as Look[]

  const s = Object.fromEntries(settings?.map(r => [r.key, r.value]) ?? [])

  // Khuyến mãi đang chạy — áp vào giá hiển thị, trừ sản phẩm đã tự set giá
  // khuyến mãi riêng.
  const now = new Date()
  const campaigns = (campaignsRaw ?? []) as unknown as Campaign[]
  const featured = featuredRawTyped ? applyCampaignsToProducts(featuredRawTyped, campaigns, now) : null
  const newProds = newProdsRawTyped ? applyCampaignsToProducts(newProdsRawTyped, campaigns, now) : null

  // Sao trên ProductCard — dark launch sau cờ riêng (khác reviews_is_active,
  // vốn chỉ bật khối đánh giá ở trang chi tiết). Mặc định TẮT.
  const showRatingOnCards = s.reviews_show_on_cards === '1'
  const ratingMap = showRatingOnCards
    ? await getRatingSummaries([...(featured ?? []), ...(newProds ?? [])].map(p => p.id))
    : {}

  // Dải marquee: admin cấu hình ở Cài đặt (nội dung, preset màu, icon, bật/tắt)
  // — mặc định vẫn hiện (chưa từng cấu hình ≠ tắt), text/preset rơi về giá
  // trị gốc nếu settings trống.
  const marqueeActive = s.marquee_is_active !== '0'
  const marqueeItems = String(s.marquee_text || 'Chất liệu tự nhiên;Freeship toàn quốc;Bảo hành 2 năm;Thiết kế Bắc Âu')
    .split(';').map((t: string) => t.trim()).filter(Boolean)
  const marqueePreset: MarqueePresetKey = s.marquee_preset && s.marquee_preset in MARQUEE_PRESETS
    ? (s.marquee_preset as MarqueePresetKey) : 'default'

  const productIdsWithVariants = new Set(variantRows?.map(v => v.product_id) ?? [])

  const minVariantPriceMap: Record<string, number> = {}
  variantRows?.forEach(v => {
    if (v.price == null) return
    const cur = minVariantPriceMap[v.product_id]
    if (cur == null || v.price < cur) minVariantPriceMap[v.product_id] = v.price
  })

  return (
    <>
      <Header settings={s} categories={categoryTree} campaigns={campaigns} />
      <main>
        <Hero settings={s} />

        {/* DANH MỤC */}
        {!!cats?.length && (
          <section className="max-w-6xl mx-auto px-4 pt-16">
            <SectionHeading number="01" eyebrow="Danh mục" title="Khám phá không gian sống" align="center" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {cats.map((cat, i) => (
                <RevealOnScroll key={cat.id} index={i}>
                  <Link href={`/products?category=${cat.slug}`}
                    className="group relative aspect-square rounded-2xl overflow-hidden block shadow-md hover:shadow-xl transition-shadow duration-300">
                    {cat.image_url ? (
                      <Image src={cat.image_url} alt={cat.name} fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full bg-stone-100 flex items-center justify-center">
                        <Sofa size={48} className="text-stone-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-bold text-base leading-tight drop-shadow-md">{cat.name}</p>
                      <p className="text-amber-300 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">Xem tất cả →</p>
                    </div>
                  </Link>
                </RevealOnScroll>
              ))}
            </div>
          </section>
        )}

        {marqueeActive && (
          <div className="mt-16">
            <Marquee items={marqueeItems} preset={marqueePreset} separatorIcon={s.marquee_separator_icon} />
          </div>
        )}

        {/* SẢN PHẨM NỔI BẬT */}
        {!!featured?.length && (
          <section className="bg-stone-50 pt-16 pb-16">
            <div className="max-w-6xl mx-auto px-4">
              <SectionHeading
                number="02"
                eyebrow="Nổi bật"
                title="Sản phẩm được yêu thích"
                align="left"
                numberSide="left"
                action={{ href: '/products?featured=true', label: 'Xem tất cả' }}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {featured.map((p, i) => (
                  <RevealOnScroll key={p.id} index={i} blur={false}>
                    <ProductCard product={p}
                      hasVariants={productIdsWithVariants.has(p.id)}
                      minVariantPrice={minVariantPriceMap[p.id] ?? null}
                      priority={i < 4}
                      rating={ratingMap[p.id]} />
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SẢN PHẨM MỚI */}
        {!!newProds?.length && (
          <section className="pt-16">
            <div className="max-w-6xl mx-auto px-4">
              <SectionHeading
                number="03"
                eyebrow="Mới nhất"
                title="Hàng mới về"
                align="left"
                numberSide="right"
                action={{ href: '/products?new=true', label: 'Xem tất cả' }}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {newProds.map((p, i) => (
                  <RevealOnScroll key={p.id} index={i} blur={false}>
                    <ProductCard product={p}
                      hasVariants={productIdsWithVariants.has(p.id)}
                      minVariantPrice={minVariantPriceMap[p.id] ?? null}
                      priority={i < 4}
                      rating={ratingMap[p.id]} />
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </section>
        )}

        {marqueeActive && (
          <div className="mt-16">
            <Marquee items={marqueeItems} preset={marqueePreset} separatorIcon={s.marquee_separator_icon} />
          </div>
        )}

        {/* SHOP THE LOOK */}
        {looks.length > 0 && (
          <section id="shop-the-look" className="max-w-6xl mx-auto px-4 pt-16">
            <SectionHeading number="04" eyebrow="Cảm hứng" title="Shop the Look" align="center" italic />
            <div className={`grid gap-8 ${
              looks.length === 1 ? 'grid-cols-1 max-w-lg mx-auto'
              : looks.length === 2 ? 'grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {looks.map((look, i) => {
                const dotCount = look.hotspots?.filter(h => h.product).length ?? 0
                // Nhịp điệu bất đối xứng: xen kẽ tỷ lệ ảnh dọc/ngang + lệch cao độ theo cột — cảm giác lookbook, không phải ô vuông đều tăm tắp
                const aspect = i % 3 === 0 ? 'aspect-[3/4]' : i % 3 === 1 ? 'aspect-[4/3]' : 'aspect-square'
                const offset = looks.length >= 3 && i % 2 === 1 ? 'lg:mt-10' : ''
                return (
                  <RevealOnScroll key={look.id} index={i} className={`group ${offset}`}>
                    {/* Ảnh thumbnail + dots trang trí — bấm vào ảnh cũng vào chi tiết,
                        khớp với hiệu ứng hover scale đang gợi ý "bấm được" */}
                    <Link href={`/looks/${look.id}`} className={`relative block ${aspect} rounded-2xl overflow-hidden mb-4 bg-stone-100`}>
                      <Image
                        src={look.image_url}
                        alt={look.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* Dots trang trí (không tương tác) */}
                      {look.hotspots?.filter(h => h.product).map(h => (
                        <div
                          key={h.id}
                          style={{ left: `${h.x_percent}%`, top: `${h.y_percent}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        >
                          <span className="absolute inset-0 rounded-full bg-white/60 animate-ping" />
                          <span className="relative flex w-5 h-5 rounded-full bg-white shadow-lg border-2 border-amber-400" />
                        </div>
                      ))}
                    </Link>

                    {/* Info */}
                    <p className="text-xs font-black tracking-[3px] uppercase text-stone-800 mb-1.5">
                      {look.title}
                    </p>
                    {look.description && (
                      <p className="text-sm text-stone-500 leading-relaxed mb-4 line-clamp-3">
                        {look.description}
                      </p>
                    )}
                    {dotCount > 0 && (
                      <p className="text-xs text-stone-400 mb-3">{dotCount} sản phẩm trong ảnh</p>
                    )}
                    <Link
                      href={`/looks/${look.id}`}
                      className="btn-sweep group/btn inline-block text-xs font-bold tracking-[2px] uppercase border border-stone-900 px-5 py-2.5"
                      style={{ ['--sweep-color' as string]: '#1c1917' }}
                    >
                      <span className="btn-sweep-label transition-colors duration-300 group-hover/btn:text-white">Xem chi tiết</span>
                    </Link>
                  </RevealOnScroll>
                )
              })}
            </div>
          </section>
        )}

        {/* BRAND INFO */}
        {/* mt-16: các section phía trên chỉ dùng pt (không pb) nên khoảng cách
            trắng→xám nhẹ nhàng là đủ, nhưng trắng→ĐEN tuyền cần khoảng đệm thật
            trước khi chạm nền — padding bên trong khối đen (py-20) chỉ tạo chỗ
            cho chữ, không thay được khoảng trắng ở NGOÀI khối trước khi vào */}
        <section className="mt-16 bg-stone-900 text-white py-20 text-center relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden>
            <ParallaxQuote />
          </div>
          <div className="relative max-w-xl mx-auto px-4">
            <p className="font-serif italic font-semibold text-sm tracking-[4px] uppercase text-stone-400 mb-5">Về chúng tôi</p>
            <h2 className="font-serif text-4xl font-semibold mb-5">{s.about_title || 'Về Nordic Home'}</h2>
            <p className="text-stone-300 leading-relaxed text-sm max-w-md mx-auto">
              {s.about_description || 'Chúng tôi mang đến những sản phẩm nội thất phong cách Bắc Âu — tối giản, bền vững, tạo nên không gian sống thực sự thoải mái và tinh tế.'}
            </p>
          </div>
        </section>
      </main>
      <Footer settings={s} />
    </>
  )
}
