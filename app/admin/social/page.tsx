'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import { Plus, Trash2, GripVertical, Upload, Link, Save } from 'lucide-react'

const FLOAT_CHANNELS = [
  { key: 'zalo',      label: 'Zalo',       placeholder: 'https://zalo.me/...',              color: '#0068FF' },
  { key: 'messenger', label: 'Messenger',  placeholder: 'https://m.me/...',                 color: '#006AFF' },
  { key: 'youtube',   label: 'YouTube',    placeholder: 'https://youtube.com/@...',         color: '#FF0000' },
  { key: 'instagram', label: 'Instagram',  placeholder: 'https://instagram.com/...',        color: '#E1306C' },
  { key: 'tiktok',    label: 'TikTok',     placeholder: 'https://tiktok.com/@...',          color: '#010101' },
  { key: 'shopee',    label: 'Shopee',     placeholder: 'https://shopee.vn/...',            color: '#EE4D2D' },
  { key: 'twitter',   label: 'X / Twitter',placeholder: 'https://x.com/...',               color: '#000000' },
]

interface Channel {
  id: string
  name: string
  url: string
  icon_url: string
  sort_order: number
  isNew?: boolean
  iconPreview?: string
  iconFile?: File
}

const DEFAULT_ICONS: Record<string, string> = {
  'Facebook':    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Facebook_Logo_%282019%29.png/240px-Facebook_Logo_%282019%29.png',
  'Instagram':   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/240px-Instagram_icon.png',
  'Shopee':      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Shopee.svg/240px-Shopee.svg.png',
  'TikTok Shop': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Ionicons_logo-tiktok.svg/240px-Ionicons_logo-tiktok.svg.png',
  'Zalo':        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/240px-Icon_of_Zalo.svg.png',
  'YouTube':     'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/240px-YouTube_full-color_icon_%282017%29.svg.png',
}

