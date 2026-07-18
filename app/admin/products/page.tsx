'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { stripDiacritics } from '@/lib/text'
import AdminLayout from '@/components/admin/AdminLayout'
import ProductForm from '@/components/admin/ProductForm'
import { Product, Category, Campaign } from '@/types'
import { hasCampaignFor } from '@/lib/campaignPrice'
import type { Variant } from '@/components/admin/VariantsManager'
import { LOW_STOCK_THRESHOLD } from '@/lib/stock'
import { useConfirm } from '@/components/admin/useConfirm'
import { usePrompt } from '@/components/admin/usePrompt'
import { useToast } from '@/components/admin/useToast'
import {
  Package, Plus, Pencil, Trash2, Eye, EyeOff, Flame, Clock, AlertTriangle,
  Percent, Boxes, ImageOff, ArrowLeft, ClipboardList,
} from 'lucide-react'

const fmt = (n: number) => Number(n).toLocaleString('vi-VN') + '₫'

type VisibilityFilter = 'all' | 'visible' | 'hidden'
type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'

export default function AdminProducts() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  // Tổng tồn kho biến thể theo product_id — null nghĩa là sản phẩm không có biến thể
  // (dùng cờ in_stock thay vì số lượng)
  const [variantStockMap, setVariantStockMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  // Date.now() là hàm "không thuần" (impure), không được gọi trực tiếp trong
  // render — chốt mốc thời gian 1 lần lúc mount qua lazy initializer của useState.
  const [now] = useState(() => new Date())
  const { confirm, ConfirmDialog } = useConfirm()
  const { promptValue, PromptDialog } = usePrompt()
  const { showToast, Toast } = useToast()

  const load = async () => {
    const [{ data: prods }, { data: cats }, { data: variants }, { data: camps }] = await Promise.all([
      supabase.from('products').select('*,category:categories(name)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('product_variants').select('product_id, stock'),
      supabase.from('campaigns').select('*').eq('is_active', true),
    ])
    setProducts((prods as unknown as Product[]) || [])
    setCategories(cats || [])
    const stockMap: Record<string, number> = {}
    variants?.forEach(v => {
      stockMap[v.product_id] = (stockMap[v.product_id] ?? 0) + (v.stock ?? 0)
    })
    setVariantStockMap(stockMap)
    setCampaigns((camps as unknown as Campaign[]) || [])
    setLoading(false)
  }

  // Tải dữ liệu lúc mount — dự án không dùng thư viện fetch data, đây là cách chuẩn hiện tại
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setShowForm(true) }
  const openEdit = (p: Product) => { setEditing(p); setShowForm(true) }

  const handleSave = async (data: Partial<Product>, variants: Variant[]) => {
    let productId = editing?.id

    if (editing) {
      const { error } = await supabase.from('products')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
      if (error) { showToast('Lỗi: ' + error.message); return }
    } else {
      const { data: newProd, error } = await supabase.from('products')
        .insert(data).select().single()
      if (error) { showToast('Lỗi: ' + error.message); return }
      productId = newProd.id
    }

    // Lưu variants: xoá cũ → thêm mới
    if (productId) {
      await supabase.from('product_variants').delete().eq('product_id', productId)
      if (variants.length > 0) {
        await supabase.from('product_variants').insert(
          variants.map((v, i) => ({
            product_id:  productId,
            group_name:  v.group_name,
            option_name: v.option_name,
            sku:         v.sku || null,
            price:       v.price ? Math.round(Number(v.price)) : null,
            // Để trống giá vốn biến thể → kế thừa giá vốn chung của sản phẩm,
            // tránh bị mặc định về 0 làm sai lệch tính lợi nhuận.
            cost_price:  v.cost_price ? Math.round(Number(v.cost_price)) : Math.round(Number(data.cost_price) || 0),
            stock:       Number(v.stock) || 0,
            weight:      Number(v.weight) || 0.5,
            image_url:   v.image_url || null,   // ← FIX: thêm dòng này
            sort_order:  i,
          }))
        )
      }
    }

    setShowForm(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!(await confirm('Xoá sản phẩm này?', { danger: true }))) return
    await supabase.from('products').delete().eq('id', id)
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    load()
  }

  const toggleVisible = async (p: Product) => {
    await supabase.from('products').update({ is_visible: !p.is_visible }).eq('id', p.id)
    load()
  }

  // Số tồn kho hiển thị: ưu tiên tổng biến thể, rồi tới stock cấp sản phẩm
  // (chỉ có ý nghĩa khi không có biến thể) — undefined nếu không theo dõi số lượng
  const stockCount = (p: Product): number | undefined =>
    variantStockMap[p.id] ?? (p.stock != null ? p.stock : undefined)

  // Phân loại tồn kho: có số theo dõi thì so ngưỡng "sắp hết", không có số
  // (sản phẩm không biến thể, không nhập stock) thì dựa vào cờ in_stock thủ công
  const stockStatus = (p: Product): 'in_stock' | 'low_stock' | 'out_of_stock' => {
    const total = stockCount(p)
    if (total !== undefined) {
      if (total <= 0) return 'out_of_stock'
      if (total <= LOW_STOCK_THRESHOLD) return 'low_stock'
      return 'in_stock'
    }
    return p.in_stock ? 'in_stock' : 'out_of_stock'
  }

  const filtered = useMemo(() => {
    const q = stripDiacritics(search.trim())
    return products.filter(p => {
      if (categoryFilter !== 'all' && p.category_id !== categoryFilter) return false
      if (visibilityFilter === 'visible' && !p.is_visible) return false
      if (visibilityFilter === 'hidden' && p.is_visible) return false
      if (stockFilter !== 'all' && stockStatus(p) !== stockFilter) return false
      if (q) {
        const hit = stripDiacritics(p.name).includes(q) || (p.sku && stripDiacritics(p.sku).includes(q))
        if (!hit) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stockStatus phụ thuộc variantStockMap, đã liệt kê riêng
  }, [products, search, categoryFilter, visibilityFilter, stockFilter, variantStockMap])

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id))

  const toggleSelectAll = () => {
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map(p => p.id)))
  }

  const toggleSelectOne = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  const bulkSetVisible = async (visible: boolean) => {
    if (selected.size === 0) return
    await supabase.from('products').update({ is_visible: visible }).in('id', Array.from(selected))
    setSelected(new Set())
    load()
  }

  const bulkDelete = async () => {
    if (selected.size === 0) return
    if (!(await confirm(`Xoá ${selected.size} sản phẩm đã chọn?`, { danger: true }))) return
    await supabase.from('products').delete().in('id', Array.from(selected))
    setSelected(new Set())
    load()
  }

  const bulkApplyCategory = async () => {
    if (selected.size === 0 || !bulkCategory) return
    await supabase.from('products').update({ category_id: bulkCategory }).in('id', Array.from(selected))
    setSelected(new Set())
    setBulkCategory('')
    load()
  }

  // Đổi giá hàng loạt theo %, áp cho cả giá bán và giá khuyến mãi (nếu có) —
  // dùng khi tăng/giảm giá đồng loạt 1 đợt (VD: sale toàn shop -10%).
  const bulkAdjustPrice = async () => {
    if (selected.size === 0) return
    const input = await promptValue('Điều chỉnh giá bao nhiêu %? (VD: 10 = tăng 10%, -10 = giảm 10%)', { type: 'number' })
    if (input === null) return
    const pct = Number(input)
    if (!pct || Number.isNaN(pct)) return showToast('Số % không hợp lệ')

    const targets = products.filter(p => selected.has(p.id))
    await Promise.all(targets.map(p => {
      const newPrice = Math.max(0, Math.round(p.price * (1 + pct / 100)))
      const patch: Partial<Product> = { price: newPrice }
      if (p.sale_price != null) patch.sale_price = Math.max(0, Math.round(p.sale_price * (1 + pct / 100)))
      return supabase.from('products').update(patch).eq('id', p.id)
    }))
    setSelected(new Set())
    load()
  }

  // Cộng/trừ tồn kho hàng loạt — chỉ áp cho sản phẩm KHÔNG biến thể có theo
  // dõi số lượng (products.stock khác null); sản phẩm có biến thể phải sửa
  // riêng từng mẫu trong form vì mỗi mẫu tồn kho khác nhau.
  const bulkAdjustStock = async () => {
    if (selected.size === 0) return
    const input = await promptValue('Cộng/trừ bao nhiêu vào tồn kho? (VD: 10 = cộng thêm 10, -5 = trừ 5)\nChỉ áp dụng cho sản phẩm không biến thể, có theo dõi số lượng.', { type: 'number' })
    if (input === null) return
    const delta = Number(input)
    if (!delta || Number.isNaN(delta)) return showToast('Số lượng không hợp lệ')

    const targets = products.filter(p => selected.has(p.id) && p.stock != null && !variantStockMap[p.id])
    if (targets.length === 0) {
      showToast('Không có sản phẩm nào trong lựa chọn có theo dõi tồn kho cấp sản phẩm (không biến thể).')
      return
    }
    await Promise.all(targets.map(p => {
      const newStock = Math.max(0, (p.stock || 0) + delta)
      return supabase.from('products').update({ stock: newStock, in_stock: newStock > 0 }).eq('id', p.id)
    }))
    setSelected(new Set())
    load()
  }

  return (
    <AdminLayout>
      {ConfirmDialog}
      {PromptDialog}
      {Toast}
      {showForm ? (
        <div>
          <button onClick={() => setShowForm(false)}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 mb-4 cursor-pointer">
            <ArrowLeft size={14} />
            Quay lại danh sách
          </button>
          <h1 className="flex items-center gap-2 text-2xl font-black mb-6">
            {editing ? <Pencil size={20} /> : <Plus size={20} />}
            {editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
          </h1>
          <ProductForm product={editing || undefined} categories={categories} onSave={handleSave} onCancel={() => setShowForm(false)} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center flex-shrink-0">
                <Package size={18} className="text-amber-100" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-black leading-tight">Sản phẩm</h1>
                <p className="text-stone-400 text-sm">{filtered.length}/{products.length} sản phẩm</p>
              </div>
            </div>
            <button onClick={openAdd}
              className="flex items-center gap-1.5 bg-stone-900 text-amber-100 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-stone-800 transition cursor-pointer">
              <Plus size={15} />
              Thêm sản phẩm
            </button>
          </div>

          {/* Thẻ KPI tồn kho/hiển thị — dạng dòng gọn trên mobile (label + số
              cùng hàng), chuyển sang thẻ xếp dọc như dashboard thật từ sm trở lên. */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5 mb-5">
            {([
              { label: 'Tổng',       value: products.length, border: 'border-l-stone-300' },
              { label: 'Đang hiện',  value: products.filter(p => p.is_visible).length, border: 'border-l-blue-400' },
              { label: 'Đang ẩn',    value: products.filter(p => !p.is_visible).length, border: 'border-l-stone-400' },
              { label: 'Sắp hết',    value: products.filter(p => stockStatus(p) === 'low_stock').length, border: 'border-l-amber-400' },
              { label: 'Hết hàng',   value: products.filter(p => stockStatus(p) === 'out_of_stock').length, border: 'border-l-red-400' },
            ]).map(kpi => (
              <div key={kpi.label} className={`flex items-center justify-between sm:block bg-white border border-stone-100 border-l-4 rounded-lg sm:rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 ${kpi.border}`}>
                <div className="text-[10px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wide truncate">{kpi.label}</div>
                <div className="text-base sm:text-xl font-black text-stone-800 tabular-nums sm:mt-0.5">{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Tìm kiếm + lọc */}
          <div className="bg-stone-50 border border-stone-100 rounded-2xl p-3 mb-5">
            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc SKU..."
                className="flex-1 min-w-[220px] text-sm border border-stone-200 rounded-xl px-3.5 py-2 outline-none focus:border-stone-400 bg-white"
              />
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="text-sm border border-stone-200 rounded-xl px-3 py-2 outline-none focus:border-stone-400 bg-white cursor-pointer">
                <option value="all">Mọi danh mục</option>
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
              <select value={visibilityFilter} onChange={e => setVisibilityFilter(e.target.value as VisibilityFilter)}
                className="text-sm border border-stone-200 rounded-xl px-3 py-2 outline-none focus:border-stone-400 bg-white cursor-pointer">
                <option value="all">Hiện + Ẩn</option>
                <option value="visible">Đang hiện</option>
                <option value="hidden">Đang ẩn</option>
              </select>
              <select value={stockFilter} onChange={e => setStockFilter(e.target.value as StockFilter)}
                className="text-sm border border-stone-200 rounded-xl px-3 py-2 outline-none focus:border-stone-400 bg-white cursor-pointer">
                <option value="all">Mọi tồn kho</option>
                <option value="in_stock">Còn hàng</option>
                <option value="low_stock">Sắp hết (≤{LOW_STOCK_THRESHOLD})</option>
                <option value="out_of_stock">Hết hàng</option>
              </select>
            </div>
          </div>

          {/* Thanh thao tác hàng loạt — chỉ hiện khi có dòng được chọn */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4 bg-stone-900 text-white rounded-xl px-4 py-2.5">
              <span className="text-sm font-semibold mr-2">{selected.size} đã chọn</span>
              <button onClick={() => bulkSetVisible(true)}
                className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition cursor-pointer">
                <Eye size={12} /> Hiện
              </button>
              <button onClick={() => bulkSetVisible(false)}
                className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition cursor-pointer">
                <EyeOff size={12} /> Ẩn
              </button>
              <div className="flex items-center gap-1.5">
                <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}
                  className="text-xs bg-white/10 rounded-lg px-2.5 py-1.5 outline-none text-white cursor-pointer [&_option]:text-stone-900 [&_optgroup]:text-stone-900">
                  <option value="">Chuyển danh mục...</option>
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
                <button onClick={bulkApplyCategory} disabled={!bulkCategory}
                  className="text-xs bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Áp dụng</button>
              </div>
              <button onClick={bulkAdjustPrice}
                className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition cursor-pointer">
                <Percent size={12} /> Đổi giá %
              </button>
              <button onClick={bulkAdjustStock}
                className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition cursor-pointer">
                <Boxes size={12} /> Cộng/trừ kho
              </button>
              <button onClick={bulkDelete}
                className="flex items-center gap-1 text-xs bg-red-500/90 hover:bg-red-500 rounded-lg px-3 py-1.5 transition ml-auto cursor-pointer">
                <Trash2 size={12} /> Xoá
              </button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-white/60 hover:text-white px-2 cursor-pointer">Bỏ chọn</button>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            {loading ? (
              <div className="text-center py-12 text-stone-400 text-sm">Đang tải...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm">Chưa có sản phẩm nào. Nhấn &quot;+ Thêm sản phẩm&quot; để bắt đầu!</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm">Không tìm thấy sản phẩm nào khớp bộ lọc.</div>
            ) : (
              <>
              {/* "Chọn tất cả" chỉ hiện trên mobile — thead (chứa checkbox chọn tất
                  cả của bảng desktop) bị ẩn hoàn toàn ở layout thẻ xếp dọc */}
              <label className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-stone-100 text-xs font-semibold text-stone-500 cursor-pointer">
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="cursor-pointer" />
                Chọn tất cả ({filtered.length})
              </label>
              <div className="overflow-x-auto bg-stone-100 md:bg-transparent px-1.5 py-2 md:p-0">
                <table className="w-full text-sm block md:table md:min-w-[760px]">
                  <thead className="hidden md:table-header-group">
                    <tr className="bg-stone-50 border-b-2 border-stone-200">
                      <th className="py-3 px-4 w-8">
                        <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="cursor-pointer" />
                      </th>
                      {['Ảnh', 'Tên sản phẩm', 'SKU', 'Danh mục', 'Giá bán', 'Tồn kho', 'Trạng thái', ''].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-[11px] uppercase tracking-wide text-stone-400 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="block md:table-row-group">
                    {filtered.map(p => {
                      const status = stockStatus(p)
                      return (
                        <tr key={p.id} className={`block md:table-row mb-3 last:mb-0 md:mb-0 rounded-xl md:rounded-none bg-white md:bg-transparent shadow-sm md:shadow-none border md:border-0 border-stone-200 md:border-t md:border-t-stone-50 ${selected.has(p.id) ? 'bg-amber-50/40' : ''}`}>
                          <td className="hidden md:table-cell py-2 px-4">
                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelectOne(p.id)} className="cursor-pointer" />
                          </td>
                          <td className="flex items-center gap-3 md:table-cell py-2.5 px-4">
                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelectOne(p.id)} className="cursor-pointer md:hidden flex-shrink-0" />
                            <div className="relative w-12 h-12 bg-stone-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                              {p.cover_image ? <Image src={p.cover_image} alt={p.name} fill sizes="48px" className="object-cover" /> : <ImageOff size={18} className="text-stone-300" />}
                            </div>
                            <div className="min-w-0 md:hidden">
                              <div className="font-semibold truncate">{p.name}</div>
                              {p.sku && <div className="text-stone-400 font-mono text-xs">{p.sku}</div>}
                            </div>
                          </td>
                          <td className="hidden md:table-cell py-2 px-4 font-semibold whitespace-nowrap">
                            {p.name}
                            {hasCampaignFor(p.id, campaigns, now) && (
                              <div className="flex items-center gap-1 text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold w-fit mt-1">
                                <Flame size={9} />
                                Đang giảm giá
                              </div>
                            )}
                          </td>
                          <td className="hidden md:table-cell py-2 px-4 text-stone-400 font-mono text-xs whitespace-nowrap">{p.sku || '—'}</td>
                          <td className="flex items-center justify-between md:table-cell py-2 px-4 text-stone-500 md:whitespace-nowrap">
                            <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Danh mục</span>
                            {p.category?.name || '—'}
                          </td>
                          <td className="flex items-center justify-between md:table-cell py-2 px-4 font-bold text-amber-700 md:whitespace-nowrap tabular-nums">
                            <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Giá bán</span>
                            <div className="text-right md:text-left">
                              {fmt(p.sale_price || p.price)}
                              {!!p.sale_price && p.sale_price !== p.price && <div className="text-[11px] text-stone-400 line-through font-normal">{fmt(p.price)}</div>}
                            </div>
                          </td>
                          <td className="flex items-center justify-between md:table-cell py-2 px-4 md:whitespace-nowrap tabular-nums">
                            <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Tồn kho</span>
                            {stockCount(p) !== undefined
                              ? <span className={`font-semibold ${status === 'out_of_stock' ? 'text-red-600' : status === 'low_stock' ? 'text-amber-600' : 'text-stone-700'}`}>{stockCount(p)}</span>
                              : <span className="text-stone-300">—</span>}
                          </td>
                          <td className="flex items-center justify-between md:table-cell py-2 px-4 md:py-[10px] md:px-[14px]">
                            <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Trạng thái</span>
                            <div className="flex flex-wrap items-center justify-end md:justify-start gap-1">
                              <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full w-fit whitespace-nowrap ${
                                p.is_preorder
                                  ? 'bg-orange-50 text-orange-600'
                                  : status === 'out_of_stock'
                                    ? 'bg-red-50 text-red-700'
                                    : status === 'low_stock'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-green-50 text-green-700'
                              }`}>
                                {p.is_preorder ? (
                                  <><Clock size={9} /> Đặt trước</>
                                ) : status === 'out_of_stock' ? (
                                  'Hết hàng'
                                ) : status === 'low_stock' ? (
                                  <><AlertTriangle size={9} /> Sắp hết ({stockCount(p)})</>
                                ) : (
                                  'Còn hàng'
                                )}
                              </span>
                              <button onClick={() => toggleVisible(p)}
                                className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full w-fit whitespace-nowrap cursor-pointer ${p.is_visible ? 'bg-blue-50 text-blue-700' : 'bg-stone-100 text-stone-500'}`}>
                                {p.is_visible ? <Eye size={9} /> : <EyeOff size={9} />}
                                {p.is_visible ? 'Hiện' : 'Ẩn'}
                              </button>
                            </div>
                          </td>
                          <td className="block md:table-cell py-2 px-4 md:text-right">
                            {/* 3 nút phải nằm trong CHUNG 1 flex container -- mỗi <button>
                                tự nó là display:flex (block), nên nếu để rời rạc trong 1
                                <td> table-cell, mỗi nút bị đẩy xuống dòng riêng dù cột đủ
                                rộng. Bọc chung 1 div flex-nowrap để cả 3 luôn nằm 1 hàng. */}
                            <div className="flex flex-nowrap items-center justify-end gap-1">
                              <button onClick={() => router.push(`/admin/orders?quickAdd=${p.id}`)}
                                title="Thêm vào đơn thủ công"
                                className="flex items-center gap-1 text-xs bg-stone-100 rounded-lg px-2.5 py-1.5 hover:bg-stone-200 cursor-pointer">
                                <ClipboardList size={11} /> Tạo đơn
                              </button>
                              <button onClick={() => openEdit(p)}
                                className="flex items-center gap-1 text-xs bg-stone-100 rounded-lg px-2.5 py-1.5 hover:bg-stone-200 cursor-pointer">
                                <Pencil size={11} /> Sửa
                              </button>
                              <button onClick={() => handleDelete(p.id)}
                                className="flex items-center text-xs bg-red-50 text-red-600 rounded-lg px-2.5 py-1.5 hover:bg-red-100 cursor-pointer">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  )
}
