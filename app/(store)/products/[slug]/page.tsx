import { supabase } from '@/lib/supabase'
import Header from '@/components/store/Header'
import Footer from '@/components/store/Footer'
import { notFound } from 'next/navigation'
import ProductCard from '@/components/store/ProductCard'
import ProductDetailClient from '@/components/store/ProductDetailClient'
import RevealOnScroll from '@/components/store/RevealOnScroll'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const [{ data: settings }, { data: product }] = await Promise.all([
    supabase.from('settings').select('key,value'),
    supabase
      .from('products')
      .select('*,category:categories(name,slug)')
      .eq('slug', slug)
      .eq('is_visible', true)
      .single(),
  ])

  const s = Object.fromEntries(settings?.map(r => [r.key, r.value]) ?? [])
  if (!product) return notFound()

  const allImages: string[] = [
    product.cover_image,
    ...(product.images || []),
  ].filter(Boolean)

  // Fetch related trước, rồi fetch variant counts của related
  const { data: related } = await supabase
    .from('products')
    .select('*')
    .eq('category_id', product.category_id)
    .neq('id', product.id)
    .eq('is_visible', true)
    .limit(4)

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

  return (
    <>
      <Header settings={s} />
      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-stone-400 mb-6 flex items-center gap-2">
          <a href="/" className="hover:text-stone-600 transition">Trang chủ</a>
          <span>/</span>
          <a href="/products" className="hover:text-stone-600 transition">Sản phẩm</a>
          {(product as any).category && (
            <>
              <span>/</span>
              <a
                href={`/products?category=${(product as any).category.slug}`}
                className="hover:text-stone-600 transition"
              >
                {(product as any).category.name}
              </a>
            </>
          )}
          <span>/</span>
          <span className="text-stone-700 font-semibold">{product.name}</span>
        </div>

        <ProductDetailClient product={product as any} allImages={allImages} settings={s} />

        {/* Sản phẩm liên quan */}
        {!!related?.length && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-black">Sản phẩm liên quan</h2>
              <div className="flex-1 border-t border-stone-100" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {related.map((p, i) => (
                <RevealOnScroll key={p.id} index={i}>
                  <ProductCard
                    product={p as any}
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