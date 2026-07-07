'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import { useRef } from 'react'
import Image from 'next/image'

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const { data } = await supabase.from('settings').select('key,value')
    const s = Object.fromEntries(data?.map(r => [r.key, r.value || '']) ?? [])
    setSettings(s)
    setLoading(false)
  }

  // Tải dữ liệu lúc mount — dự án không dùng thư viện fetch data, đây là cách chuẩn hiện tại
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const set = (key: string, value: string) => setSettings(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    return data.url || null
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadImage(file)
    if (url) set('logo_url', url)
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadImage(file)
    if (url) set('banner_url', url)
  }

  if (loading) return <AdminLayout><div className="text-stone-400 text-sm">Đang tải...</div></AdminLayout>

  return (
    <AdminLayout>
      <h1 className="text-2xl font-black mb-1">⚙️ Cài đặt website</h1>
      <p className="text-stone-400 text-sm mb-6">Logo, banner, nội dung trang chủ, thông tin liên hệ và SEO</p>

      <div className="space-y-6 max-w-2xl">
        {/* Logo & Banner */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <h2 className="font-bold text-sm mb-4">🖼️ Hình ảnh</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-2">Logo cửa hàng</label>
              <div className="relative w-full h-24 bg-stone-100 rounded-xl flex items-center justify-center overflow-hidden mb-2 border-2 border-dashed border-stone-200">
                {settings.logo_url ? <Image src={settings.logo_url} alt="Logo" fill sizes="200px" className="object-contain" /> : <span className="text-stone-400 text-xs">Chưa có logo</span>}
              </div>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <button onClick={() => logoRef.current?.click()} className="text-xs bg-stone-100 rounded-lg px-3 py-1.5 font-semibold hover:bg-stone-200">📁 Chọn ảnh</button>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-2">Banner trang chủ</label>
              <div className="relative w-full h-24 bg-stone-100 rounded-xl overflow-hidden mb-2 border-2 border-dashed border-stone-200">
                {settings.banner_url ? <Image src={settings.banner_url} alt="Banner" fill sizes="300px" className="object-cover" /> : <div className="flex items-center justify-center h-full text-stone-400 text-xs">Chưa có banner</div>}
              </div>
              <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
              <button onClick={() => bannerRef.current?.click()} className="text-xs bg-stone-100 rounded-lg px-3 py-1.5 font-semibold hover:bg-stone-200">📁 Chọn ảnh</button>
            </div>
          </div>
        </div>

        {/* Homepage content */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <h2 className="font-bold text-sm mb-4">🏠 Nội dung trang chủ</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Thanh thông báo trên cùng</label>
              <input value={settings.topbar_text || ''} onChange={e => set('topbar_text', e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Nhãn nhỏ (VD: Bộ sưu tập 2025)</label>
              <input value={settings.hero_label || ''} onChange={e => set('hero_label', e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Tiêu đề - Dòng 1</label>
                <input value={settings.hero_title_1 || ''} onChange={e => set('hero_title_1', e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Tiêu đề - Dòng 2 (màu vàng)</label>
                <input value={settings.hero_title_2 || ''} onChange={e => set('hero_title_2', e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Mô tả banner</label>
              <textarea value={settings.hero_subtitle || ''} onChange={e => set('hero_subtitle', e.target.value)} rows={2}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 resize-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Chữ trên nút</label>
              <input value={settings.hero_button_text || ''} onChange={e => set('hero_button_text', e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">
                Thanh trust signals (bỏ trống để ẩn)
              </label>
              <p className="text-[11px] text-stone-400 mb-2">3 điểm nổi bật hiển thị dưới nút CTA. Bỏ trống cả 3 để ẩn thanh này.</p>
              <div className="grid grid-cols-3 gap-2">
                <input value={settings.hero_trust_1 || ''} onChange={e => set('hero_trust_1', e.target.value)}
                  placeholder="⭐ 4.9/5 đánh giá"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
                <input value={settings.hero_trust_2 || ''} onChange={e => set('hero_trust_2', e.target.value)}
                  placeholder="🚚 Giao nhanh 2–3 ngày"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
                <input value={settings.hero_trust_3 || ''} onChange={e => set('hero_trust_3', e.target.value)}
                  placeholder="🔄 Đổi trả 30 ngày"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              </div>
            </div>
          </div>
        </div>

        {/* About / Brand section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <h2 className="font-bold text-sm mb-4">🏷️ Giới thiệu thương hiệu (cuối trang chủ)</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Tiêu đề</label>
              <input value={settings.about_title || ''} onChange={e => set('about_title', e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Mô tả</label>
              <textarea value={settings.about_description || ''} onChange={e => set('about_description', e.target.value)} rows={3}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 resize-none" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Số liệu 1</label>
                <input value={settings.stat1_number || ''} onChange={e => set('stat1_number', e.target.value)} placeholder="500+"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 mb-1" />
                <input value={settings.stat1_label || ''} onChange={e => set('stat1_label', e.target.value)} placeholder="Sản phẩm"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Số liệu 2</label>
                <input value={settings.stat2_number || ''} onChange={e => set('stat2_number', e.target.value)} placeholder="1000+"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 mb-1" />
                <input value={settings.stat2_label || ''} onChange={e => set('stat2_label', e.target.value)} placeholder="Khách hàng"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Số liệu 3</label>
                <input value={settings.stat3_number || ''} onChange={e => set('stat3_number', e.target.value)} placeholder="5★"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 mb-1" />
                <input value={settings.stat3_label || ''} onChange={e => set('stat3_label', e.target.value)} placeholder="Đánh giá"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <h2 className="font-bold text-sm mb-4">🦶 Footer</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Mô tả ngắn (dưới logo footer)</label>
              <textarea value={settings.footer_description || ''} onChange={e => set('footer_description', e.target.value)} rows={2}
                placeholder="Nội thất phong cách tối giản, tinh tế và mộc mạc."
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 resize-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Copyright (thanh dưới cùng)</label>
              <input value={settings.footer_copyright || ''} onChange={e => set('footer_copyright', e.target.value)}
                placeholder={`© ${new Date().getFullYear()} Nordic Home. All rights reserved.`}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <h2 className="font-bold text-sm mb-4">📞 Thông tin liên hệ</h2>
          <div className="space-y-3">
            {[
              ['site_name', 'Tên cửa hàng'],
              ['hotline', 'Hotline'],
              ['email', 'Email'],
              ['address', 'Địa chỉ'],
              ['facebook_url', 'Link Facebook'],
              ['zalo_url', 'Link Zalo'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-xs font-semibold text-stone-500 block mb-1">{label}</label>
                <input value={settings[key] || ''} onChange={e => set(key, e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              </div>
            ))}
          </div>
        </div>

        {/* Freeship */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-sm">🚚 Miễn phí vận chuyển (Freeship)</h2>
            <button
              type="button"
              onClick={() => set('freeship_enabled', settings.freeship_enabled === '1' ? '0' : '1')}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                settings.freeship_enabled === '1' ? 'bg-green-500' : 'bg-stone-200'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                settings.freeship_enabled === '1' ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
          <p className="text-xs text-stone-400 mb-4">
            Bật để áp dụng freeship — bỏ qua tính phí GHTK, hiện badge xanh trên trang đặt hàng.
          </p>
          {settings.freeship_enabled === '1' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">
                  Đơn tối thiểu để freeship (₫) — để trống hoặc 0 = freeship mọi đơn
                </label>
                <input type="text" inputMode="numeric" pattern="[0-9]*"
                  value={settings.freeship_min_order || ''}
                  onChange={e => set('freeship_min_order', e.target.value.replace(/\D/g, ''))}
                  placeholder="VD: 500000"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Nhãn hiển thị (tuỳ chọn)</label>
                <input
                  value={settings.freeship_label || ''}
                  onChange={e => set('freeship_label', e.target.value)}
                  placeholder="VD: Freeship toàn quốc tháng 7 🎉"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Bank account */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <h2 className="font-bold text-sm mb-1">🏦 Tài khoản ngân hàng (QR thanh toán)</h2>
          <p className="text-xs text-stone-400 mb-5">Khách chọn chuyển khoản sẽ thấy QR VietQR tự động sau khi đặt hàng.</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Ngân hàng</label>
              <select value={settings.bank_id || ''} onChange={e => set('bank_id', e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400">
                <option value="">-- Chọn ngân hàng --</option>
                {[
                  ['MB',   'MB Bank (MBBank)'],
                  ['VCB',  'Vietcombank'],
                  ['TCB',  'Techcombank'],
                  ['ACB',  'ACB'],
                  ['BIDV', 'BIDV'],
                  ['ICB',  'VietinBank'],
                  ['VPB',  'VPBank'],
                  ['STB',  'Sacombank'],
                  ['TPB',  'TPBank'],
                  ['VBA',  'Agribank'],
                  ['HDB',  'HDBank'],
                  ['VIB',  'VIB'],
                  ['MSB',  'MSB'],
                  ['OCB',  'OCB'],
                  ['SHB',  'SHB'],
                  ['LPB',  'LienVietPostBank'],
                  ['SEAB', 'SeABank'],
                  ['EIB',  'Eximbank'],
                  ['NAB',  'Nam A Bank'],
                ].map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Số tài khoản</label>
              <input value={settings.bank_account || ''} onChange={e => set('bank_account', e.target.value)}
                placeholder="VD: 1234567890"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Tên chủ tài khoản</label>
              <input value={settings.bank_holder || ''} onChange={e => set('bank_holder', e.target.value)}
                placeholder="VD: NGUYEN VAN A"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Chi nhánh (tuỳ chọn)</label>
              <input value={settings.bank_branch || ''} onChange={e => set('bank_branch', e.target.value)}
                placeholder="VD: Chi nhánh Phú Nhuận"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>

            {/* Preview QR */}
            {settings.bank_id && settings.bank_account && settings.bank_holder && (
              <div className="mt-2 pt-4 border-t border-stone-100">
                <p className="text-xs font-semibold text-stone-500 mb-3">Preview QR (không có số tiền)</p>
                <Image
                  src={`https://img.vietqr.io/image/${settings.bank_id}-${settings.bank_account}-compact2.png?accountName=${encodeURIComponent(settings.bank_holder)}`}
                  alt="VietQR Preview"
                  width={224}
                  height={224}
                  className="w-56 rounded-xl border border-stone-200 shadow-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Order notifications */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <h2 className="font-bold text-sm mb-1">🔔 Thông báo đơn hàng mới</h2>
          <p className="text-xs text-stone-400 mb-5">Bật kênh nào thì khi có đơn hàng mới sẽ báo qua kênh đó.</p>
          <div className="space-y-4">
            {([
              { key: 'telegram',  label: 'Telegram' },
              { key: 'messenger', label: 'Messenger' },
            ] as { key: string; label: string }[]).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm font-semibold text-stone-700">{label}</span>
                <button
                  type="button"
                  onClick={() => set(`notify_${key}_on`, settings[`notify_${key}_on`] === '1' ? '0' : '1')}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    settings[`notify_${key}_on`] === '1' ? 'bg-green-500' : 'bg-stone-200'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings[`notify_${key}_on`] === '1' ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat channels */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <h2 className="font-bold text-sm mb-1">💬 Kênh tư vấn chat (dưới nút mua)</h2>
          <p className="text-xs text-stone-400 mb-5">Bật kênh nào thì nút đó hiện trên trang sản phẩm. Tắt hết thì ẩn cả khối.</p>
          <div className="space-y-5">
            {([
              { key: 'zalo',      label: 'Zalo',      placeholder: 'https://zalo.me/...' },
              { key: 'messenger', label: 'Messenger', placeholder: 'https://m.me/...' },
              { key: 'telegram',  label: 'Telegram',  placeholder: 'https://t.me/...' },
              { key: 'instagram', label: 'Instagram', placeholder: 'https://ig.me/...' },
            ] as { key: string; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
              <div key={key} className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => set(`chat_${key}_on`, settings[`chat_${key}_on`] === '1' ? '0' : '1')}
                  className={`mt-6 relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                    settings[`chat_${key}_on`] === '1' ? 'bg-green-500' : 'bg-stone-200'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings[`chat_${key}_on`] === '1' ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-stone-500 block mb-1">{label}</label>
                  <input
                    value={settings[`chat_${key}_url`] || ''}
                    onChange={e => set(`chat_${key}_url`, e.target.value)}
                    placeholder={placeholder}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Công thức giá vốn Taobao */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <h2 className="font-bold text-sm mb-1">🧮 Công thức tính giá vốn Taobao</h2>
          <p className="text-xs text-stone-400 mb-5">
            Dùng chung cho mọi sản phẩm để tự tính giá vốn từ giá gốc Taobao (¥): <br />
            Giá vốn = Giá Taobao (¥) × Tỷ giá × (1 + Hệ số phí%) + Giá ship/kg × Cân nặng
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Tỷ giá (1¥ = ? đ)</label>
              <input type="text" inputMode="decimal" value={settings.taobao_exchange_rate || ''}
                onChange={e => set('taobao_exchange_rate', e.target.value)}
                placeholder="VD: 3650"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Hệ số phí trung gian (%)</label>
              <input type="text" inputMode="decimal" value={settings.taobao_fee_percent || ''}
                onChange={e => set('taobao_fee_percent', e.target.value)}
                placeholder="VD: 3"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Giá ship TQ-VN (đ/kg)</label>
              <input type="text" inputMode="decimal" value={settings.taobao_shipping_per_kg || ''}
                onChange={e => set('taobao_shipping_per_kg', e.target.value)}
                placeholder="VD: 25000"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
          </div>
        </div>

        {/* SEO */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <h2 className="font-bold text-sm mb-4">🔍 SEO</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Meta Title</label>
              <input value={settings.meta_title || ''} onChange={e => set('meta_title', e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Meta Description</label>
              <textarea value={settings.meta_description || ''} onChange={e => set('meta_description', e.target.value)} rows={2}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 resize-none" />
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="bg-stone-900 text-amber-100 rounded-lg px-6 py-3 text-sm font-bold hover:bg-stone-800 transition disabled:opacity-50">
          {saving ? 'Đang lưu...' : saved ? '✅ Đã lưu!' : '💾 Lưu cài đặt'}
        </button>
      </div>
    </AdminLayout>
  )
}