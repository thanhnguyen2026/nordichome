import { supabase, PUBLIC_PRODUCT_COLUMNS } from '@/lib/supabase'
import Header from '@/components/store/Header'
import Footer from '@/components/store/Footer'
import ProductCard from '@/components/store/ProductCard'
import CategorySidebar from '@/components/store/CategorySidebar'
import SortSelect from '@/components/store/SortSelect'
import RevealOnScroll from '@/components/store/RevealOnScroll'
import { PackageOpen } from 'lucide-react'
import type { Product, Campaign } from '@/types'
import Link from 'next/link'
import { applyCampaignsToProducts } from '@/lib/campaignPrice'
import { getCategoryTree } from '@/lib/categories'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; featured?: string; new?: string; sort?: string }>
}) {
  const sp = await searchParams

  const [{ data: settings }, { data: categories }, { data: allProds }, { data: variantCounts }, { data: campaignsRaw }, categoryTree] = await Promise.all([
    supabase.from('settings').select('key,value'),
    supabase.from('categories').select('*').eq('is_visible', true).order('sort_order'),
    supabase.from('products').select('id,category_id').eq('is_visible', true),
    // Lấy price của tất cả variants để tính giá thấp nhất mỗi SP
    supabase.from('product_variants').select('product_id, price'),
    supabase.from('campaigns').select('*').eq('is_active', true),
    getCategoryTree(),
  ])

  const s = Object.fromEntries(settings?.map(r => [r.key, r.value]) ?? [])
  const campaigns = (campaignsRaw ?? []) as unknown as Campaign[]

  const productIdsWithVariants = new Set(variantCounts?.map(v => v.product_id) ?? [])

  // Tính giá thấp nhất theo product_id
  const minVariantPriceMap: Record<string, number> = {}
  variantCounts?.forEach(v => {
    if (v.price == null) return
    const cur = minVariantPriceMap[v.product_id]
    if (cur == null || v.price < cur) minVariantPriceMap[v.product_id] = v.price
  })

  // Tính số sản phẩm cho từng danh mục (tính cả con)
  const countMap: Record<string, number> = {}
  categories?.forEach(cat => {
    const children = categories.filter(c => c.parent_id === cat.id)
    const ids = [cat.id, ...children.map(c => c.id)]
    countMap[cat.id] = allProds?.filter(p => ids.includes(p.category_id)).length || 0
  })

  // Danh mục đang chọn
  const activeCategory = categories?.find(c => c.slug === sp.category)
  let categoryIds: string[] = []
  if (activeCategory) {
    const children = categories?.filter(c => c.parent_id === activeCategory.id) || []
    categoryIds = [activeCategory.id, ...children.map(c => c.id)]
  }

  // Build query sản phẩm
  let query = supabase
    .from('products')
    .select(`${PUBLIC_PRODUCT_COLUMNS},category:categories(name,slug)`)
    .eq('is_visible', true)

  if (categoryIds.length > 0) {
    query = query.in('category_id', categoryIds)
  } else if (sp.featured === 'true') {
    query = query.eq('is_featured', true)
  } else if (sp.new === 'true') {
    query = query.eq('is_new', true)
  }

  if (sp.sort === 'price_asc') query = query.order('price', { ascending: true })
  else if (sp.sort === 'price_desc') query = query.order('price', { ascending: false })
  else query = query.order('created_at', { ascending: false })

  // Tên cột select() truyền qua biến khiến Supabase không suy luận được kiểu
  // trả về tĩnh (chỉ literal string mới suy luận được) — ép kiểu tường minh.
  const { data: productsRaw } = await query
  const productsTyped = productsRaw as unknown as Product[] | null
  // Khuyến mãi đang chạy — trừ sản phẩm đã tự set giá khuyến mãi riêng.
  const products = productsTyped ? applyCampaignsToProducts(productsTyped, campaigns, new Date()) : null

  // Breadcrumbs
  const parentCat = activeCategory?.parent_id
    ? categories?.find(c => c.id === activeCategory.parent_id)
    : null

  const pageTitle = activeCategory?.name ||
    (sp.featured ? 'Sản phẩm nổi bật' : sp.new ? 'Hàng mới về' : 'Tất cả sản phẩm')

  return (
    <>
      <Header settings={s} categories={categoryTree} campaigns={campaigns} />

      <div className="border-b border-stone-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-2 text-xs text-stone-400">
          <Link href="/" className="hover:text-stone-700 transition">Trang chủ</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-stone-700 transition">Sản phẩm</Link>
          {parentCat && (
            <>
              <span>/</span>
              <Link href={`/products?category=${parentCat.slug}`} className="hover:text-stone-700 transition">
                {parentCat.name}
              </Link>
            </>
          )}
          {activeCategory && (
            <>
              <span>/</span>
              <span className="text-stone-700 font-semibold">{activeCategory.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Mobile: category pills scrollable — ẩn trên desktop */}
      <div className="md:hidden relative border-b border-stone-100 bg-white">
        <div className="overflow-x-auto flex gap-2 px-4 py-3">
          <Link href="/products"
            className={`flex-shrink-0 text-xs px-3.5 py-2 rounded-full font-semibold transition whitespace-nowrap ${!sp.category ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
            Tất cả
          </Link>
          {categories?.filter(c => !c.parent_id).map(cat => (
            <Link key={cat.id} href={`/products?category=${cat.slug}`}
              className={`flex-shrink-0 text-xs px-3.5 py-2 rounded-full font-semibold transition whitespace-nowrap ${sp.category === cat.slug ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              {cat.name}
              {(countMap[cat.id] || 0) > 0 && (
                <span className="ml-1 opacity-60">{countMap[cat.id]}</span>
              )}
            </Link>
          ))}
        </div>
        {/* Gợi ý còn danh mục phía sau — mờ dần mép phải */}
        <div className="absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 flex gap-8">
        <CategorySidebar
          categories={categories || []}
          activeSlug={sp.category}
          countMap={countMap}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-black text-stone-900">{pageTitle}</h1>
              <p className="text-stone-400 text-sm mt-0.5">{products?.length || 0} sản phẩm</p>
            </div>
            <SortSelect defaultValue={sp.sort} />
          </div>

          {!products?.length ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <PackageOpen className="w-20 h-20 text-slate-300 mb-4" strokeWidth={1} />
              <p className="text-stone-600 font-semibold text-base mb-1">Chưa có sản phẩm nào trong danh mục này</p>
              <p className="text-stone-400 text-sm mb-6">Hãy thử xem các danh mục khác nhé!</p>
              <div className="flex gap-3 flex-wrap justify-center">
                <Link href="/products" className="bg-stone-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-stone-700 transition">
                  Xem tất cả sản phẩm
                </Link>
                <Link href="/" className="border border-stone-300 text-stone-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-stone-50 transition">
                  Về trang chủ
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {products.map((p, i) => (
                <RevealOnScroll key={p.id} index={i} blur={false}>
                  <ProductCard
                    product={p}
                    hasVariants={productIdsWithVariants.has(p.id)}
                    minVariantPrice={minVariantPriceMap[p.id] ?? null}
                    priority={i < 6}
                  />
                </RevealOnScroll>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer settings={s} />
    </>
  )
}