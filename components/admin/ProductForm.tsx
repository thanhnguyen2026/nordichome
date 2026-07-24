'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Product, Category, ProductSpec, ProductContentBlock } from '@/types'
import ImageUploader from './ImageUploader'
import VariantsManager, { Variant } from './VariantsManager'
import { supabase } from '@/lib/supabase'
import { calcTaobaoCost } from '@/lib/taobaoCost'
import {
  Info, Images, Ruler, Rows3, Video, Tag, Search, Save, Lock, AlertTriangle,
  Lightbulb, TrendingUp, TrendingDown, Scale, CheckCircle2, XCircle, Eye, Star,
  Sparkles, Package, Package2, Truck, Clock, Loader2, Upload, HardDrive, Link as LinkIcon,
} from 'lucide-react'

interface Props {
  product?: Product
  categories: Category[]
  onSave: (data: Partial<Product>, variants: Variant[]) => Promise<void>
  onCancel: () => void
}

interface FormState {
  name: string
  slug: string
  sku: string
  category_id: string
  price: number | string
  sale_price: number | string
  cost_price: number | string
  taobao_price_cny: string
  short_desc: string
  description: string
  specs: ProductSpec[]
  content_blocks: ProductContentBlock[]
  cover_image: string
  images: string[]
  video_url: string
  weight: number | string
  origin_url: string
  in_stock: boolean
  stock: string
  is_preorder: boolean
  preorder_note: string
  is_bulky: boolean
  free_shipping: boolean
  is_visible: boolean
  is_featured: boolean
  is_new: boolean
  meta_title: string
  meta_description: string
}

