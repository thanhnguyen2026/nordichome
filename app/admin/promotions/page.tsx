'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import { Campaign, Product } from '@/types'
import { Edit2, Trash2, Plus, X } from 'lucide-react'

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

// input[type=datetime-local] cần "YYYY-MM-DDTHH:mm", còn DB trả ISO có giây/timezone
const toLocalInput = (iso: string | null) => iso ? iso.slice(0, 16) : ''

const emptyForm = {
  name: '',
  discount_type: 'percent' as 'percent' | 'fixed',
  discount_value: '',
  scope: 'all' as 'all' | 'selected',
  product_ids: [] as string[],
  starts_at: '',
  ends_at: '',
  is_active: true,
}

export default function AdminPromotions() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  // Date.now() là hàm "không thuần" (impure), không được gọi trực tiếp trong
  // render — chốt mốc thời gian 1 lần lúc mount qua lazy initializer của useState.
  const [now] = useState(() => new Date())

  const load = async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('name'),
    ])
    setCampaigns((c as unknown as Campaign[]) || [])
    setProducts((p as unknown as Product[]) || [])
    setLoading(false)
  }

  // Tải dữ liệu lúc mount — dự án không dùng thư viện fetch data, đây là cách chuẩn hiện tại
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const set = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const toggleProduct = (id: string) =>
    setForm(f => ({
      ...f,
      product_ids: f.product_ids.includes(id) ? f.product_ids.filter(x => x !== id) : [...f.product_ids, id],
    }))

  const resetForm = () => { setEditingId(null); setForm(emptyForm) }

  const handleEdit = (c: Campaign) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      scope: c.scope,
      product_ids: c.product_ids,
      starts_at: toLocalInput(c.starts_at),
      ends_at: toLocalInput(c.ends_at),
      is_active: c.is_active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.discount_value) return
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      discount_type: form.discount_type,
      discount_value: Math.round(Number(form.discount_value)),
      scope: form.scope,
      product_ids: form.scope === 'selected' ? form.product_ids : [],
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_active: form.is_active,
    }

    const { error } = editingId
      ? await supabase.from('campaigns').update(payload).eq('id', editingId)
      : await supabase.from('campaigns').insert(payload)

    setSaving(false)
    if (error) { alert('Lỗi: ' + error.message); return }

    resetForm()
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá khuyến mãi này?')) return
    await supabase.from('campaigns').delete().eq('id', id)
    load()
  }

  const toggleActive = async (c: Campaign) => {
    await supabase.from('campaigns').update({ is_active: !c.is_active }).eq('id', c.id)
    setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !c.is_active } : x))
  }

  const statusOf = (c: Campaign): { label: string; cls: string } => {
    if (!c.is_active) return { label: 'Đã tắt', cls: 'bg-stone-100 text-stone-500' }
    if (c.starts_at && now < new Date(c.starts_at)) return { label: 'Sắp diễn ra', cls: 'bg-blue-50 text-blue-700' }
    if (c.ends_at && now > new Date(c.ends_at)) return { label: 'Hết hạn', cls: 'bg-stone-100 text-stone-500' }
    return { label: 'Đang chạy', cls: 'bg-green-50 text-green-700' }
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-black mb-1">🎉 Khuyến mãi</h1>
      <p className="text-stone-400 text-sm mb-6">
        Tự động giảm giá — áp cho toàn bộ sản phẩm hoặc chỉ sản phẩm được chọn, không cần khách nhập mã.
      </p>

      {/* FORM */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Plus size={16} className="text-stone-500" />
            {editingId ? '✏️ Sửa khuyến mãi' : 'Thêm khuyến mãi mới'}
          </h2>
          {editingId && (
            <button onClick={resetForm} className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition">
              <X size={14} /> Huỷ sửa
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="sm:col-span-1">
            <label className="text-xs font-semibold text-stone-500 block mb-1">Tên khuyến mãi *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="VD: Sale hè 2026" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Loại giảm giá</label>
            <select value={form.discount_type} onChange={e => set('discount_type', e.target.value as 'percent' | 'fixed')}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 bg-white">
              <option value="percent">Theo %</option>
              <option value="fixed">Số tiền cố định</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">
              Giá trị giảm * {form.discount_type === 'percent' ? '(%)' : '(₫)'}
            </label>
            <input value={form.discount_value} onChange={e => set('discount_value', e.target.value.replace(/\D/g, ''))}
              placeholder={form.discount_type === 'percent' ? 'VD: 10' : 'VD: 50000'}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-stone-500 block mb-1">Phạm vi áp dụng</label>
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => set('scope', 'all')}
              className={`flex-1 text-sm px-3 py-2 rounded-lg border font-semibold transition ${
                form.scope === 'all' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
              }`}>
              Toàn bộ sản phẩm
            </button>
            <button type="button" onClick={() => set('scope', 'selected')}
              className={`flex-1 text-sm px-3 py-2 rounded-lg border font-semibold transition ${
                form.scope === 'selected' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
              }`}>
              Chỉ sản phẩm được chọn
            </button>
          </div>
          {form.scope === 'selected' && (
            <div className="border border-stone-200 rounded-lg p-3 max-h-56 overflow-y-auto space-y-1.5">
              {products.length === 0 ? (
                <p className="text-xs text-stone-400">Chưa có sản phẩm nào.</p>
              ) : products.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-stone-50 rounded px-1.5 py-1">
                  <input type="checkbox" checked={form.product_ids.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Bắt đầu</label>
            <input type="datetime-local" value={form.starts_at} onChange={e => set('starts_at', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Kết thúc</label>
            <input type="datetime-local" value={form.ends_at} onChange={e => set('ends_at', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Kích hoạt ngay
          </label>
          <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.discount_value}
            className="bg-stone-900 text-amber-100 rounded-lg px-5 py-2 text-sm font-bold hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? 'Đang lưu...' : editingId ? '💾 Lưu' : '+ Thêm'}
          </button>
        </div>
      </div>

      {/* LIST */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-stone-400 text-sm">Đang tải...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm">Chưa có khuyến mãi nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-stone-50">
                  {['Tên', 'Giảm giá', 'Phạm vi', 'Trạng thái', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] uppercase text-stone-400 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const status = statusOf(c)
                  return (
                    <tr key={c.id} className="border-t border-stone-50">
                      <td className="py-2.5 px-4 font-semibold text-stone-800">{c.name}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {c.discount_type === 'percent' ? `${c.discount_value}%` : fmt(c.discount_value)}
                      </td>
                      <td className="py-2.5 px-4 text-stone-500 text-xs whitespace-nowrap">
                        {c.scope === 'all' ? 'Toàn bộ sản phẩm' : `${c.product_ids.length} sản phẩm`}
                      </td>
                      <td className="py-2.5 px-4">
                        <button onClick={() => toggleActive(c)} className={`text-[11px] px-2 py-0.5 rounded-full w-fit whitespace-nowrap ${status.cls}`}>
                          {status.label}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button onClick={() => handleEdit(c)} className="text-xs bg-stone-100 rounded-lg px-2.5 py-1.5 mr-1 hover:bg-stone-200">
                          <Edit2 size={12} className="inline mr-1" />Sửa
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="text-xs bg-red-50 text-red-600 rounded-lg px-2.5 py-1.5 hover:bg-red-100">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
