'use client'
import { useState, useRef } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Upload, X, Palette, Package, Lock, AlertTriangle } from 'lucide-react'

export interface Variant {
  id?: string
  group_name: string
  option_name: string
  sku: string
  price: string
  cost_price: string
  stock: string
  weight: string
  image_url: string
  sort_order: number
}

interface Props {
  variants: Variant[]
  onChange: (variants: Variant[]) => void
  isPreorder?: boolean
}

export default function VariantsManager({ variants, onChange, isPreorder }: Props) {
  const [open, setOpen] = useState(true)
  const [newGroup, setNewGroup] = useState('')
  const [newOption, setNewOption] = useState('')
  const [uploading, setUploading] = useState<number | null>(null)
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({})
  // Link ảnh dán tay không giới hạn domain — next/image sẽ lỗi nếu domain không
  // nằm trong remotePatterns của next.config.ts. Theo dõi mẫu nào lỗi ảnh để tự
  // chuyển sang icon upload thay vì hiện ảnh vỡ/trống không rõ lý do.
  const [brokenImageIdx, setBrokenImageIdx] = useState<Set<number>>(new Set())

  const addVariant = () => {
    if (!newGroup.trim() || !newOption.trim()) return
    onChange([
      ...variants,
      {
        group_name:  newGroup.trim(),
        option_name: newOption.trim(),
        sku:         '',
        price:       '',
        cost_price:  '',
        stock:       '0',
        weight:      '0.5',
        image_url:   '',
        sort_order:  variants.length,
      },
    ])
    setNewOption('')
  }

  const updateVariant = (idx: number, key: keyof Variant, value: string) => {
    onChange(variants.map((v, i) => i === idx ? { ...v, [key]: value } : v))
    if (key === 'image_url') {
      setBrokenImageIdx(prev => { const next = new Set(prev); next.delete(idx); return next })
    }
  }

  const removeVariant = (idx: number) => {
    onChange(variants.filter((_, i) => i !== idx))
  }

  // Đổi tên NHÓM — áp dụng cho MỌI biến thể đang cùng nhóm đó cùng lúc (không
  // phải 1 dòng riêng lẻ như option_name), vì group_name là giá trị dùng
  // chung để gom nhóm hiển thị.
  const renameGroup = (oldName: string, newName: string) => {
    onChange(variants.map(v => v.group_name === oldName ? { ...v, group_name: newName } : v))
  }

  const handleImageUpload = async (idx: number, file: File) => {
    setUploading(idx)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.url) updateVariant(idx, 'image_url', data.url)
    } finally {
      setUploading(null)
    }
  }

  // Normalize variant để đảm bảo không có field nào là undefined/null
  const normalize = (v: Variant): Variant => ({
    ...v,
    sku:         v.sku         ?? '',
    price:       v.price       ?? '',
    cost_price:  v.cost_price  ?? '',
    stock:       v.stock       ?? '0',
    weight:      v.weight      ?? '0.5',
    image_url:   v.image_url   ?? '',
  })

  const groups = Array.from(new Set(variants.map(v => v.group_name)))

  return (
    <div className="bg-white rounded-xl border border-stone-100">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <div className="flex items-center gap-2 font-bold text-sm text-stone-700">
            <Palette size={16} className="text-stone-400" />
            Biến thể sản phẩm (Variants)
          </div>
          <div className="text-xs text-stone-400 mt-0.5">
            {variants.length === 0
              ? 'Chưa có biến thể — sản phẩm đơn lẻ'
              : `${variants.length} biến thể · ${groups.length} nhóm`}
          </div>
        </div>
        {open
          ? <ChevronUp size={16} className="text-stone-400" />
          : <ChevronDown size={16} className="text-stone-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-stone-50">
          <p className="text-[11px] text-stone-400 mt-3">
            Bỏ trống <span className="font-semibold">Giá vốn</span> sẽ tự lấy giá vốn chung của sản phẩm.
            {isPreorder && <> Hàng đặt trước không cần nhập <span className="font-semibold">Tồn kho</span>.</>}
          </p>
          {/* Form thêm biến thể */}
          <div className="mt-4 flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-semibold text-stone-400 uppercase block mb-1">Tên nhóm</label>
              <input
                value={newGroup}
                onChange={e => setNewGroup(e.target.value)}
                placeholder="VD: Mẫu mã, Màu sắc..."
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-semibold text-stone-400 uppercase block mb-1">Tên tùy chọn</label>
              <input
                value={newOption}
                onChange={e => setNewOption(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addVariant())}
                placeholder="VD: Họa tiết Donut..."
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-1.5 bg-stone-900 text-amber-100 px-4 py-2 rounded-lg text-xs font-bold hover:bg-stone-800 transition"
              >
                <Plus size={14} /> Thêm
              </button>
            </div>
          </div>

          {/* Danh sách biến thể theo nhóm — key dùng CHỈ SỐ (không phải tên
              nhóm) vì tên nhóm giờ sửa được: nếu key là chuỗi tên nhóm, mỗi
              phím gõ sẽ đổi key → React coi là phần tử MỚI → unmount/remount
              cả khối → ô nhập mất focus giữa chừng khi đang gõ. */}
          {groups.map((group, gIdx) => (
            <div key={gIdx} className="mt-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Package size={11} className="text-stone-400 flex-shrink-0" />
                <input
                  value={group}
                  onChange={e => renameGroup(group, e.target.value)}
                  placeholder="Tên nhóm"
                  className="text-xs font-bold text-stone-500 uppercase tracking-wide bg-stone-100 px-2 py-0.5 rounded outline-none border border-transparent hover:border-stone-300 focus:border-stone-400 focus:bg-white transition-colors w-fit min-w-[100px]"
                />
              </div>

              <div className="space-y-3">
                {variants.map((raw, idx) => {
                  if (raw.group_name !== group) return null
                  const v = normalize(raw) // ← đảm bảo không có undefined
                  return (
                    <div key={idx} className="border border-stone-100 rounded-xl p-4 bg-stone-50">
                      {/* Tên (chỉnh sửa trực tiếp) + nút xoá */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-stone-400 flex-shrink-0" aria-hidden="true">✦</span>
                        <input
                          value={v.option_name}
                          onChange={e => updateVariant(idx, 'option_name', e.target.value)}
                          placeholder="Tên tuỳ chọn"
                          className="flex-1 min-w-0 text-sm font-semibold text-stone-700 bg-transparent border-b border-dashed border-stone-300 hover:border-stone-400 focus:border-stone-600 outline-none py-0.5 transition-colors"
                        />
                        <button type="button" onClick={() => removeVariant(idx)}
                          className="text-red-400 hover:text-red-600 transition flex-shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Row 1: Ảnh + các field */}
                      <div className="flex gap-3 items-start">
                        {/* Upload ảnh biến thể */}
                        <div className="flex-shrink-0">
                          <label className="text-[10px] font-semibold text-stone-400 uppercase block mb-1">Ảnh</label>
                          <div className="relative">
                            <div
                              className="relative w-20 h-20 rounded-xl border-2 border-dashed border-stone-200 bg-white flex items-center justify-center overflow-hidden cursor-pointer hover:border-stone-400 transition"
                              onClick={() => fileRefs.current[idx]?.click()}
                            >
                              {uploading === idx ? (
                                <div className="text-[10px] text-stone-400 text-center">Đang tải...</div>
                              ) : v.image_url && !brokenImageIdx.has(idx) ? (
                                // Link dán tay không giới hạn domain — dùng <img> thường thay vì
                                // next/image để không bị chặn bởi remotePatterns của next.config.ts.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={v.image_url}
                                  alt={v.option_name}
                                  className="w-full h-full object-cover"
                                  onError={() => setBrokenImageIdx(prev => new Set(prev).add(idx))}
                                />
                              ) : v.image_url && brokenImageIdx.has(idx) ? (
                                <div className="text-center px-1">
                                  <AlertTriangle size={14} className="text-red-400 mx-auto mb-0.5" />
                                  <span className="text-[10px] text-red-400 leading-tight">Ảnh lỗi, không tải được</span>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <Upload size={16} className="text-stone-300 mx-auto mb-1" />
                                  <span className="text-[10px] text-stone-300">Chọn ảnh</span>
                                </div>
                              )}
                            </div>
                            {/* Nút xoá ảnh */}
                            {v.image_url && (
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); updateVariant(idx, 'image_url', '') }}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition"
                              >
                                <X size={10} />
                              </button>
                            )}
                            <input
                              ref={el => { fileRefs.current[idx] = el }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => e.target.files?.[0] && handleImageUpload(idx, e.target.files[0])}
                            />
                          </div>
                        </div>

                        {/* Các field dữ liệu */}
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2">
                          {([
                            { key: 'sku',        label: 'SKU',             type: 'text',   placeholder: 'VD: LY-DONUT', isPrice: false },
                            { key: 'price',      label: 'Giá bán (₫)',     type: 'text',   placeholder: 'Trống = giá SP', isPrice: true },
                            { key: 'cost_price', label: 'Giá vốn (₫)',   type: 'text',   placeholder: 'Trống = giá vốn SP', isPrice: true },
                            { key: 'stock',      label: 'Tồn kho',         type: 'number', placeholder: isPreorder ? 'Chưa cần' : '0', isPrice: false },
                            { key: 'weight',     label: 'Cân nặng (kg)',   type: 'number', placeholder: '0.5', isPrice: false },
                          ] as { key: 'sku' | 'price' | 'cost_price' | 'stock' | 'weight'; label: string; type: string; placeholder: string; isPrice: boolean }[]).map(field => (
                            <div key={field.key}>
                              <label className="flex items-center gap-1 text-[10px] font-semibold text-stone-400 mb-1">
                                {field.key === 'cost_price' && <Lock size={9} />}
                                {field.label}
                              </label>
                              <input
                                type={field.type}
                                inputMode={field.isPrice ? 'numeric' : undefined}
                                step={field.key === 'weight' ? '0.1' : undefined}
                                value={v[field.key]}
                                onChange={e => updateVariant(idx, field.key,
                                  field.isPrice ? e.target.value.replace(/\D/g, '') : e.target.value)}
                                onBlur={field.isPrice ? (e => updateVariant(idx, field.key,
                                  e.target.value ? String(Math.round(Number(e.target.value) || 0)) : '')) : undefined}
                                placeholder={field.placeholder}
                                className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-stone-400 bg-white"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Hoặc dán link ảnh thủ công */}
                      <div className="mt-2">
                        <label className="text-[10px] font-semibold text-stone-400 uppercase block mb-1">
                          Hoặc dán link ảnh trực tiếp
                        </label>
                        <input
                          type="text"
                          value={v.image_url}
                          onChange={e => updateVariant(idx, 'image_url', e.target.value)}
                          placeholder="https://... hoặc upload ảnh bên trên"
                          className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-stone-400 bg-white"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {variants.length === 0 && (
            <div className="text-center py-6 text-stone-300 text-xs mt-3">
              Chưa có biến thể nào — nhập tên nhóm + tùy chọn rồi bấm Thêm
            </div>
          )}
        </div>
      )}
    </div>
  )
}