import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Header from '@/components/store/Header'
import Footer from '@/components/store/Footer'
import ShopTheLook, { Look, HotspotProduct } from '@/components/store/ShopTheLook'

export const dynamic = 'force-dynamic'

export default async function LookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [{ data: settings }, { data: look }] = await Promise.all([
    supabase.from('settings').select('key,value'),
    supabase.from('looks').select(`
      id, title, description, image_url,
      hotspots:look_hotspots(
        id, x_percent, y_percent,
        product:products(id, name, slug, cover_image, price, sale_price)
      )
    `).eq('id', id).eq('is_active', true).single(),
  ])

  if (!look) return notFound()

  const s = Object.fromEntries(settings?.map(r => [r.key, r.value]) ?? [])
  const typedLook = look as unknown as Look
  const hotspots = typedLook.hotspots ?? []
  const productsRaw = hotspots.map(h => h.product).filter((p): p is HotspotProduct => Boolean(p))
  const seen = new Set<string>()
  const products = productsRaw.filter(p => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
  const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

  return (
    <>
      <Header settings={s} />
      <main className="max-w-5xl mx-auto px-4 py-10">

        {/* Breadcrumb */}
        <div className="text-xs text-stone-400 mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-stone-600 transition">Trang chủ</Link>
          <span>/</span>
          <Link href="/#shop-the-look" className="hover:text-stone-600 transition">Shop the Look</Link>
          <span>/</span>
          <span className="text-stone-700 font-semibold">{look.title}</span>
        </div>

        {/* Look title */}
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-wide uppercase">{look.title}</h1>
          {look.description && (
            <p className="text-stone-500 text-sm mt-1 leading-relaxed">{look.description}</p>
          )}
        </div>

        {/* Interactive image */}
        <ShopTheLook look={typedLook} />

        {/* Product list */}
        {products.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xs font-black tracking-[4px] uppercase text-stone-400 mb-6">
              Sản phẩm trong ảnh ({products.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {products.map(p => (
                <Link key={p.id} href={`/products/${p.slug}`}
                  className="group bg-white rounded-2xl border border-stone-100 overflow-hidden hover:shadow-md transition">
                  <div className="relative aspect-square overflow-hidden bg-stone-50">
                    <Image src={p.cover_image} alt={p.name} fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold text-stone-800 line-clamp-2 leading-snug mb-1">{p.name}</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-amber-700">
                        {fmt(p.sale_price ?? p.price)}
                      </span>
                      {p.sale_price && (
                        <span className="text-xs text-stone-400 line-through">{fmt(p.price)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </main>
      <Footer settings={s} />
    </>
  )
}