export default function AdminSocialChannels() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Float settings
  const [floatSettings, setFloatSettings] = useState<Record<string, string>>({})
  const [savingFloat, setSavingFloat] = useState(false)
  const [savedFloat, setSavedFloat] = useState(false)

  const setFloat = (key: string, val: string) =>
    setFloatSettings(prev => ({ ...prev, [key]: val }))

  const loadFloat = async () => {
    const keys = FLOAT_CHANNELS.flatMap(c => [`float_${c.key}_on`, `float_${c.key}_url`])
    const { data } = await supabase.from('settings').select('key,value').in('key', keys)
    setFloatSettings(Object.fromEntries(data?.map(r => [r.key, r.value || '']) ?? []))
  }

  const saveFloat = async () => {
    setSavingFloat(true)
    for (const [key, value] of Object.entries(floatSettings)) {
      await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    }
    setSavingFloat(false)
    setSavedFloat(true)
    setTimeout(() => setSavedFloat(false), 2500)
  }

  const load = async () => {
    const { data } = await supabase
      .from('social_channels')
      .select('*')
      .order('sort_order')
    setChannels((data || []).map(c => ({
      ...c,
      iconPreview: c.icon_url || DEFAULT_ICONS[c.name] || '',
    })))
    setLoading(false)
  }

  // Tải dữ liệu lúc mount — dự án không dùng thư viện fetch data, đây là cách chuẩn hiện tại
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); loadFloat() }, [])

  const updateChannel = <K extends keyof Channel>(id: string, key: K, value: Channel[K]) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, [key]: value } : c))
  }

  const handleIconUpload = async (id: string, file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    return data.url || null
  }

  const handleFileChange = (id: string, file: File) => {
    const preview = URL.createObjectURL(file)
    setChannels(prev => prev.map(c =>
      c.id === id ? { ...c, iconFile: file, iconPreview: preview } : c
    ))
  }

  const addChannel = () => {
    const newId = 'new-' + Date.now()
    setChannels(prev => [...prev, {
      id: newId,
      name: '',
      url: '',
      icon_url: '',
      sort_order: prev.length,
      isNew: true,
      iconPreview: '',
    }])
  }

  const removeChannel = async (id: string, isNew?: boolean) => {
    if (!isNew) {
      if (!confirm('Xoá kênh này?')) return
      await supabase.from('social_channels').delete().eq('id', id)
    }
    setChannels(prev => prev.filter(c => c.id !== id))
  }

  const handleSave = async () => {
    setSaving(true)
    for (const ch of channels) {
      let iconUrl = ch.icon_url

      // Upload icon mới nếu có
      if (ch.iconFile) {
        const uploaded = await handleIconUpload(ch.id, ch.iconFile)
        if (uploaded) iconUrl = uploaded
      }

      if (ch.isNew) {
        await supabase.from('social_channels').insert({
          name: ch.name,
          url: ch.url,
          icon_url: iconUrl,
          sort_order: ch.sort_order,
        })
      } else {
        await supabase.from('social_channels').update({
          name: ch.name,
          url: ch.url,
          icon_url: iconUrl,
          sort_order: ch.sort_order,
        }).eq('id', ch.id)
      }
    }
    await load()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">📣 Kênh bán hàng</h1>
          <p className="text-stone-400 text-sm mt-1">
            Quản lý các kênh mạng xã hội & sàn thương mại điện tử
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-stone-900 text-amber-100 rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-stone-800 transition disabled:opacity-50"
        >
          <Save size={15} />
          {saving ? 'Đang lưu...' : saved ? '✅ Đã lưu!' : 'Lưu cấu hình'}
        </button>
      </div>

      {/* ── Nút liên hệ nổi ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="font-bold text-sm">📌 Nút liên hệ nổi (Floating Bar)</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Hiển thị bên phải trang web — bật kênh nào thì nút đó xuất hiện
            </p>
          </div>
          <button
            onClick={saveFloat}
            disabled={savingFloat}
            className="flex items-center gap-2 bg-stone-900 text-amber-100 rounded-xl px-4 py-2 text-xs font-bold hover:bg-stone-800 transition disabled:opacity-50"
          >
            <Save size={13} />
            {savingFloat ? 'Đang lưu...' : savedFloat ? '✅ Đã lưu!' : 'Lưu'}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {FLOAT_CHANNELS.map(ch => (
            <div key={ch.key} className="flex items-center gap-3">
              {/* Toggle */}
              <button
                type="button"
                onClick={() => setFloat(`float_${ch.key}_on`, floatSettings[`float_${ch.key}_on`] === '1' ? '0' : '1')}
                className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                  floatSettings[`float_${ch.key}_on`] === '1' ? 'bg-green-500' : 'bg-stone-200'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  floatSettings[`float_${ch.key}_on`] === '1' ? 'translate-x-4' : ''
                }`} />
              </button>

              {/* Color dot */}
              <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: ch.color }} />

              {/* Label + Input */}
              <div className="flex-1 grid grid-cols-4 gap-2 items-center">
                <span className="text-sm font-semibold col-span-1">{ch.label}</span>
                <input
                  value={floatSettings[`float_${ch.key}_url`] || ''}
                  onChange={e => setFloat(`float_${ch.key}_url`, e.target.value)}
                  placeholder={ch.placeholder}
                  className="col-span-3 border border-stone-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-stone-400"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Preview */}
        {FLOAT_CHANNELS.some(c => floatSettings[`float_${c.key}_on`] === '1') && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <p className="text-xs text-stone-400 mb-2">Preview thứ tự nút:</p>
            <div className="flex gap-2 flex-wrap">
              {FLOAT_CHANNELS.filter(c => floatSettings[`float_${c.key}_on`] === '1').map(c => (
                <span key={c.key} className="text-xs text-white px-2.5 py-1 rounded-full font-semibold"
                  style={{ backgroundColor: c.color }}>
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Kênh bán hàng (footer/listing) ──────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-sm">🛍️ Kênh bán hàng (hiển thị ở Footer)</h2>
          <p className="text-xs text-stone-400 mt-0.5">Các kênh TMĐT và mạng xã hội hiển thị ở cuối trang</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-stone-400 text-sm">Đang tải...</div>
      ) : (
        <div className="space-y-3 mb-6">
          {channels.map(ch => (
            <div key={ch.id}
              className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 flex items-center gap-4 group">

              {/* Drag handle */}
              <div className="text-stone-300 cursor-grab flex-shrink-0">
                <GripVertical size={18} />
              </div>

              {/* Icon preview + upload */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-xl border-2 border-stone-100 overflow-hidden bg-stone-50 flex items-center justify-center">
                  {ch.iconPreview ? (
                    // iconPreview có thể là blob: URL (xem trước file vừa chọn,
                    // chưa upload xong) — next/image không xử lý được blob URL.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ch.iconPreview}
                      alt={ch.name}
                      className="w-10 h-10 object-contain"
                      onError={e => (e.currentTarget.style.display = 'none')}
                    />
                  ) : (
                    <span className="text-stone-300 text-xs font-bold">
                      {ch.name?.[0] || '?'}
                    </span>
                  )}
                </div>
                {/* Upload button overlay */}
                <button
                  onClick={() => fileRefs.current[ch.id]?.click()}
                  className="absolute -bottom-1 -right-1 w-5 h-5 bg-stone-800 text-white rounded-full flex items-center justify-center hover:bg-stone-600 transition"
                  title="Đổi icon"
                >
                  <Upload size={10} />
                </button>
                <input
                  ref={el => { fileRefs.current[ch.id] = el }}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileChange(ch.id, e.target.files[0])}
                />
              </div>

              {/* Tên kênh */}
              <div className="w-36 flex-shrink-0">
                <label className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide block mb-1">
                  Tên kênh
                </label>
                <input
                  value={ch.name}
                  onChange={e => {
                    updateChannel(ch.id, 'name', e.target.value)
                    // Tự gợi ý icon nếu tên khớp
                    if (!ch.iconFile && DEFAULT_ICONS[e.target.value]) {
                      updateChannel(ch.id, 'iconPreview', DEFAULT_ICONS[e.target.value])
                    }
                  }}
                  placeholder="VD: Facebook"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
              </div>

              {/* URL */}
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide block mb-1">
                  Đường dẫn (URL)
                </label>
                <div className="relative">
                  <Link size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    value={ch.url}
                    onChange={e => updateChannel(ch.id, 'url', e.target.value)}
                    placeholder="https://facebook.com/nordichomevn"
                    className="w-full border border-stone-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:border-stone-400"
                  />
                </div>
              </div>

              {/* Test link */}
              {ch.url && (
                <a
                  href={ch.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-stone-400 hover:text-stone-700 transition flex-shrink-0"
                  title="Mở link"
                >
                  🔗
                </a>
              )}

              {/* Xoá */}
              <button
                onClick={() => removeChannel(ch.id, ch.isNew)}
                className="flex-shrink-0 text-stone-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Thêm kênh mới */}
      <button
        onClick={addChannel}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 rounded-2xl py-4 text-sm text-stone-400 hover:border-stone-400 hover:text-stone-600 transition"
      >
        <Plus size={16} />
        Thêm kênh bán hàng mới
      </button>

      {/* Hướng dẫn */}
      <div className="mt-6 bg-stone-50 rounded-2xl p-4 text-sm text-stone-500 space-y-1.5">
        <div className="font-semibold text-stone-700 mb-2">💡 Hướng dẫn</div>
        <div>• Nhấn nút <b>Upload</b> (góc dưới phải icon) để đổi icon cho từng kênh</div>
        <div>• Nếu tên kênh khớp (Facebook, Instagram, Shopee...) icon sẽ tự điền</div>
        <div>• Nhấn 🔗 để kiểm tra link trước khi lưu</div>
        <div>• Nhớ nhấn <b>Lưu cấu hình</b> sau khi chỉnh xong</div>
      </div>
    </AdminLayout>
  )
}