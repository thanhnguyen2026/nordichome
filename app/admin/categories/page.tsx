'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import { Folder, FolderOpen, Edit2, Trash2, Plus, X, Eye, EyeOff, ChevronUp, ChevronDown, Upload } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
  sort_order: number
  image_url?: string
  is_visible: boolean
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order')
    setCategories(data || [])
    setLoading(false)
  }

  // Tải dữ liệu lúc mount — dự án không dùng thư viện fetch data (SWR/React
  // Query) nên đây là cách chuẩn hiện tại cho các trang admin CRUD.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const slugify = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setParentId('')
    setImageUrl('')
  }

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id)
    setName(cat.name)
    setParentId(cat.parent_id || '')
    setImageUrl(cat.image_url || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async () => {
    if (!name.trim()) return

    if (editingId) {
      await supabase.from('categories').update({
        name: name.trim(),
        parent_id: parentId || null,
        image_url: imageUrl || null,
      }).eq('id', editingId)
    } else {
      await supabase.from('categories').insert({
        name: name.trim(),
        slug: slugify(name) + '-' + Date.now().toString().slice(-4),
        parent_id: parentId || null,
        image_url: imageUrl || null,
        sort_order: categories.length,
      })
    }

    resetForm()
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá danh mục này? Sản phẩm thuộc danh mục sẽ không bị xoá.')) return
    await supabase.from('categories').delete().eq('id', id)
    load()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.url) setImageUrl(data.url)
    setUploading(false)
    e.target.value = ''
  }

  const handleToggleVisible = async (cat: Category) => {
    await supabase.from('categories').update({ is_visible: !cat.is_visible }).eq('id', cat.id)
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_visible: !cat.is_visible } : c))
  }

  const parents = categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order)
  const childrenOf = (id: string) =>
    categories.filter(c => c.parent_id === id).sort((a, b) => a.sort_order - b.sort_order)

  // Đổi thứ tự hiển thị — hoán đổi sort_order với hàng liền trước/sau trong
  // cùng nhóm (cùng parent_id), tránh trùng giá trị vì luôn đổi giữa 2 giá
  // trị đã tồn tại sẵn thay vì đoán số mới.
  const moveCategory = async (cat: Category, direction: 'up' | 'down') => {
    const siblings = cat.parent_id ? childrenOf(cat.parent_id) : parents
    const idx = siblings.findIndex(c => c.id === cat.id)
    const swapWith = direction === 'up' ? siblings[idx - 1] : siblings[idx + 1]
    if (!swapWith) return

    setCategories(prev => prev.map(c => {
      if (c.id === cat.id) return { ...c, sort_order: swapWith.sort_order }
      if (c.id === swapWith.id) return { ...c, sort_order: cat.sort_order }
      return c
    }))

    await Promise.all([
      supabase.from('categories').update({ sort_order: swapWith.sort_order }).eq('id', cat.id),
      supabase.from('categories').update({ sort_order: cat.sort_order }).eq('id', swapWith.id),
    ])
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-black mb-1">🗂️ Danh mục sản phẩm</h1>
      <p className="text-stone-400 text-sm mb-6">Tạo danh mục cha và danh mục con để khách hàng dễ lọc sản phẩm</p>

      {/* FORM */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Plus size={16} className="text-stone-500" />
            {editingId ? '✏️ Sửa danh mục' : 'Thêm danh mục mới'}
          </h2>
          {editingId && (
            <button onClick={resetForm} className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition">
              <X size={14} /> Huỷ sửa
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 mb-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Tên danh mục (VD: Sofa đơn)"
            className="flex-1 min-w-[200px] border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
          />
          <select
            value={parentId}
            onChange={e => setParentId(e.target.value)}
            className="border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
          >
            <option value="">— Danh mục cha (gốc) —</option>
            {parents.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={handleSave}
            className="bg-stone-900 text-amber-100 rounded-lg px-5 py-2 text-sm font-bold hover:bg-stone-800 transition"
          >
            {editingId ? '💾 Lưu' : '+ Thêm'}
          </button>
        </div>

        {/* Ảnh đại diện — upload thật hoặc dán link */}
        <div className="flex items-start gap-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-stone-200 transition disabled:opacity-50 flex-shrink-0"
          >
            <Upload size={13} />
            {uploading ? 'Đang tải...' : '📁 Chọn ảnh'}
          </button>
          <input
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="...hoặc dán link ảnh ngoài"
            className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
          />
          {imageUrl && (
            <div className="relative flex-shrink-0">
              {/* imageUrl là link dán tay bất kỳ (không giới hạn domain), next/image không dùng được */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Preview"
                className="w-14 h-14 rounded-lg object-cover border-2 border-stone-200"
                onError={e => (e.currentTarget.style.display = 'none')}
              />
              <button
                onClick={() => setImageUrl('')}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
              >✕</button>
            </div>
          )}
        </div>
        {imageUrl && (
          <p className="text-xs text-stone-400 mt-1.5 ml-0.5">
            ✅ Ảnh xem trước — nếu không hiện, hãy kiểm tra lại link
          </p>
        )}
      </div>

      {/* TREE VIEW */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5">
        {loading ? (
          <div className="text-center py-8 text-stone-400 text-sm">Đang tải...</div>
        ) : parents.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-sm">Chưa có danh mục nào.</div>
        ) : (
          <div className="space-y-2">
            {parents.map(parent => {
              const children = childrenOf(parent.id)
              const isEditingThis = editingId === parent.id
              return (
                <div key={parent.id}>
                  {/* Danh mục cha */}
                  <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2.5 rounded-xl transition ${
                    isEditingThis ? 'bg-amber-50 border border-amber-200' : 'hover:bg-stone-50'
                  } ${!parent.is_visible ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {children.length > 0
                        ? <FolderOpen size={17} className="text-amber-500 flex-shrink-0" />
                        : <Folder size={17} className="text-amber-500 flex-shrink-0" />
                      }
                      {parent.image_url && (
                        // image_url là link dán tay bất kỳ, next/image không dùng được
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={parent.image_url} alt={parent.name}
                          className="w-8 h-8 rounded-md object-cover flex-shrink-0 border border-stone-100" />
                      )}
                      <span className="font-semibold text-sm text-stone-800 truncate">{parent.name}</span>
                      {children.length > 0 && (
                        <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                          {children.length} con
                        </span>
                      )}
                      {!parent.is_visible && (
                        <span className="text-[10px] bg-stone-200 text-stone-500 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">Đang ẩn</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 justify-end sm:justify-start">
                      <div className="flex flex-col">
                        <button onClick={() => moveCategory(parent, 'up')} disabled={parents[0]?.id === parent.id}
                          className="text-stone-400 hover:text-stone-700 disabled:opacity-20 disabled:pointer-events-none" title="Đưa lên trên">
                          <ChevronUp size={14} />
                        </button>
                        <button onClick={() => moveCategory(parent, 'down')} disabled={parents[parents.length - 1]?.id === parent.id}
                          className="text-stone-400 hover:text-stone-700 disabled:opacity-20 disabled:pointer-events-none" title="Đưa xuống dưới">
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <button onClick={() => handleToggleVisible(parent)}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition ${
                          parent.is_visible
                            ? 'text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200'
                            : 'text-green-600 bg-green-50 hover:bg-green-100'
                        }`}
                        title={parent.is_visible ? 'Ẩn danh mục' : 'Hiện danh mục'}
                      >
                        {parent.is_visible ? <EyeOff size={12} /> : <Eye size={12} />}
                        {parent.is_visible ? 'Ẩn' : 'Hiện'}
                      </button>
                      <button onClick={() => handleEdit(parent)}
                        className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded-lg transition">
                        <Edit2 size={12} /> Sửa
                      </button>
                      <button onClick={() => handleDelete(parent.id)}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition">
                        <Trash2 size={12} /> Xoá
                      </button>
                    </div>
                  </div>

                  {/* Danh mục con */}
                  {children.length > 0 && (
                    <div className="ml-6 mt-1 border-l-2 border-slate-200 pl-4 space-y-1 mb-2">
                      {children.map(child => {
                        const isEditingChild = editingId === child.id
                        return (
                          <div key={child.id}
                            className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2 rounded-xl transition ${
                              isEditingChild ? 'bg-amber-50 border border-amber-200' : 'hover:bg-stone-50'
                            } ${!child.is_visible ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Folder size={14} className="text-stone-400 flex-shrink-0" />
                              {child.image_url && (
                                // image_url là link dán tay bất kỳ, next/image không dùng được
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={child.image_url} alt={child.name}
                                  className="w-7 h-7 rounded-md object-cover flex-shrink-0 border border-stone-100" />
                              )}
                              <span className="text-sm text-stone-600 truncate">{child.name}</span>
                              {!child.is_visible && (
                                <span className="text-[10px] bg-stone-200 text-stone-500 px-1.5 py-0.5 rounded-full font-bold">Đang ẩn</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 justify-end sm:justify-start">
                              <div className="flex flex-col">
                                <button onClick={() => moveCategory(child, 'up')} disabled={children[0]?.id === child.id}
                                  className="text-stone-400 hover:text-stone-700 disabled:opacity-20 disabled:pointer-events-none" title="Đưa lên trên">
                                  <ChevronUp size={12} />
                                </button>
                                <button onClick={() => moveCategory(child, 'down')} disabled={children[children.length - 1]?.id === child.id}
                                  className="text-stone-400 hover:text-stone-700 disabled:opacity-20 disabled:pointer-events-none" title="Đưa xuống dưới">
                                  <ChevronDown size={12} />
                                </button>
                              </div>
                              <button onClick={() => handleToggleVisible(child)}
                                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition ${
                                  child.is_visible
                                    ? 'text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200'
                                    : 'text-green-600 bg-green-50 hover:bg-green-100'
                                }`}
                              >
                                {child.is_visible ? <EyeOff size={12} /> : <Eye size={12} />}
                                {child.is_visible ? 'Ẩn' : 'Hiện'}
                              </button>
                              <button onClick={() => handleEdit(child)}
                                className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded-lg transition">
                                <Edit2 size={12} /> Sửa
                              </button>
                              <button onClick={() => handleDelete(child.id)}
                                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition">
                                <Trash2 size={12} /> Xoá
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}