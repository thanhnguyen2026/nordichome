'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import ProductForm from '@/components/admin/ProductForm'
import { Product, Category } from '@/types'

const fmt = (n: number) => Number(n).toLocaleString('vi-VN') + '₫'

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  const load = async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*,category:categories(name)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
    ])
    setProducts(prods as any || [])
    setCategories(cats || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setShowForm(true) }
  const openEdit = (p: Product) => { setEditing(p); setShowForm(true) }

  const handleSave = async (data: Partial<Product>, variants: any[]) => {
    let productId = editing?.id

    if (editing) {
      const { error } = await supabase.from('products')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
      if (error) { alert('Lỗi: ' + error.message); return }
    } else {
      const { data: newProd, error } = await supabase.from('products')
        .insert(data).select().single()
      if (error) { alert('Lỗi: ' + error.message); return }
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
            cost_price:  Math.round(Number(v.cost_price)) || 0,
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
    if (!confirm('Xoá sản phẩm này?')) return
    await supabase.from('products').delete().eq('id', id)
    load()
  }

  const toggleVisible = async (p: Product) => {
    await supabase.from('products').update({ is_visible: !p.is_visible }).eq('id', p.id)
    load()
  }

  return (
    <AdminLayout>
      {showForm ? (
        <div>
          <button onClick={() => setShowForm(false)} className="text-sm text-stone-500 hover:text-stone-800 mb-4">← Quay lại danh sách</button>
          <h1 className="text-2xl font-black mb-6">{editing ? '✏️ Sửa sản phẩm' : '➕ Thêm sản phẩm mới'}</h1>
          <ProductForm product={editing || undefined} categories={categories} onSave={handleSave} onCancel={() => setShowForm(false)} />
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-black">📦 Sản phẩm</h1>
              <p className="text-stone-400 text-sm mt-1">{products.length} sản phẩm</p>
            </div>
            <button onClick={openAdd} className="bg-stone-900 text-amber-100 rounded-lg px-5 py-2.5 text-sm font-bold hover:bg-stone-800 transition">
              + Thêm sản phẩm
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            {loading ? (
              <div className="text-center py-12 text-stone-400 text-sm">Đang tải...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm">Chưa có sản phẩm nào. Nhấn "+ Thêm sản phẩm" để bắt đầu!</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50">
                    {['Ảnh', 'Tên sản phẩm', 'SKU', 'Danh mục', 'Giá bán', 'Trạng thái', ''].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-[11px] uppercase text-stone-400 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="border-t border-stone-50">
                      <td className="py-2 px-4">
                        <div className="w-12 h-12 bg-stone-100 rounded-lg overflow-hidden flex items-center justify-center">
                          {p.cover_image ? <img src={p.cover_image} className="w-full h-full object-cover" /> : <span className="text-xl">🛋️</span>}
                        </div>
                      </td>
                      <td className="py-2 px-4 font-semibold">{p.name}</td>
                      <td className="py-2 px-4 text-stone-400 font-mono text-xs">{p.sku || '—'}</td>
                      <td className="py-2 px-4 text-stone-500">{(p as any).category?.name || '—'}</td>
                      <td className="py-2 px-4 font-bold text-amber-700">
                        {fmt(p.sale_price || p.price)}
                        {!!p.sale_price && p.sale_price !== p.price && <div className="text-[11px] text-stone-400 line-through font-normal">{fmt(p.price)}</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div className="flex flex-col gap-1">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full w-fit ${
                            p.is_preorder
                              ? 'bg-orange-50 text-orange-600'
                              : p.in_stock
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                          }`}>
                            {p.is_preorder ? '⏳ Đặt trước' : p.in_stock ? 'Còn hàng' : 'Hết hàng'}
                          </span>
                          <button onClick={() => toggleVisible(p)} className={`text-[11px] px-2 py-0.5 rounded-full w-fit ${p.is_visible ? 'bg-blue-50 text-blue-700' : 'bg-stone-100 text-stone-500'}`}>
                            {p.is_visible ? '👁️ Hiện' : '🚫 Ẩn'}
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-4 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(p)} className="text-xs bg-stone-100 rounded-lg px-2.5 py-1.5 mr-1 hover:bg-stone-200">✏️ Sửa</button>
                        <button onClick={() => handleDelete(p.id)} className="text-xs bg-red-50 text-red-600 rounded-lg px-2.5 py-1.5 hover:bg-red-100">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  )
}