export default function ProductForm({ product, categories, onSave, onCancel }: Props) {
  const [form, setForm] = useState<FormState>({
    name:             product?.name ?? '',
    slug:             product?.slug ?? '',
    sku:              product?.sku ?? '',
    category_id:      product?.category_id ?? '',
    price:            product?.price ?? 0,
    sale_price:       product?.sale_price ?? '',
    cost_price:       product?.cost_price ?? 0,
    taobao_price_cny: product?.taobao_price_cny != null ? String(product.taobao_price_cny) : '',
    short_desc:       product?.short_desc ?? '',
    description:      product?.description ?? '',
    specs:            product?.specs ?? [],
    content_blocks:   product?.content_blocks ?? [],
    cover_image:      product?.cover_image ?? '',
    images:           product?.images ?? [],
    video_url:        product?.video_url ?? '',
    weight:           product?.weight ?? 0.5,
    origin_url:       product?.origin_url ?? '',
    in_stock:         product?.in_stock ?? true,
    stock:            product?.stock != null ? String(product.stock) : '',
    is_preorder:      product?.is_preorder ?? false,
    preorder_note:    product?.preorder_note ?? '',
    is_bulky:         product?.is_bulky ?? false,
    free_shipping:    product?.free_shipping ?? false,
    is_visible:       product?.is_visible ?? true,
    is_featured:      product?.is_featured ?? false,
    is_new:           product?.is_new ?? false,
    meta_title:       product?.meta_title ?? '',
    meta_description: product?.meta_description ?? '',
  })
  const [variants, setVariants] = useState<Variant[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingBlock, setUploadingBlock] = useState<number | null>(null)

  const addSpec = () => set('specs', [...form.specs, { label: '', value: '' }])
  const updateSpec = (i: number, patch: Partial<ProductSpec>) =>
    set('specs', form.specs.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const removeSpec = (i: number) => set('specs', form.specs.filter((_, idx) => idx !== i))

  const addBlock = () => set('content_blocks', [...form.content_blocks, { image_url: '', text: '' }])
  const updateBlock = (i: number, patch: Partial<ProductContentBlock>) =>
    set('content_blocks', form.content_blocks.map((b, idx) => idx === i ? { ...b, ...patch } : b))
  const removeBlock = (i: number) => set('content_blocks', form.content_blocks.filter((_, idx) => idx !== i))

  const uploadBlockImage = async (i: number, file: File) => {
    setUploadingBlock(i)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.url) updateBlock(i, { image_url: data.url })
    setUploadingBlock(null)
  }

  // Load variants nếu đang sửa sản phẩm
  useEffect(() => {
    if (!product?.id) return
    supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setVariants(data.map(v => ({
          id:          v.id,
          group_name:  v.group_name,
          option_name: v.option_name,
          sku:         v.sku || '',
          price:       v.price?.toString() || '',
          cost_price:  v.cost_price?.toString() || '0',
          taobao_price_cny: v.taobao_price_cny != null ? String(v.taobao_price_cny) : '',
          stock:       v.stock?.toString() || '0',
          weight:      v.weight?.toString() || '0.5',
          image_url:   v.image_url || '',   // ← FIX: thêm dòng này
          sort_order:  v.sort_order,
        })))
      })
  }, [product?.id])

  // Tải công thức tính giá vốn Taobao (dùng chung mọi sản phẩm, cấu hình ở
  // trang Cài đặt) để gợi ý giá vốn từ giá gốc Taobao (¥).
  const [costSettings, setCostSettings] = useState<{ rate: number; fee: number; shipPerKg: number } | null>(null)
  useEffect(() => {
    supabase.from('settings').select('key,value')
      .in('key', ['taobao_exchange_rate', 'taobao_fee_percent', 'taobao_shipping_per_kg'])
      .then(({ data }) => {
        const s = Object.fromEntries(data?.map(r => [r.key, r.value]) ?? [])
        setCostSettings({
          rate:      Number(s.taobao_exchange_rate) || 0,
          fee:       Number(s.taobao_fee_percent) || 0,
          shipPerKg: Number(s.taobao_shipping_per_kg) || 0,
        })
      })
  }, [])

  const suggestedCost = costSettings && form.taobao_price_cny
    ? calcTaobaoCost({
        priceCny:      Number(form.taobao_price_cny) || 0,
        weightKg:      Number(form.weight) || 0,
        exchangeRate:  costSettings.rate,
        feePercent:    costSettings.fee,
        shippingPerKg: costSettings.shipPerKg,
      })
    : null

  // Lãi so với giá vốn — tính theo markup (lãi / giá vốn), không phải margin
  // (lãi / giá bán), vì admin hỏi "lời bao nhiêu % so với giá vốn".
  const priceNum = Number(form.price) || 0
  const costNum = Number(form.cost_price) || 0
  const profitAmount = priceNum - costNum
  const profitPercent = costNum > 0 ? (profitAmount / costNum) * 100 : null

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))

  const autoSlug = (name: string) =>
    name.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  // Có nhập số lượng cụ thể → tồn kho tự suy ra từ số đó, không dùng nút bật/tắt tay nữa
  const trackingStock = form.stock !== ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const stockNum = trackingStock ? Math.round(Number(form.stock)) : null
    await onSave({
      ...form,
      price:            Math.round(Number(form.price)),
      sale_price:       form.sale_price !== '' ? Math.round(Number(form.sale_price)) : null,
      cost_price:       Math.round(Number(form.cost_price)),
      taobao_price_cny: form.taobao_price_cny !== '' ? Number(form.taobao_price_cny) : null,
      weight:           Number(form.weight),
      origin_url:       form.origin_url || null,
      preorder_note:    form.preorder_note || null,
      video_url:        form.video_url || null,
      stock:            stockNum,
      in_stock:         trackingStock ? stockNum! > 0 : form.in_stock,
    }, variants)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

      {/* ── Thông tin cơ bản ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6 border border-stone-100">
        <h3 className="flex items-center gap-2 font-bold mb-4 text-sm text-stone-700">
          <Info size={16} className="text-stone-400" />
          Thông tin cơ bản
        </h3>
        <div className="grid grid-cols-2 gap-4">

          <div className="col-span-2">
            <label className="text-xs font-semibold text-stone-500 block mb-1">Tên sản phẩm *</label>
            <input
              value={form.name}
              onChange={e => { set('name', e.target.value); if (!product) set('slug', autoSlug(e.target.value)) }}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Slug URL</label>
            <input value={form.slug} onChange={e => set('slug', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Mã SKU</label>
            <input value={form.sku} onChange={e => set('sku', e.target.value)}
              placeholder="Để trống nếu không có"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Danh mục</label>
            <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400">
              <option value="">-- Chọn danh mục --</option>
              {(() => {
                const parents  = categories.filter(c => !c.parent_id)
                const children = (pid: string) => categories.filter(c => c.parent_id === pid)
                return parents.map(p => {
                  const kids = children(p.id)
                  return kids.length > 0 ? (
                    <optgroup key={p.id} label={p.name}>
                      <option value={p.id}>{p.name} (tất cả)</option>
                      {kids.map(k => <option key={k.id} value={k.id}>└─ {k.name}</option>)}
                    </optgroup>
                  ) : (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  )
                })
              })()}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Giá bán (₫) *</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*"
              value={form.price}
              onChange={e => set('price', e.target.value.replace(/\D/g, ''))}
              onBlur={e => set('price', String(Math.round(Number(e.target.value) || 0)))}
              placeholder="VD: 150000"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" required />
            {profitPercent != null && (
              <p className={`flex items-center gap-1 text-[11px] mt-1 ${profitAmount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {profitAmount >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                Lãi {profitAmount.toLocaleString('vi-VN')}₫ ({profitPercent.toFixed(0)}% so với giá vốn)
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Giá khuyến mãi (₫)</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*"
              value={form.sale_price}
              onChange={e => set('sale_price', e.target.value.replace(/\D/g, ''))}
              onBlur={e => set('sale_price', e.target.value ? String(Math.round(Number(e.target.value) || 0)) : '')}
              placeholder="Để trống nếu không có"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
          </div>

          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-stone-500 mb-1">
              <Lock size={10} />
              Giá Taobao gốc (¥) — Chỉ Admin
            </label>
            <input type="text" inputMode="decimal"
              value={form.taobao_price_cny}
              onChange={e => set('taobao_price_cny', e.target.value)}
              placeholder="VD: 20"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            <p className="text-[11px] text-stone-400 mt-1">
              Tự tính giá vốn theo công thức ở Cài đặt. Bỏ trống nếu muốn tự nhập giá vốn thẳng.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-stone-500 mb-1">
              <Lock size={10} />
              Giá vốn (₫) — Chỉ Admin
            </label>
            <input type="text" inputMode="numeric" pattern="[0-9]*"
              value={form.cost_price}
              onChange={e => set('cost_price', e.target.value.replace(/\D/g, ''))}
              onBlur={e => set('cost_price', String(Math.round(Number(e.target.value) || 0)))}
              placeholder="Giá Taobao + ship TQ-VN"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            {suggestedCost != null && (
              <p className="text-[11px] text-blue-600 mt-1 flex items-center gap-2">
                <Lightbulb size={11} />
                Gợi ý: {suggestedCost.toLocaleString('vi-VN')}₫
                <button type="button" onClick={() => set('cost_price', String(suggestedCost))}
                  className="text-blue-600 underline hover:text-blue-800 cursor-pointer">Dùng giá này</button>
              </p>
            )}
            <p className="flex items-center gap-1 text-[11px] text-red-400 mt-1">
              <AlertTriangle size={10} />
              Không hiển thị ra trang khách hàng
            </p>
          </div>

          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-stone-500 mb-1">
              <Scale size={11} />
              Cân nặng (kg)
            </label>
            <input type="number" step="0.1" min="0" value={form.weight}
              onChange={e => set('weight', e.target.value)}
              placeholder="VD: 0.4"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            <p className="text-[11px] text-stone-400 mt-1">Dùng tính phí ship GHTK</p>
          </div>

          <div className="col-span-2">
            <label className="flex items-center gap-1 text-xs font-semibold text-stone-500 mb-1">
              <Lock size={10} />
              Link Taobao — Chỉ Admin
            </label>
            <input value={form.origin_url} onChange={e => set('origin_url', e.target.value)}
              placeholder="https://item.taobao.com/item.htm?id=..."
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            <p className="flex items-center gap-1 text-[11px] text-red-400 mt-1">
              <AlertTriangle size={10} />
              Không hiển thị ra trang khách hàng
            </p>
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-stone-500 block mb-1">Mô tả ngắn</label>
            <textarea value={form.short_desc} onChange={e => set('short_desc', e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 resize-none" />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-stone-500 block mb-1">Mô tả chi tiết</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={8}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 resize-y" />
          </div>
        </div>
      </div>

      {/* ── Hình ảnh ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6 border border-stone-100">
        <h3 className="flex items-center gap-2 font-bold mb-4 text-sm text-stone-700">
          <Images size={16} className="text-stone-400" />
          Hình ảnh
        </h3>
        <ImageUploader
          coverImage={form.cover_image}
          images={form.images}
          onCoverChange={url => set('cover_image', url)}
          onImagesChange={imgs => set('images', imgs)}
        />
      </div>

      {/* ── Thông số kỹ thuật ────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6 border border-stone-100">
        <h3 className="flex items-center gap-2 font-bold mb-1 text-sm text-stone-700">
          <Ruler size={16} className="text-stone-400" />
          Thông số kỹ thuật
        </h3>
        <p className="text-xs text-stone-400 mb-3">Hiển thị dạng bảng ở trang chi tiết sản phẩm, VD: &quot;Độ dày thảm (mm)&quot; → &quot;10-15&quot;</p>
        <div className="space-y-2">
          {form.specs.map((spec, i) => (
            <div key={i} className="flex gap-2">
              <input value={spec.label} onChange={e => updateSpec(i, { label: e.target.value })}
                placeholder="Tên thông số"
                className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              <input value={spec.value} onChange={e => updateSpec(i, { value: e.target.value })}
                placeholder="Giá trị"
                className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              <button type="button" onClick={() => removeSpec(i)}
                className="text-red-400 hover:text-red-600 px-2 cursor-pointer">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addSpec}
          className="mt-3 bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-stone-200 transition cursor-pointer">
          + Thêm thông số
        </button>
      </div>

      {/* ── Nội dung mô tả (ảnh + chữ) ───────────────────────────── */}
      <div className="bg-white rounded-xl p-6 border border-stone-100">
        <h3 className="flex items-center gap-2 font-bold mb-1 text-sm text-stone-700">
          <Rows3 size={16} className="text-stone-400" />
          Nội dung mô tả (ảnh + chữ)
        </h3>
        <p className="text-xs text-stone-400 mb-3">
          Mỗi khối gồm 1 ảnh + 1 đoạn text tuỳ chọn, hiển thị full-width bên dưới trang chi tiết.
          Có thể để trống text nếu ảnh đã có chữ thiết kế sẵn.
        </p>
        <div className="space-y-4">
          {form.content_blocks.map((block, i) => (
            <div key={i} className="flex gap-3 border border-stone-100 rounded-lg p-3">
              <div className="relative w-24 h-24 flex-shrink-0 bg-stone-100 rounded-lg border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden">
                {block.image_url
                  ? <Image src={block.image_url} alt={`Khối ${i + 1}`} fill sizes="96px" className="object-cover" />
                  : <Images size={24} className="text-stone-300" />}
              </div>
              <div className="flex-1 space-y-2">
                <input type="file" accept="image/*" className="hidden" id={`block-file-${i}`}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadBlockImage(i, f) }} />
                <div className="flex gap-2">
                  <label htmlFor={`block-file-${i}`}
                    className="flex items-center gap-1.5 cursor-pointer bg-stone-100 border border-stone-200 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-stone-200 transition">
                    {uploadingBlock === i ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    {uploadingBlock === i ? 'Đang upload...' : 'Chọn ảnh'}
                  </label>
                  <button type="button" onClick={() => removeBlock(i)}
                    className="text-red-400 hover:text-red-600 text-xs cursor-pointer">Xoá khối</button>
                </div>
                <textarea value={block.text} onChange={e => updateBlock(i, { text: e.target.value })} rows={4}
                  placeholder="Đoạn mô tả đi kèm ảnh (để trống nếu ảnh đã có chữ)"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 resize-y" />
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addBlock}
          className="mt-3 bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-stone-200 transition cursor-pointer">
          + Thêm khối nội dung
        </button>
      </div>

      {/* ── Video ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6 border border-stone-100">
        <h3 className="flex items-center gap-2 font-bold mb-1 text-sm text-stone-700">
          <Video size={16} className="text-stone-400" />
          Video sản phẩm
        </h3>
        <p className="text-xs text-stone-400 mb-3">YouTube, Shorts, Facebook, TikTok, Google Drive, .mp4/.webm</p>
        <input value={form.video_url} onChange={e => set('video_url', e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
        {form.video_url?.includes('drive.google.com') && (
          <p className="flex items-center gap-1 text-xs text-amber-600 mt-1.5">
            <AlertTriangle size={11} />
            Nhớ để chế độ chia sẻ file là &quot;Bất kỳ ai có đường liên kết&quot; trên Google Drive, nếu không khách sẽ không xem được video.
          </p>
        )}
        {form.video_url && (
          <div className="mt-2 p-2.5 bg-stone-50 rounded-lg flex items-center gap-2 text-xs text-stone-500">
            <span className="flex items-center gap-1 flex-shrink-0">
              {form.video_url.includes('drive.google.com') ? <HardDrive size={12} /> : form.video_url.match(/\.(mp4|webm)/i) || form.video_url.includes('youtube') || form.video_url.includes('facebook') || form.video_url.includes('tiktok') ? <Video size={12} /> : <LinkIcon size={12} />}
              {form.video_url.includes('youtube') ? 'YouTube' :
               form.video_url.includes('facebook') ? 'Facebook' :
               form.video_url.includes('tiktok') ? 'TikTok' :
               form.video_url.includes('drive.google.com') ? 'Google Drive' :
               form.video_url.match(/\.(mp4|webm)/i) ? 'MP4' : 'Video'}
            </span>
            <span className="truncate text-stone-400 flex-1">{form.video_url}</span>
            <button type="button" onClick={() => set('video_url', '')}
              className="text-red-400 hover:text-red-600 flex-shrink-0 cursor-pointer">✕</button>
          </div>
        )}
      </div>

      {/* ── Biến thể ─────────────────────────────────────────────── */}
      <VariantsManager
        variants={variants}
        onChange={setVariants}
        isPreorder={form.is_preorder}
        costSettings={costSettings}
        // Giá bán/giá vốn CHUNG của sản phẩm — dùng làm giá trị kế thừa khi
        // biến thể để trống ô Giá bán/Giá vốn ("Trống = giá SP"), để tính
        // đúng % lãi hiển thị thay vì coi như giá vốn/giá bán = 0.
        productPrice={Number(form.price) || 0}
        productCostPrice={Number(form.cost_price) || 0}
      />

      {/* ── Trạng thái & Hiển thị ────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6 border border-stone-100">
        <h3 className="flex items-center gap-2 font-bold mb-4 text-sm text-stone-700">
          <Tag size={16} className="text-stone-400" />
          Trạng thái &amp; Hiển thị
        </h3>

        {/* Số lượng tồn kho — chỉ có ý nghĩa khi sản phẩm KHÔNG có biến thể
            (biến thể quản lý tồn kho riêng từng mẫu ở VariantsManager) */}
        {variants.length === 0 && (
          <div className="mb-4">
            <label className="flex items-center gap-1 text-xs font-semibold text-stone-500 mb-1">
              <Package size={11} />
              Số lượng tồn kho
            </label>
            <input type="text" inputMode="numeric" pattern="[0-9]*"
              value={form.stock}
              onChange={e => set('stock', e.target.value.replace(/\D/g, ''))}
              placeholder="Để trống nếu không theo dõi số lượng cụ thể"
              className="w-full max-w-xs border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            <p className="text-[11px] text-stone-400 mt-1">
              Có nhập số → tự trừ khi có đơn, tự cộng lại khi hủy đơn, chặn nếu hết hàng.
              Để trống → dùng nút &quot;Còn hàng&quot; bên dưới như trước giờ.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {trackingStock ? (
            <div className="flex items-center gap-2 text-sm text-stone-600">
              {Number(form.stock) > 0 ? <CheckCircle2 size={15} className="text-green-600" /> : <XCircle size={15} className="text-red-500" />}
              <span>{Number(form.stock) > 0 ? `Còn hàng (tự động, còn ${form.stock})` : 'Hết hàng (tự động)'}</span>
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.in_stock}
                onChange={e => set('in_stock', e.target.checked)} className="w-4 h-4 cursor-pointer" />
              <CheckCircle2 size={14} className="text-green-600" />
              <span className="text-sm">Còn hàng</span>
            </label>
          )}
          {([
            ['is_visible',  'Hiển thị',       Eye],
            ['is_featured', 'Nổi bật',        Star],
            ['is_new',      'Sản phẩm mới',   Sparkles],
          ] as const).map(([k, l, Icon]) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form[k]}
                onChange={e => set(k, e.target.checked)} className="w-4 h-4 cursor-pointer" />
              <Icon size={14} className="text-stone-400" />
              <span className="text-sm">{l}</span>
            </label>
          ))}

          <div className="col-span-2 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.is_preorder}
                onChange={e => set('is_preorder', e.target.checked)}
                className="w-4 h-4 accent-orange-500 cursor-pointer" />
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-orange-700">
                  <Clock size={13} />
                  Hàng đặt trước (Pre-order)
                </div>
                <div className="text-xs text-orange-500 mt-0.5">
                  Hiển thị badge &quot;Đặt trước&quot; kèm thời gian chờ thay vì &quot;Còn hàng&quot;
                </div>
              </div>
            </label>
            {form.is_preorder && (
              <div className="mt-3 pl-7">
                <label className="text-xs font-semibold text-orange-700 block mb-1">Thời gian chờ</label>
                <input value={form.preorder_note} onChange={e => set('preorder_note', e.target.value)}
                  placeholder="VD: 7-10 ngày"
                  className="w-full max-w-xs border border-orange-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-orange-400 bg-white" />
                <p className="text-[11px] text-orange-500 mt-1">Để trống sẽ chỉ hiện &quot;Đặt trước&quot;, không kèm số ngày</p>
              </div>
            )}
          </div>

          <label className="col-span-2 flex items-center gap-3 cursor-pointer bg-red-50 border border-red-100 rounded-xl px-4 py-3 hover:bg-red-100 transition">
            <input type="checkbox" checked={form.is_bulky}
              onChange={e => set('is_bulky', e.target.checked)}
              className="w-4 h-4 accent-red-500 cursor-pointer" />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                <Package2 size={13} />
                Hàng cồng kềnh
              </div>
              <div className="text-xs text-red-500 mt-0.5">
                Khi đặt hàng, khách sẽ được yêu cầu liên hệ tư vấn thay vì tự tính phí ship
              </div>
            </div>
          </label>

          <label className="col-span-2 flex items-center gap-3 cursor-pointer bg-green-50 border border-green-100 rounded-xl px-4 py-3 hover:bg-green-100 transition">
            <input type="checkbox" checked={form.free_shipping}
              onChange={e => set('free_shipping', e.target.checked)}
              className="w-4 h-4 accent-green-500 cursor-pointer" />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                <Truck size={13} />
                Luôn miễn phí ship
              </div>
              <div className="text-xs text-green-600 mt-0.5">
                Cân nặng sản phẩm này không tính vào phí ship của đơn — cộng dồn với freeship theo tổng đơn hàng ở Cài đặt
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* ── SEO ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6 border border-stone-100">
        <h3 className="flex items-center gap-2 font-bold mb-4 text-sm text-stone-700">
          <Search size={16} className="text-stone-400" />
          SEO
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Meta Title</label>
            <input value={form.meta_title} onChange={e => set('meta_title', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Meta Description</label>
            <textarea value={form.meta_description} onChange={e => set('meta_description', e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 resize-none" />
          </div>
        </div>
      </div>

      {/* ── Buttons ──────────────────────────────────────────────── */}
      <div className="flex gap-3 pb-10">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 bg-stone-800 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-stone-700 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
          <Save size={15} />
          {saving ? 'Đang lưu...' : 'Lưu sản phẩm'}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-stone-200 px-6 py-2.5 rounded-lg text-sm hover:bg-stone-50 transition cursor-pointer">
          Huỷ
        </button>
      </div>
    </form>
  )
}