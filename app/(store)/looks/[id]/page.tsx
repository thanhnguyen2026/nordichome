import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/store/Header'
import Footer from '@/components/store/Footer'
import ShopTheLook, { Look, HotspotProduct } from '@/components/store/ShopTheLook'
import LookBundle from '@/components/store/LookBundle'

export const dynamic = 'force-dynamic'

interface RawVariant {
  id: string
  group_name: string
  option_name: string
  price: number | null
  stock: number
  sort_order: number
}

// Chọn biến thể mặc định giống VariantSelector (ưu tiên còn hàng, rẻ nhất) —
// dùng để hiển thị giá/nhãn "mua trọn bộ" nhất quán với trang sản phẩm.
function pickDefaultVariant(variants: RawVariant[], basePrice: number) {
  const inStock = variants.filter(v => v.stock > 0)
  const pool = inStock.length > 0 ? inStock : variants
  return pool.reduce((min, v) => ((v.price ?? basePrice) < (min.price ?? basePrice) ? v : min), pool[0])
}

// Nhãn biến thể mặc định: option rẻ nhất + option đầu (theo sort_order) của
// các nhóm còn lại — ví dụ "1350x450x460mm / Tự nhiên".
function buildVariantLabel(variants: RawVariant[], def: RawVariant) {
  const groups = Array.from(new Set(variants.map(v => v.group_name)))
  return groups
    .map(g => g === def.group_name ? def : variants.filter(v => v.group_name === g).sort((a, b) => a.sort_order - b.sort_order)[0])
    .filter((v): v is RawVariant => Boolean(v))
    .map(v => v.option_name)
    .join(' / ')
}

function enrichProduct(p: HotspotProduct & { variants?: RawVariant[] }): HotspotProduct {
  const basePrice = p.sale_price ?? p.price
  const variants = p.variants ?? []
  if (variants.length === 0) {
    return { ...p, variant_id: null, variant_label: null, price_ambiguous: false }
  }
  const def = pickDefaultVariant(variants, basePrice)
  const effectivePrice = def.price ?? basePrice
  const priceAmbiguous = new Set(variants.map(v => v.price ?? basePrice)).size > 1
  return {
    ...p,
    price: effectivePrice,
    sale_price: null,
    variant_id: def.id,
    variant_label: buildVariantLabel(variants, def),
    price_ambiguous: priceAmbiguous,
  }
}

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
        product:products(
          id, name, slug, sku, category_id, cover_image, images, price, sale_price,
          short_desc, description, video_url, weight, in_stock, is_preorder,
          is_visible, is_featured, is_new, is_bulky, meta_title, meta_description,
          variants:product_variants(id, group_name, option_name, price, stock, sort_order)
        )
      )
    `).eq('id', id).eq('is_active', true).single(),
  ])

  if (!look) return notFound()

  const s = Object.fromEntries(settings?.map(r => [r.key, r.value]) ?? [])
  const rawLook = look as unknown as Look & {
    hotspots: { id: string; x_percent: number; y_percent: number; product: (HotspotProduct & { variants?: RawVariant[] }) | null }[]
  }

  const hotspots = rawLook.hotspots.map(h => ({
    ...h,
    product: h.product ? enrichProduct(h.product) : null,
  }))
  const enrichedLook: Look = { ...rawLook, hotspots }

  const seen = new Set<string>()
  const products = hotspots
    .map(h => h.product)
    .filter((p): p is HotspotProduct => Boolean(p))
    .filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

  return (
    <>
      <Header settings={s} />
      <main className="max-w-6xl mx-auto px-4 py-10">

        {/* Breadcrumb */}
        <div className="text-xs text-stone-500 mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-stone-600 transition">Trang chủ</Link>
          <span>/</span>
          <Link href="/#shop-the-look" className="hover:text-stone-600 transition">Shop the Look</Link>
          <span>/</span>
          <span className="text-stone-700 font-semibold">{look.title}</span>
        </div>

        {look.description && (
          <p className="text-stone-500 text-sm mb-8 leading-relaxed max-w-2xl">{look.description}</p>
        )}

        {/* Layout trái (danh sách + mua trọn bộ) / phải (ảnh + hotspot) */}
        <div className="grid md:grid-cols-[380px_1fr] gap-10 items-start">
          <div className="order-2 md:order-1">
            {products.length > 0 ? (
              <LookBundle title={look.title} products={products} />
            ) : (
              <h1 className="text-2xl font-serif italic text-stone-900">{look.title}</h1>
            )}
          </div>
          <div className="order-1 md:order-2">
            <ShopTheLook look={enrichedLook} />
          </div>
        </div>

      </main>
      <Footer settings={s} />
    </>
  )
}
