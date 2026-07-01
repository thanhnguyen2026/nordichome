'use client'
import { useState, useEffect } from 'react'
import { Product, Category } from '@/types'
import ImageUploader from './ImageUploader'
import VariantsManager, { Variant } from './VariantsManager'
import { supabase } from '@/lib/supabase'

interface Props {
  product?: Product
  categories: Category[]
  onSave: (data: Partial<Product>, variants: Variant[]) => Promise<void>
  onCancel: () => void
}

export default function ProductForm({ product, categories, onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    name:             product?.name ?? '',
    slug:             product?.slug ?? '',
    sku:              product?.sku ?? '',
    category_id:      product?.category_id ?? '',
    price:            product?.price ?? 0,
    sale_price:       (product?.sale_price as any) ?? '',
    cost_price:       (product as any)?.cost_price ?? 0,
    short_desc:       product?.short_desc ?? '',
    description:      product?.description ?? '',
    cover_image:      product?.cover_image ?? '',
    images:           product?.images ?? [],
    video_url:        (product as any)?.video_url ?? '',
    weight:           (product as any)?.weight ?? 0.5,
    origin_url:       (product as any)?.origin_url ?? '',
    in_stock:         product?.in_stock ?? true,
    is_preorder:      (product as any)?.is_preorder ?? false,
    is_visible:       product?.is_visible ?? true,
    is_featured:      product?.is_featured ?? false,
    is_new:           product?.is_new ?? false,
    meta_title:       product?.meta_title ?? '',
    meta_description: product?.meta_description ?? '',
  })
  const [variants, setVariants] = useState<Variant[]>([])
  const [saving, setSaving] = useState(false)

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
          stock:       v.stock?.toString() || '0',
          weight:      v.weight?.toString() || '0.5',
          image_url:   v.image_url || '',   // ← FIX: thêm dòng này
          sort_order:  v.sort_order,
        })))
      })
  }, [product?.id])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const autoSlug = (name: string) =>
    name.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave({
      ...form,
      price:            Math.round(Number(form.price)),
      sale_price:       form.sale_price !== '' ? Math.round(Number(form.sale_price)) : null,
      cost_price:       Math.round(Number(form.cost_price)),
      weight:           Number(form.weight),
      origin_url:       form.origin_url || null,
      video_url:        form.video_url || null,
    } as any, variants)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

      {/* ── Thông tin cơ bản ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6 border border-stone-100">
        <h3 className="font-bold mb-4 text-sm text-stone-700">📋 Thông tin cơ bản</h3>
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
                      <option value={p.id}>📁 {p.name} (tất cả)</option>
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
            <label className="text-xs font-semibold text-stone-500 block mb-1">🔒 Giá vốn (₫) — Chỉ Admin</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*"
              value={form.cost_price}
              onChange={e => set('cost_price', e.target.value.replace(/\D/g, ''))}
              onBlur={e => set('cost_price', String(Math.round(Number(e.target.value) || 0)))}
              placeholder="Giá Taobao + ship TQ-VN"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            <p className="text-[11px] text-red-400 mt-1">⚠️ Không hiển thị ra trang khách hàng</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">⚖️ Cân nặng (kg)</label>
            <input type="number" step="0.1" min="0" value={form.weight}
              onChange={e => set('weight', e.target.value)}
              placeholder="VD: 0.4"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            <p className="text-[11px] text-stone-400 mt-1">Dùng tính phí ship GHTK</p>
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-stone-500 block mb-1">🔒 Link Taobao — Chỉ Admin</label>
            <input value={form.origin_url} onChange={e => set('origin_url', e.target.value)}
              placeholder="https://item.taobao.com/item.htm?id=..."
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            <p className="text-[11px] text-red-400 mt-1">⚠️ Không hiển thị ra trang khách hàng</p>
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-stone-500 block mb-1">Mô tả ngắn</label>
            <textarea value={form.short_desc} onChange={e => set('short_desc', e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 resize-none" />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-stone-500 block mb-1">Mô tả chi tiết</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 resize-none" />
          </div>
        </div>
      </div>

      {/* ── Hình ảnh ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6 border border-stone-100">
        <h3 className="font-bold mb-4 text-sm text-stone-700">🖼️ Hình ảnh</h3>
        <ImageUploader
          coverImage={form.cover_image}
          images={form.images}
          onCoverChange={url => set('cover_image', url)}
          onImagesChange={imgs => set('images', imgs)}
        />
      </div>

      {/* ── Video ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6 border border-stone-100">
        <h3 className="font-bold mb-1 text-sm text-stone-700">🎬 Video sản phẩm</h3>
        <p className="text-xs text-stone-400 mb-3">YouTube, Shorts, Facebook, TikTok, .mp4/.webm</p>
        <input value={form.video_url} onChange={e => set('video_url', e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
        {form.video_url && (
          <div className="mt-2 p-2.5 bg-stone-50 rounded-lg flex items-center gap-2 text-xs text-stone-500">
            <span>
              {form.video_url.includes('youtube') ? '▶️ YouTube' :
               form.video_url.includes('facebook') ? '📘 Facebook' :
               form.video_url.includes('tiktok') ? '🎵 TikTok' :
               form.video_url.match(/\.(mp4|webm)/i) ? '🎥 MP4' : '🔗 Video'}
            </span>
            <span className="truncate text-stone-400 flex-1">{form.video_url}</span>
            <button type="button" onClick={() => set('video_url', '')}
              className="text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
          </div>
        )}
      </div>

      {/* ── Biến thể ─────────────────────────────────────────────── */}
      <VariantsManager variants={variants} onChange={setVariants} />

      {/* ── Trạng thái & Hiển thị ────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6 border border-stone-100">
        <h3 className="font-bold mb-4 text-sm text-stone-700">🏷️ Trạng thái & Hiển thị</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['in_stock',   '✅ Còn hàng'],
            ['is_visible', '👁️ Hiển thị'],
            ['is_featured','⭐ Nổi bật'],
            ['is_new',     '🆕 Sản phẩm mới'],
          ].map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!(form as any)[k]}
                onChange={e => set(k, e.target.checked)} className="w-4 h-4" />
              <span className="text-sm">{l}</span>
            </label>
          ))}

          <label className="col-span-2 flex items-center gap-3 cursor-pointer bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 hover:bg-orange-100 transition">
            <input type="checkbox" checked={form.is_preorder}
              onChange={e => set('is_preorder', e.target.checked)}
              className="w-4 h-4 accent-orange-500" />
            <div>
              <div className="text-sm font-semibold text-orange-700">⏳ Hàng đặt trước (Pre-order)</div>
              <div className="text-xs text-orange-500 mt-0.5">
                Hiển thị badge "Đặt trước (7-10 ngày)" thay vì "Còn hàng"
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* ── SEO ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6 border border-stone-100">
        <h3 className="font-bold mb-4 text-sm text-stone-700">🔍 SEO</h3>
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
          className="bg-stone-800 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-stone-700 transition disabled:opacity-50">
          {saving ? 'Đang lưu...' : '💾 Lưu sản phẩm'}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-stone-200 px-6 py-2.5 rounded-lg text-sm hover:bg-stone-50 transition">
          Huỷ
        </button>
      </div>
    </form>
  )
}