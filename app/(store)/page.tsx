import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import ProductCard from '@/components/store/ProductCard'
import Header from '@/components/store/Header'
import Footer from '@/components/store/Footer'
import RevealOnScroll from '@/components/store/RevealOnScroll'

export async function generateMetadata() {
  const { data } = await supabase.from('settings').select('key,value')
  const s = Object.fromEntries(data?.map(r => [r.key, r.value]) ?? [])
  return { title: s.meta_title, description: s.meta_description }
}

const CATEGORY_IMAGES: Record<string, string> = {
  'nội thất': 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=958&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=600&q=80',
  'sofa': 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=958&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=600&q=80',
  'phòng khách': 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
  'phòng ngủ': 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&q=80',
  'phòng ăn': 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600&q=80',
  'bàn ăn': 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600&q=80',
  'nhà bếp': 'https://images.unsplash.com/photo-1628797285815-453c1d0d21e3?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OXx8a2l0Y2hlbnxlbnwwfHwwfHx8Mg%3D%3D?w=600&q=80',
  'phòng làm việc': 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&q=80',
  'đèn': 'https://images.unsplash.com/photo-1513506003901-1e6a35d8d0e2?w=600&q=80',
  'đèn trang trí': 'https://plus.unsplash.com/premium_photo-1672166939372-5b16118eee45?q=80&w=627&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=600&q=80',
  'decor': 'https://images.unsplash.com/photo-1721814219059-ba22094eb1c3?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=600&q=80',
  'trang trí': 'https://plus.unsplash.com/premium_photo-1668704252726-452ce872b349?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=600&q=80',
  'ghế': 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600&q=80',
  'tủ': 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=600&q=80',
  'kệ': 'https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?w=600&q=80',
  'giường': 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&q=80',
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80'

function getCategoryImage(name: string): string {
  const key = name.toLowerCase().trim()
  return CATEGORY_IMAGES[key] || DEFAULT_IMAGE
}

export default async function HomePage() {
  const [{ data: settings }, { data: featured }, { data: newProds }, { data: cats }, { data: variantRows }, { data: looksRaw }] =
    await Promise.all([
      supabase.from('settings').select('key,value'),
      supabase.from('products').select('*,category:categories(name,slug)')
        .eq('is_featured', true).eq('is_visible', true).limit(8),
      supabase.from('products').select('*,category:categories(name,slug)')
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
    ])

  const looks = (looksRaw ?? []) as any[]

  const s = Object.fromEntries(settings?.map(r => [r.key, r.value]) ?? [])

  const productIdsWithVariants = new Set(variantRows?.map(v => v.product_id) ?? [])

  const minVariantPriceMap: Record<string, number> = {}
  variantRows?.forEach(v => {
    if (v.price == null) return
    const cur = minVariantPriceMap[v.product_id]
    if (cur == null || v.price < cur) minVariantPriceMap[v.product_id] = v.price
  })

  return (
    <>
      <Header settings={s} />
      <main>
        {/* BANNER — mobile: full-screen, nội dung neo đáy · desktop: banner cố định, nội dung căn giữa */}
        <section className="relative min-h-[100svh] md:min-h-0 md:h-[520px] flex flex-col justify-end md:justify-center md:items-center overflow-hidden bg-stone-100">
          {s.banner_url && (
            <Image src={s.banner_url} alt="Banner" fill priority sizes="100vw" className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10 md:bg-black/30 md:bg-none" />
          <div className="relative text-left md:text-center text-white px-6 md:px-4 pb-14 md:pb-0">
            {s.hero_label && (
              <p className="font-serif italic text-sm tracking-[4px] uppercase mb-4 text-amber-200/90">
                {s.hero_label}
              </p>
            )}
            <h1 className="text-[2.75rem] leading-[1.05] md:text-5xl md:leading-tight font-black mb-4">
              {s.hero_title_1 || 'Không gian sống'}<br />
              <span className="text-amber-300">{s.hero_title_2 || 'tối giản & sang trọng'}</span>
            </h1>
            <p className="text-stone-200 mb-8 md:mb-7 text-base md:text-sm leading-relaxed max-w-sm md:max-w-none">
              {s.hero_subtitle || 'Nội thất phong cách Bắc Âu — thiết kế tinh tế, chất liệu tự nhiên bền vững'}
            </p>
            <a href="/products"
              className="block md:inline-block text-center bg-stone-900 text-amber-100 px-8 py-4 md:py-3 rounded-full font-bold text-sm hover:bg-stone-800 transition border border-stone-700">
              {s.hero_button_text || 'Khám phá ngay'} →
            </a>
            {(s.hero_trust_1 || s.hero_trust_2 || s.hero_trust_3) && (
              <div className="flex flex-wrap items-center justify-start md:justify-center gap-x-5 gap-y-1.5 mt-7 text-white/50 text-xs tracking-wide">
                {[s.hero_trust_1, s.hero_trust_2, s.hero_trust_3].filter(Boolean).map((t, i, arr) => (
                  <>
                    <span key={t}>{t}</span>
                    {i < arr.length - 1 && <span key={`sep-${i}`} className="text-white/20">·</span>}
                  </>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* DANH MỤC */}
        {!!cats?.length && (
          <section className="max-w-6xl mx-auto px-4 py-16">
            <div className="text-center mb-10">
              <p className="font-serif italic font-semibold text-sm tracking-[4px] uppercase text-amber-600/80 mb-2">Danh mục</p>
              <h2 className="font-serif text-3xl font-semibold text-stone-900">Khám phá không gian sống</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {cats.map((cat, i) => (
                <RevealOnScroll key={cat.id} index={i}>
                  <a href={`/products?category=${cat.slug}`}
                    className="group relative aspect-square rounded-2xl overflow-hidden block shadow-md hover:shadow-xl transition-shadow duration-300">
                    <Image src={(cat as any).image_url || getCategoryImage(cat.name)} alt={cat.name} fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-bold text-base leading-tight drop-shadow-md">{cat.name}</p>
                      <p className="text-amber-300 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">Xem tất cả →</p>
                    </div>
                  </a>
                </RevealOnScroll>
              ))}
            </div>
          </section>
        )}

        {/* SẢN PHẨM NỔI BẬT */}
        {!!featured?.length && (
          <section className="bg-stone-50 py-16">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <p className="font-serif italic font-semibold text-sm tracking-[3px] uppercase text-amber-600/80 mb-1">Nổi bật</p>
                  <h2 className="font-serif text-3xl font-semibold text-stone-900">Sản phẩm được yêu thích</h2>
                </div>
                <a href="/products?featured=true" className="text-sm font-semibold hover:text-amber-700">Xem tất cả →</a>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {featured.map((p, i) => (
                  <RevealOnScroll key={p.id} index={i}>
                    <ProductCard product={p as any}
                      hasVariants={productIdsWithVariants.has(p.id)}
                      minVariantPrice={minVariantPriceMap[p.id] ?? null} />
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SẢN PHẨM MỚI */}
        {!!newProds?.length && (
          <section className="py-16">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <p className="font-serif italic font-semibold text-sm tracking-[3px] uppercase text-amber-600/80 mb-1">Mới nhất</p>
                  <h2 className="font-serif text-3xl font-semibold text-stone-900">Hàng mới về</h2>
                </div>
                <a href="/products?new=true" className="text-sm font-semibold hover:text-amber-700">Xem tất cả →</a>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {newProds.map((p, i) => (
                  <RevealOnScroll key={p.id} index={i}>
                    <ProductCard product={p as any}
                      hasVariants={productIdsWithVariants.has(p.id)}
                      minVariantPrice={minVariantPriceMap[p.id] ?? null} />
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SHOP THE LOOK */}
        {looks.length > 0 && (
          <section id="shop-the-look" className="max-w-6xl mx-auto px-4 py-16">
            <div className="text-center mb-10">
              <p className="font-serif italic font-semibold text-sm tracking-[4px] uppercase text-amber-600/80 mb-2">Cảm hứng</p>
              <h2 className="font-serif text-4xl font-normal italic text-stone-900">Shop the Look</h2>
            </div>
            <div className={`grid gap-8 ${
              looks.length === 1 ? 'grid-cols-1 max-w-lg mx-auto'
              : looks.length === 2 ? 'grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {looks.map((look: any, i: number) => {
                const dotCount = look.hotspots?.filter((h: any) => h.product).length ?? 0
                // Nhịp điệu bất đối xứng: xen kẽ tỷ lệ ảnh dọc/ngang + lệch cao độ theo cột — cảm giác lookbook, không phải ô vuông đều tăm tắp
                const aspect = i % 3 === 0 ? 'aspect-[3/4]' : i % 3 === 1 ? 'aspect-[4/3]' : 'aspect-square'
                const offset = looks.length >= 3 && i % 2 === 1 ? 'lg:mt-10' : ''
                return (
                  <RevealOnScroll key={look.id} index={i} className={`group ${offset}`}>
                    {/* Ảnh thumbnail + dots trang trí */}
                    <div className={`relative ${aspect} rounded-2xl overflow-hidden mb-4 bg-stone-100`}>
                      <Image
                        src={look.image_url}
                        alt={look.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* Dots trang trí (không tương tác) */}
                      {look.hotspots?.filter((h: any) => h.product).map((h: any) => (
                        <div
                          key={h.id}
                          style={{ left: `${h.x_percent}%`, top: `${h.y_percent}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        >
                          <span className="absolute inset-0 rounded-full bg-white/60 animate-ping" />
                          <span className="relative flex w-5 h-5 rounded-full bg-white shadow-lg border-2 border-amber-400" />
                        </div>
                      ))}
                    </div>

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
                    <a
                      href={`/looks/${look.id}`}
                      className="inline-block text-xs font-bold tracking-[2px] uppercase border border-stone-900 px-5 py-2.5 hover:bg-stone-900 hover:text-white transition-colors duration-200"
                    >
                      Xem chi tiết
                    </a>
                  </RevealOnScroll>
                )
              })}
            </div>
          </section>
        )}

        {/* BRAND INFO */}
        <section className="bg-stone-900 text-white py-20 text-center relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden>
            <span className="font-serif text-[18rem] text-white/[0.04] leading-none">"</span>
          </div>
          <div className="relative max-w-xl mx-auto px-4">
            <p className="font-serif italic font-semibold text-sm tracking-[4px] uppercase text-stone-500 mb-5">Về chúng tôi</p>
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