'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import AdminLayout from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, X, ArrowLeft, Eye, EyeOff, Pencil } from 'lucide-react'

interface Look {
  id: string
  title: string
  description: string
  image_url: string
  is_active: boolean
  sort_order: number
}

interface Hotspot {
  id: string
  look_id: string
  product_id: string | null
  x_percent: number
  y_percent: number
  product?: { id: string; name: string; cover_image: string; price: number; sale_price: number | null }
}

interface Product {
  id: string
  name: string
  cover_image: string
  price: number
}

export default function AdminLooks() {
  const [looks, setLooks] = useState<Look[]>([])
  const [editing, setEditing] = useState<Look | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)
  const [pendingProductId, setPendingProductId] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newLook, setNewLook] = useState({ title: '', description: '', image_url: '' })
  const [uploading, setUploading] = useState(false)
  const [editingInfo, setEditingInfo] = useState<Look | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '' })

  const loadLooks = async () => {
    const { data } = await supabase.from('looks').select('*').order('sort_order').order('created_at')
    setLooks(data ?? [])
  }

  const loadHotspots = async (lookId: string) => {
    const { data } = await supabase
      .from('look_hotspots')
      .select('*, product:products(id, name, cover_image, price, sale_price)')
      .eq('look_id', lookId)
    setHotspots(data ?? [])
  }

  // Tải dữ liệu lúc mount — dự án không dùng thư viện fetch data, đây là cách chuẩn hiện tại
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadLooks()
    supabase.from('products').select('id, name, cover_image, price').eq('is_visible', true).order('name')
      .then(({ data }) => setProducts(data ?? []))
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (pending) { setPending(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPending({ x, y })
    setPendingProductId('')
  }

  const handleAddHotspot = async () => {
    if (!pending || !pendingProductId || !editing) return
    setSaving(true)
    await supabase.from('look_hotspots').insert({
      look_id: editing.id,
      product_id: pendingProductId,
      x_percent: pending.x,
      y_percent: pending.y,
    })
    setPending(null)
    setPendingProductId('')
    await loadHotspots(editing.id)
    setSaving(false)
  }

  const handleDeleteHotspot = async (id: string) => {
    await supabase.from('look_hotspots').delete().eq('id', id)
    if (editing) loadHotspots(editing.id)
  }

  const handleToggleActive = async (look: Look) => {
    await supabase.from('looks').update({ is_active: !look.is_active }).eq('id', look.id)
    setLooks(prev => prev.map(l => l.id === look.id ? { ...l, is_active: !look.is_active } : l))
  }

  const handleDeleteLook = async (id: string) => {
    if (!confirm('Xoá look này? Toàn bộ điểm hotspot cũng bị xoá.')) return
    await supabase.from('looks').delete().eq('id', id)
    setLooks(prev => prev.filter(l => l.id !== id))
  }

  const handleSaveInfo = async () => {
    if (!editingInfo || !editForm.title) return
    setSaving(true)
    await supabase.from('looks').update({ title: editForm.title, description: editForm.description }).eq('id', editingInfo.id)
    setSaving(false)
    setEditingInfo(null)
    setLooks(prev => prev.map(l => l.id === editingInfo.id
      ? { ...l, title: editForm.title, description: editForm.description }
      : l
    ))
  }

  const uploadImage = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    return (await res.json()).url || null
  }

  const handleCreateLook = async () => {
    if (!newLook.title || !newLook.image_url) return alert('Cần có tiêu đề và ảnh!')
    setSaving(true)
    const { data } = await supabase.from('looks').insert({ ...newLook, sort_order: looks.length }).select().single()
    setSaving(false)
    setShowCreate(false)
    setNewLook({ title: '', description: '', image_url: '' })
    await loadLooks()
    if (data) { setEditing(data); loadHotspots(data.id) }
  }

  // ── Editor view ─────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <AdminLayout>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setEditing(null); setHotspots([]); setPending(null) }}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition"
          >
            <ArrowLeft size={14} /> Quay lại
          </button>
          <div>
            <h1 className="text-xl font-black leading-tight">{editing.title}</h1>
            <p className="text-xs text-stone-400">Bấm vào ảnh để thêm điểm sản phẩm</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Ảnh editor */}
          <div className="lg:col-span-2">
            <div
              className={`relative rounded-2xl overflow-hidden ${pending ? 'cursor-crosshair' : 'cursor-crosshair'} select-none border-2 ${pending ? 'border-amber-400' : 'border-stone-100'} transition-colors`}
              onClick={handleImageClick}
            >
              {/* image_url có thể là link dán tay bất kỳ (không giới hạn domain
                  cho phép trong next.config.ts) nên không dùng được next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={editing.image_url} alt={editing.title} className="w-full block" draggable={false} />

              {/* Existing hotspots */}
              {hotspots.map((h, i) => (
                <div key={h.id}
                  style={{ left: `${h.x_percent}%`, top: `${h.y_percent}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <div className="w-8 h-8 bg-white rounded-full border-2 border-stone-900 flex items-center justify-center text-xs font-black shadow-lg">
                    {i + 1}
                  </div>
                </div>
              ))}

              {/* Pending hotspot */}
              {pending && (
                <div
                  style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <div className="w-8 h-8 bg-amber-400 rounded-full border-2 border-amber-600 shadow-lg animate-bounce flex items-center justify-center">
                    <span className="text-white font-black text-sm">?</span>
                  </div>
                </div>
              )}
            </div>

            {!pending && (
              <p className="text-xs text-stone-400 mt-2 text-center">
                👆 Bấm vào ảnh để đặt điểm — bấm lại vào chỗ trống để huỷ
              </p>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Pending selector */}
            {pending && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
                <p className="text-sm font-bold mb-3">📍 Chọn sản phẩm cho điểm này</p>
                <select
                  value={pendingProductId}
                  onChange={e => setPendingProductId(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm mb-3 outline-none focus:border-amber-400"
                  autoFocus
                >
                  <option value="">-- Chọn sản phẩm --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {pendingProductId && (() => {
                  const pendingProduct = products.find(p => p.id === pendingProductId)
                  return (
                    <div className="flex items-center gap-2 mb-3 p-2 bg-white rounded-lg">
                      {pendingProduct?.cover_image && (
                        <Image
                          src={pendingProduct.cover_image}
                          alt={pendingProduct.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 object-cover rounded-lg"
                        />
                      )}
                      <span className="text-xs font-semibold line-clamp-2">
                        {pendingProduct?.name}
                      </span>
                    </div>
                  )
                })()}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddHotspot}
                    disabled={!pendingProductId || saving}
                    className="flex-1 bg-stone-900 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-stone-800 disabled:opacity-40 transition"
                  >
                    {saving ? 'Đang lưu...' : '✓ Thêm điểm'}
                  </button>
                  <button
                    onClick={() => setPending(null)}
                    className="px-3 bg-stone-100 hover:bg-stone-200 rounded-xl transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Danh sách hotspot */}
            <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                <p className="text-sm font-bold">Điểm sản phẩm</p>
                <span className="text-xs bg-stone-100 px-2 py-0.5 rounded-full font-semibold">{hotspots.length}</span>
              </div>

              {hotspots.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-2xl mb-2">👆</p>
                  <p className="text-xs text-stone-400">Bấm vào ảnh để thêm điểm đầu tiên</p>
                </div>
              ) : (
                <div>
                  {hotspots.map((h, i) => (
                    <div key={h.id} className="flex items-center gap-3 px-4 py-3 border-b border-stone-50 last:border-0 hover:bg-stone-50 transition">
                      <div className="w-6 h-6 bg-stone-900 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      {h.product?.cover_image && (
                        <Image src={h.product.cover_image} alt={h.product.name} width={40} height={40}
                          className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{h.product?.name || '—'}</p>
                        <p className="text-[10px] text-stone-400 font-mono">
                          {h.x_percent.toFixed(1)}%, {h.y_percent.toFixed(1)}%
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteHotspot(h.id)}
                        className="text-stone-300 hover:text-red-500 transition flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black mb-1">🖼️ Shop the Look</h1>
          <p className="text-stone-400 text-sm">Ảnh không gian với điểm sản phẩm tương tác — hiển thị trên trang chủ</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-stone-900 text-amber-100 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-stone-800 transition"
        >
          <Plus size={16} /> Thêm Look
        </button>
      </div>

      {/* Modal sửa tiêu đề / mô tả */}
      {editingInfo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingInfo(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-lg">Chỉnh sửa Look</h2>
              <button onClick={() => setEditingInfo(null)} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Tiêu đề *</label>
                <input
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-stone-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Mô tả ngắn</label>
                <input
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-stone-400"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSaveInfo} disabled={saving || !editForm.title}
                className="flex-1 bg-stone-900 text-amber-100 py-3 rounded-xl text-sm font-bold hover:bg-stone-800 disabled:opacity-50 transition">
                {saving ? 'Đang lưu...' : '💾 Lưu'}
              </button>
              <button onClick={() => setEditingInfo(null)} className="px-4 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-semibold transition">
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tạo look */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-lg">Tạo Look mới</h2>
              <button onClick={() => setShowCreate(false)} className="text-stone-400 hover:text-stone-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Tiêu đề *</label>
                <input
                  value={newLook.title}
                  onChange={e => setNewLook(n => ({ ...n, title: e.target.value }))}
                  placeholder="VD: Phòng ngủ tối giản"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-stone-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Mô tả ngắn</label>
                <input
                  value={newLook.description}
                  onChange={e => setNewLook(n => ({ ...n, description: e.target.value }))}
                  placeholder="VD: Không gian nghỉ ngơi thanh thản"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-stone-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Ảnh Look *</label>
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex-1 cursor-pointer bg-stone-100 hover:bg-stone-200 text-stone-600 text-sm font-semibold px-3 py-2.5 rounded-xl text-center transition">
                    {uploading ? 'Đang upload...' : '📁 Chọn ảnh từ máy'}
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setUploading(true)
                      const url = await uploadImage(file)
                      if (url) setNewLook(n => ({ ...n, image_url: url }))
                      setUploading(false)
                    }} />
                  </label>
                </div>
                <input
                  value={newLook.image_url}
                  onChange={e => setNewLook(n => ({ ...n, image_url: e.target.value }))}
                  placeholder="Hoặc dán link URL ảnh..."
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
                {newLook.image_url && (
                  // image_url có thể là link dán tay bất kỳ, next/image không dùng được
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={newLook.image_url} alt="Xem trước" className="mt-2 w-full h-40 object-cover rounded-xl" />
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleCreateLook}
                disabled={saving || uploading}
                className="flex-1 bg-stone-900 text-amber-100 py-3 rounded-xl text-sm font-bold hover:bg-stone-800 disabled:opacity-50 transition"
              >
                {saving ? 'Đang tạo...' : 'Tạo Look & Chỉnh sửa điểm →'}
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-semibold transition">
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid looks */}
      {looks.length === 0 ? (
        <div className="text-center py-24 text-stone-400">
          <div className="text-6xl mb-4">🖼️</div>
          <p className="font-semibold mb-1">Chưa có look nào</p>
          <p className="text-sm">Bấm &quot;Thêm Look&quot; để bắt đầu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {looks.map(look => (
            <div key={look.id} className={`bg-white rounded-2xl border overflow-hidden group hover:shadow-md transition ${look.is_active ? 'border-stone-100' : 'border-stone-200 opacity-60'}`}>
              <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                {/* image_url có thể là link dán tay bất kỳ, next/image không dùng được */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={look.image_url}
                  alt={look.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {!look.is_active && (
                  <div className="absolute inset-0 bg-stone-900/40 flex items-center justify-center">
                    <span className="text-white text-xs font-bold bg-stone-900/70 px-3 py-1 rounded-full">Đang ẩn</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-sm leading-tight mb-0.5">{look.title}</h3>
                {look.description && <p className="text-xs text-stone-400 mb-3 line-clamp-1">{look.description}</p>}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setEditing(look); loadHotspots(look.id) }}
                    className="flex-1 bg-stone-900 text-amber-100 text-xs font-bold py-2 rounded-xl hover:bg-stone-800 transition"
                  >
                    ✏️ Chỉnh sửa điểm
                  </button>
                  <button
                    onClick={() => { setEditingInfo(look); setEditForm({ title: look.title, description: look.description }) }}
                    className="px-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl transition text-stone-500"
                    title="Sửa tiêu đề & mô tả"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleActive(look)}
                    className="px-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl transition text-stone-500"
                    title={look.is_active ? 'Ẩn look' : 'Hiện look'}
                  >
                    {look.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    onClick={() => handleDeleteLook(look.id)}
                    className="px-2.5 bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 rounded-xl transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
