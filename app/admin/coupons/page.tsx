'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import { Coupon } from '@/types'
import { Edit2, Trash2, Plus, X, Tag, Save } from 'lucide-react'
import { useConfirm } from '@/components/admin/useConfirm'
import { useToast } from '@/components/admin/useToast'

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

// input[type=datetime-local] cần "YYYY-MM-DDTHH:mm", còn DB trả ISO có giây/timezone
const toLocalInput = (iso: string | null) => iso ? iso.slice(0, 16) : ''

const emptyForm = {
  code: '',
  discount_type: 'percent' as 'percent' | 'fixed',
  discount_value: '',
  min_order_amount: '',
  max_discount_amount: '',
  starts_at: '',
  ends_at: '',
  usage_limit: '',
  is_active: true,
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()
  const { showToast, Toast } = useToast()
  // Date.now() là hàm "không thuần" (impure), không được gọi trực tiếp trong
  // render — chốt mốc thời gian 1 lần lúc mount qua lazy initializer của useState.
  const [now] = useState(() => Date.now())

  const load = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
    setCoupons(data || [])
    setLoading(false)
  }

  // Tải dữ liệu lúc mount — dự án không dùng thư viện fetch data, đây là cách chuẩn hiện tại
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const set = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const resetForm = () => { setEditingId(null); setForm(emptyForm) }

  const handleEdit = (c: Coupon) => {
    setEditingId(c.id)
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      min_order_amount: c.min_order_amount ? String(c.min_order_amount) : '',
      max_discount_amount: c.max_discount_amount != null ? String(c.max_discount_amount) : '',
      starts_at: toLocalInput(c.starts_at),
      ends_at: toLocalInput(c.ends_at),
      usage_limit: c.usage_limit != null ? String(c.usage_limit) : '',
      is_active: c.is_active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async () => {
    if (!form.code.trim() || !form.discount_value) return
    setSaving(true)

    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Math.round(Number(form.discount_value)),
      min_order_amount: form.min_order_amount ? Math.round(Number(form.min_order_amount)) : 0,
      max_discount_amount: form.discount_type === 'percent' && form.max_discount_amount
        ? Math.round(Number(form.max_discount_amount)) : null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      usage_limit: form.usage_limit ? Math.round(Number(form.usage_limit)) : null,
      is_active: form.is_active,
    }

    const { error } = editingId
      ? await supabase.from('coupons').update(payload).eq('id', editingId)
      : await supabase.from('coupons').insert(payload)

    setSaving(false)
    if (error) { showToast('Lỗi: ' + (error.code === '23505' ? 'Mã này đã tồn tại' : error.message)); return }

    resetForm()
    load()
  }

  const handleDelete = async (id: string) => {
    if (!(await confirm('Xoá mã giảm giá này?', { danger: true }))) return
    await supabase.from('coupons').delete().eq('id', id)
    load()
  }

  const toggleActive = async (c: Coupon) => {
    await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id)
    setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !c.is_active } : x))
  }

  const statusOf = (c: Coupon): { label: string; cls: string } => {
    if (!c.is_active) return { label: 'Đã tắt', cls: 'bg-stone-100 text-stone-500' }
    if (c.starts_at && now < new Date(c.starts_at).getTime()) return { label: 'Chưa bắt đầu', cls: 'bg-blue-50 text-blue-700' }
    if (c.ends_at && now > new Date(c.ends_at).getTime()) return { label: 'Hết hạn', cls: 'bg-stone-100 text-stone-500' }
    if (c.usage_limit != null && c.used_count >= c.usage_limit) return { label: 'Hết lượt', cls: 'bg-stone-100 text-stone-500' }
    return { label: 'Đang chạy', cls: 'bg-green-50 text-green-700' }
  }

  return (
    <AdminLayout>
      {ConfirmDialog}
      {Toast}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center flex-shrink-0">
          <Tag size={18} className="text-amber-100" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black leading-tight">Mã giảm giá</h1>
      </div>
      <p className="text-stone-400 text-sm mb-6 ml-[52px]">Tạo mã giảm % hoặc số tiền cố định, khách nhập ở bước thanh toán</p>

      {/* FORM */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm flex items-center gap-2">
            {editingId ? <Edit2 size={16} className="text-stone-500" /> : <Plus size={16} className="text-stone-500" />}
            {editingId ? 'Sửa mã giảm giá' : 'Thêm mã giảm giá mới'}
          </h2>
          {editingId && (
            <button onClick={resetForm} className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition cursor-pointer">
              <X size={14} /> Huỷ sửa
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Mã *</label>
            <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
              placeholder="VD: SALE20" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 font-mono" />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Loại giảm giá</label>
            <select value={form.discount_type} onChange={e => set('discount_type', e.target.value as 'percent' | 'fixed')}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 bg-white">
              <option value="percent">Theo % đơn hàng</option>
              <option value="fixed">Số tiền cố định</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">
              Giá trị giảm * {form.discount_type === 'percent' ? '(%)' : '(₫)'}
            </label>
            <input value={form.discount_value} onChange={e => set('discount_value', e.target.value.replace(/\D/g, ''))}
              placeholder={form.discount_type === 'percent' ? 'VD: 20' : 'VD: 50000'}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Đơn tối thiểu (₫)</label>
            <input value={form.min_order_amount} onChange={e => set('min_order_amount', e.target.value.replace(/\D/g, ''))}
              placeholder="Không bắt buộc" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
          </div>
          {form.discount_type === 'percent' && (
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Giảm tối đa (₫)</label>
              <input value={form.max_discount_amount} onChange={e => set('max_discount_amount', e.target.value.replace(/\D/g, ''))}
                placeholder="Không giới hạn" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Giới hạn lượt dùng</label>
            <input value={form.usage_limit} onChange={e => set('usage_limit', e.target.value.replace(/\D/g, ''))}
              placeholder="Không giới hạn" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
          </div>
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
          <button onClick={handleSave} disabled={saving || !form.code.trim() || !form.discount_value}
            className="flex items-center gap-1.5 bg-stone-900 text-amber-100 rounded-lg px-5 py-2 text-sm font-bold hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            {saving ? 'Đang lưu...' : editingId ? <><Save size={14} /> Lưu</> : <><Plus size={14} /> Thêm</>}
          </button>
        </div>
      </div>

      {/* LIST */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-stone-400 text-sm">Đang tải...</div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm">Chưa có mã giảm giá nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-stone-50 border-b-2 border-stone-200">
                  {['Mã', 'Giảm giá', 'Điều kiện', 'Lượt dùng', 'Trạng thái', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] uppercase tracking-wide text-stone-400 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => {
                  const status = statusOf(c)
                  return (
                    <tr key={c.id} className="border-t border-stone-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-stone-800 whitespace-nowrap">{c.code}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap tabular-nums">
                        {c.discount_type === 'percent' ? `${c.discount_value}%` : fmt(c.discount_value)}
                        {c.discount_type === 'percent' && c.max_discount_amount != null && (
                          <div className="text-[11px] text-stone-400">tối đa {fmt(c.max_discount_amount)}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-stone-500 text-xs whitespace-nowrap tabular-nums">
                        {c.min_order_amount > 0 ? `Đơn ≥ ${fmt(c.min_order_amount)}` : 'Không điều kiện'}
                      </td>
                      <td className="py-2.5 px-4 text-stone-500 text-xs whitespace-nowrap tabular-nums">
                        {c.used_count}{c.usage_limit != null ? ` / ${c.usage_limit}` : ''}
                      </td>
                      <td className="py-2.5 px-4">
                        <button onClick={() => toggleActive(c)} className={`text-[11px] px-2 py-0.5 rounded-full w-fit whitespace-nowrap cursor-pointer ${status.cls}`}>
                          {status.label}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button onClick={() => handleEdit(c)} className="text-xs bg-stone-100 rounded-lg px-2.5 py-1.5 mr-1 hover:bg-stone-200 cursor-pointer">
                          <Edit2 size={12} className="inline mr-1" />Sửa
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="text-xs bg-red-50 text-red-600 rounded-lg px-2.5 py-1.5 hover:bg-red-100 cursor-pointer">
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
