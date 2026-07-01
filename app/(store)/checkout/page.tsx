'use client'
import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { useCartStore, itemKey } from '@/store/cartStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { calcTotalWeight } from '@/lib/shipping'
import { Truck, AlertTriangle, Loader2, ChevronDown } from 'lucide-react'
import { trackPurchase, generateEventId, getCookie } from '@/lib/analytics'

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

interface AddrItem { code: number; name: string }

const SELECT_CLS = `w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm
  outline-none focus:border-stone-400 appearance-none bg-white
  disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed`

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
    </div>
  )
}

export default function CheckoutPage() {
  const { items, total, clearCart } = useCartStore()
  const [settings, setSettings] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    name: '', phone: '', streetAddress: '', note: '',
    payment: 'cod',
    province: '', district: '', ward: '',
  })

  // Cascading address data
  const [provinces, setProvinces]   = useState<AddrItem[]>([])
  const [districts, setDistricts]   = useState<AddrItem[]>([])
  const [wards,     setWards]       = useState<AddrItem[]>([])
  const [addrLoading, setAddrLoading] = useState<'districts' | 'wards' | null>(null)

  // Shipping
  const [shippingFee,   setShippingFee]   = useState<number | null>(null)
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [loadingFee,    setLoadingFee]    = useState(false)

  const [submitting,    setSubmitting]    = useState(false)
  const [orderCode,     setOrderCode]     = useState('')
  const [paidTotal,     setPaidTotal]     = useState(0)
  const [paidMethod,    setPaidMethod]    = useState('')
  const [messengerUrl,  setMessengerUrl]  = useState('')
  const [copiedToast,   setCopiedToast]   = useState(false)
  const router = useRouter()
  const hasHydrated = useCartStore(s => s.hasHydrated)

  const { totalWeight, hasBulky } = calcTotalWeight(items as any)
  const grandTotal = total() + (shippingFee ?? 0)

  // ── Load settings + tỉnh/thành ──────────────────────────────────────────────
  useEffect(() => {
    supabase.from('settings').select('key,value').then(({ data }) => {
      setSettings(Object.fromEntries(data?.map(r => [r.key, r.value || '']) ?? []))
    })
    fetch('https://provinces.open-api.vn/api/?depth=1')
      .then(r => r.json())
      .then(setProvinces)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (hasHydrated && items.length === 0 && !orderCode) router.replace('/cart')
  }, [hasHydrated, items, orderCode, router])

  // ── Khi đổi tỉnh → load quận/huyện ─────────────────────────────────────────
  useEffect(() => {
    if (!form.province) { setDistricts([]); setWards([]); setShippingFee(null); return }
    const prov = provinces.find(p => p.name === form.province)
    if (!prov) return
    setAddrLoading('districts')
    setDistricts([]); setWards([])
    setForm(f => ({ ...f, district: '', ward: '' }))
    setShippingFee(null); setShippingError(null)
    fetch(`https://provinces.open-api.vn/api/p/${prov.code}?depth=2`)
      .then(r => r.json())
      .then(d => setDistricts(d.districts ?? []))
      .finally(() => setAddrLoading(null))
  }, [form.province, provinces])

  // ── Khi đổi quận → load phường/xã ───────────────────────────────────────────
  useEffect(() => {
    if (!form.district) { setWards([]); setShippingFee(null); return }
    const dist = districts.find(d => d.name === form.district)
    if (!dist) return
    setAddrLoading('wards')
    setWards([])
    setForm(f => ({ ...f, ward: '' }))
    setShippingFee(null); setShippingError(null)
    fetch(`https://provinces.open-api.vn/api/d/${dist.code}?depth=2`)
      .then(r => r.json())
      .then(d => setWards(d.wards ?? []))
      .finally(() => setAddrLoading(null))
  }, [form.district, districts])

  const isFreeship = settings.freeship_enabled === '1'

  // ── Khi đổi phường → gọi GHTK tính phí (bỏ qua nếu freeship) ──────────────
  const fetchShipping = useCallback(async (province: string, district: string, ward: string) => {
    if (!province || !district || !ward || hasBulky) return
    if (isFreeship) { setShippingFee(0); return }
    setLoadingFee(true); setShippingError(null)
    try {
      const res = await fetch('/api/shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ province, district, ward, weight: totalWeight, value: total() }),
      })
      const data = await res.json()
      if (data.fee !== undefined) setShippingFee(data.fee)
      else { setShippingError(data.error || 'Không tính được phí'); setShippingFee(null) }
    } catch {
      setShippingError('Lỗi kết nối, thử lại sau'); setShippingFee(null)
    } finally {
      setLoadingFee(false)
    }
  }, [hasBulky, isFreeship, totalWeight, total])

  // Freeship bật → set fee = 0 ngay, không cần chọn địa chỉ
  useEffect(() => {
    if (isFreeship && !hasBulky) setShippingFee(0)
  }, [isFreeship, hasBulky])

  useEffect(() => {
    if (form.ward) fetchShipping(form.province, form.district, form.ward)
  }, [form.ward, form.province, form.district, fetchShipping])

  // ── Submit đơn ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.province || !form.district || !form.ward || !form.streetAddress) {
      return alert('Vui lòng điền đầy đủ địa chỉ!')
    }
    if (!hasBulky && shippingFee === null) {
      return alert('Vui lòng chờ hệ thống tính phí vận chuyển!')
    }
    setSubmitting(true)

    const fullAddress = `${form.streetAddress}, ${form.ward}, ${form.district}, ${form.province}`

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name:    form.name,
        customer_phone:   form.phone,
        customer_address: fullAddress,
        customer_note:    form.note,
        payment_method:   form.payment,
        shipping_fee:     shippingFee ?? 0,
        shipping_zone:    form.province,
        total_weight:     totalWeight,
        items: items.map(i => ({
          product_id:         i.product.id,
          product_name:       i.product.name,
          product_image:      i.product.cover_image,
          price:              i.product.sale_price ?? i.product.price,
          quantity:           i.quantity,
          cost_price:         (i.product as any).cost_price ?? 0,
          origin_url:         (i.product as any).origin_url ?? '',
          variant_id:         (i.product as any).variant_id ?? null,
          variant_label:      (i.product as any).variant_label ?? null,
          variant_image:      (i.product as any).variant_image ?? null,
          variant_cost_price: (i.product as any).variant_cost_price ?? null,
        })),
      }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (data.order_code) {
      const eventId = generateEventId()
      const purchaseItems = items.map(i => ({
        id:           i.product.id,
        name:         i.product.name,
        price:        i.product.sale_price ?? i.product.price,
        quantity:     i.quantity,
        variantLabel: (i.product as any).variant_label ?? null,
      }))

      // Client-side (GTM → GA4 / Meta Pixel / Google Ads)
      trackPurchase({
        orderId:  data.order_code,
        total:    grandTotal,
        shipping: shippingFee ?? 0,
        subtotal: total(),
        items:    purchaseItems,
        eventId,
      })

      // Server-side Meta CAPI (deduplication via eventId)
      fetch('/api/events', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName:  'Purchase',
          eventId,
          value:      grandTotal,
          orderId:    data.order_code,
          contentIds: purchaseItems.map(i => i.id),
          userPhone:  form.phone,
          fbp:        getCookie('_fbp'),
          fbc:        getCookie('_fbc'),
        }),
      }).catch(() => {})

      setPaidTotal(grandTotal)
      setPaidMethod(form.payment)
      setOrderCode(data.order_code)
      clearCart()
    } else {
      alert('Có lỗi: ' + (data.error || 'Vui lòng thử lại'))
    }
  }

  // ── Màn hình thành công ─────────────────────────────────────────────────────
  if (orderCode) {
    const isBank  = paidMethod === 'bank'
    const hasBank = settings.bank_id && settings.bank_account && settings.bank_holder
    const qrUrl   = isBank && hasBank
      ? `https://img.vietqr.io/image/${settings.bank_id}-${settings.bank_account}-compact2.png` +
        `?amount=${paidTotal}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(settings.bank_holder)}`
      : null

    return (
      <main className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-3">🎉</div>
        <h1 className="text-2xl font-black mb-1">Đặt hàng thành công!</h1>
        <p className="text-stone-500 text-sm mb-1">Mã đơn hàng của bạn:</p>
        <div className="text-xl font-black text-amber-700 font-mono mb-4">{orderCode}</div>

        {isBank && hasBank ? (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 text-left">
            <p className="text-sm font-bold text-stone-800 mb-1 text-center">💳 Quét mã QR để thanh toán</p>
            <p className="text-xs text-stone-400 mb-4 text-center">Mở app ngân hàng → Quét mã QR bên dưới</p>
            {qrUrl && (
              <div className="flex justify-center mb-5">
                <Image src={qrUrl} alt="QR chuyển khoản" width={256} height={256} className="w-64 rounded-xl border border-stone-200 shadow-sm" />
              </div>
            )}
            <div className="space-y-2.5 text-sm bg-stone-50 rounded-xl p-4">
              <div className="flex justify-between">
                <span className="text-stone-500">Ngân hàng</span>
                <span className="font-semibold">{settings.bank_id}{settings.bank_branch ? ` — ${settings.bank_branch}` : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Số tài khoản</span>
                <button onClick={() => navigator.clipboard.writeText(settings.bank_account)}
                  className="font-mono font-bold hover:text-amber-700 transition" title="Bấm để sao chép">
                  {settings.bank_account} 📋
                </button>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Chủ tài khoản</span>
                <span className="font-semibold uppercase">{settings.bank_holder}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Số tiền</span>
                <span className="font-black text-amber-700">{fmt(paidTotal)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-stone-200 pt-2.5">
                <span className="text-stone-500">Nội dung CK</span>
                <button onClick={() => navigator.clipboard.writeText(orderCode)}
                  className="font-mono font-bold hover:text-amber-700 transition" title="Bấm để sao chép">
                  {orderCode} 📋
                </button>
              </div>
            </div>
            <p className="text-xs text-stone-400 mt-4 text-center leading-relaxed">
              Vui lòng chuyển khoản đúng nội dung để đơn hàng được xử lý nhanh nhất.
            </p>
          </div>
        ) : (
          <p className="text-stone-400 text-sm">Chúng tôi sẽ liên hệ xác nhận đơn sớm nhất!</p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={`/orders/${orderCode}?phone=${encodeURIComponent(form.phone)}`}
            className="bg-amber-500 text-white px-6 py-3 rounded-lg text-sm font-bold inline-block hover:bg-amber-600 transition text-center"
          >
            📦 Theo dõi đơn hàng
          </a>
          <a href="/" className="bg-stone-900 text-amber-100 px-6 py-3 rounded-lg text-sm font-bold inline-block hover:bg-stone-800 transition text-center">
            Về trang chủ
          </a>
        </div>
      </main>
    )
  }

  // ── Form đặt hàng ───────────────────────────────────────────────────────────
  return (
    <>
      <header className="bg-white border-b border-stone-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            {settings.logo_url && (
              <Image src={settings.logo_url} alt="Logo" width={48} height={48} className="h-12 w-12 object-contain rounded-lg" />
            )}
            <div>
              <div className="text-base md:text-lg font-black text-stone-900 tracking-wide leading-tight">
                {settings.site_name || 'NORDIC HOME'}
              </div>
              <div className="text-[8px] text-amber-700 tracking-[3px] uppercase">
                Simplify & Enjoy
              </div>
            </div>
          </a>
          <a href="/cart" className="text-sm font-semibold text-stone-600 hover:text-stone-900">← Giỏ hàng</a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-black mb-6">📋 Thông tin đặt hàng</h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Thông tin khách hàng */}
          <div className="bg-white rounded-2xl border border-stone-100 p-6 space-y-4">
            <h2 className="font-bold text-sm text-stone-700">👤 Thông tin nhận hàng</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Họ tên *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-stone-400" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Số điện thoại *</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-stone-400" required />
              </div>
            </div>

            {/* Địa chỉ 3 cấp */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Tỉnh / Thành phố */}
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Tỉnh / Thành phố *</label>
                <SelectWrapper>
                  <select value={form.province}
                    onChange={e => setForm(f => ({ ...f, province: e.target.value, district: '', ward: '' }))}
                    className={SELECT_CLS} required>
                    <option value="">-- Chọn tỉnh/TP --</option>
                    {provinces.map(p => <option key={p.code} value={p.name}>{p.name}</option>)}
                  </select>
                </SelectWrapper>
              </div>

              {/* Quận / Huyện */}
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Quận / Huyện *</label>
                <SelectWrapper>
                  <select value={form.district}
                    onChange={e => setForm(f => ({ ...f, district: e.target.value, ward: '' }))}
                    disabled={!form.province || addrLoading === 'districts'}
                    className={SELECT_CLS} required>
                    <option value="">
                      {addrLoading === 'districts' ? 'Đang tải...' : '-- Chọn quận/huyện --'}
                    </option>
                    {districts.map(d => <option key={d.code} value={d.name}>{d.name}</option>)}
                  </select>
                </SelectWrapper>
              </div>

              {/* Phường / Xã */}
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Phường / Xã *</label>
                <SelectWrapper>
                  <select value={form.ward}
                    onChange={e => setForm(f => ({ ...f, ward: e.target.value }))}
                    disabled={!form.district || addrLoading === 'wards'}
                    className={SELECT_CLS} required>
                    <option value="">
                      {addrLoading === 'wards' ? 'Đang tải...' : '-- Chọn phường/xã --'}
                    </option>
                    {wards.map(w => <option key={w.code} value={w.name}>{w.name}</option>)}
                  </select>
                </SelectWrapper>
              </div>
            </div>

            {/* Số nhà, đường */}
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Số nhà, tên đường *</label>
              <input value={form.streetAddress}
                onChange={e => setForm(f => ({ ...f, streetAddress: e.target.value }))}
                placeholder="VD: 123 Nguyễn Văn A"
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-stone-400" required />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Ghi chú</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2}
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-stone-400 resize-none" />
            </div>
          </div>

          {/* Phí vận chuyển */}
          {isFreeship && !hasBulky ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
              <Truck size={18} className="text-green-600 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm text-green-700">
                  {settings.freeship_label || '🎉 Miễn phí vận chuyển'}
                </div>
                <div className="text-xs text-green-600 mt-0.5">Áp dụng cho toàn bộ đơn hàng</div>
              </div>
            </div>
          ) : (hasBulky || form.ward) && (
            <div className={`rounded-2xl border p-4 flex items-start gap-3 ${
              hasBulky        ? 'bg-red-50 border-red-200'
              : shippingError ? 'bg-orange-50 border-orange-200'
                              : 'bg-stone-50 border-stone-200'
            }`}>
              {hasBulky ? (
                <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              ) : loadingFee ? (
                <Loader2 size={18} className="text-stone-400 flex-shrink-0 mt-0.5 animate-spin" />
              ) : (
                <Truck size={18} className="text-stone-500 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className={`font-bold text-sm ${hasBulky ? 'text-red-600' : 'text-stone-800'}`}>
                  Phí vận chuyển
                </div>
                <div className={`text-sm mt-0.5 ${
                  hasBulky        ? 'text-red-500'
                  : shippingError ? 'text-orange-600'
                  : loadingFee    ? 'text-stone-400'
                                  : 'text-amber-700 font-bold'
                }`}>
                  {hasBulky        ? 'Sản phẩm có kích thước lớn — vui lòng liên hệ để được báo phí vận chuyển'
                  : shippingError  ? shippingError
                  : loadingFee     ? 'Đang tính phí...'
                  : shippingFee !== null ? fmt(shippingFee)
                                        : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Phương thức thanh toán */}
          <div className="bg-white rounded-2xl border border-stone-100 p-6">
            <h2 className="font-bold text-sm text-stone-700 mb-3">💳 Phương thức thanh toán</h2>
            <div className="space-y-2">
              {[
                ['cod',  '💵 Thanh toán khi nhận hàng (COD)'],
                ['bank', '🏦 Chuyển khoản / Quét mã QR'],
              ].map(([val, label]) => (
                <label key={val} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                  form.payment === val ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:bg-stone-50'
                }`}>
                  <input type="radio" checked={form.payment === val}
                    onChange={() => setForm(f => ({ ...f, payment: val }))} />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>

            {form.payment === 'bank' && settings.bank_id && settings.bank_account && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-1.5">
                <p className="font-bold text-amber-800 mb-2">📱 Thông tin chuyển khoản</p>
                <div className="flex justify-between">
                  <span className="text-stone-500">Ngân hàng</span>
                  <span className="font-semibold">{settings.bank_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Số tài khoản</span>
                  <span className="font-mono font-bold">{settings.bank_account}</span>
                </div>
                {settings.bank_holder && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">Chủ tài khoản</span>
                    <span className="font-semibold uppercase">{settings.bank_holder}</span>
                  </div>
                )}
                <p className="text-xs text-amber-700 mt-2 pt-2 border-t border-amber-200">
                  Sau khi đặt hàng bạn sẽ nhận mã QR để quét thanh toán nhanh.
                </p>
              </div>
            )}
          </div>

          {/* Tóm tắt đơn hàng */}
          <div className="bg-white rounded-2xl border border-stone-100 p-6">
            <h2 className="font-bold text-sm text-stone-700 mb-3">🧾 Tóm tắt đơn hàng</h2>
            {items.map(item => {
              const variantLabel = (item.product as any).variant_label
              return (
                <div key={itemKey(item)} className="flex justify-between text-sm mb-2">
                  <span className="text-stone-500">
                    {item.product.name}
                    {variantLabel && <span className="text-stone-400"> ({variantLabel})</span>}
                    {' '}× {item.quantity}
                  </span>
                  <span className="font-semibold">{fmt((item.product.sale_price ?? item.product.price) * item.quantity)}</span>
                </div>
              )
            })}
            <div className="border-t border-stone-100 mt-3 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Tiền hàng</span>
                <span>{fmt(total())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Phí vận chuyển</span>
                <span>
                  {hasBulky        ? <span className="text-red-500 text-xs">Liên hệ</span>
                  : isFreeship     ? <span className="text-green-600 font-bold">Miễn phí</span>
                  : loadingFee     ? <span className="text-stone-400">Đang tính...</span>
                  : shippingFee !== null ? fmt(shippingFee)
                                        : '—'}
                </span>
              </div>
              {!hasBulky && shippingFee !== null && (
                <div className="flex justify-between font-black text-base border-t border-stone-100 pt-2">
                  <span>Tổng cộng</span>
                  <span className="text-amber-700">{fmt(grandTotal)}</span>
                </div>
              )}
            </div>
          </div>

          {hasBulky ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const lines = items.map(i => {
                    const price = i.product.sale_price ?? i.product.price
                    const variant = (i.product as any).variant_label ? ` (${(i.product as any).variant_label})` : ''
                    return `• ${i.product.name}${variant} × ${i.quantity} — ${fmt(price * i.quantity)}`
                  })
                  const address = [form.streetAddress, form.ward, form.district, form.province]
                    .filter(Boolean).join(', ')
                  const msg = [
                    'Xin chào Nordic Home! Tôi muốn tư vấn đơn hàng sau:',
                    '',
                    ...lines,
                    '',
                    `💰 Tổng tiền hàng: ${fmt(total())}`,
                    address ? `📍 Giao đến: ${address}` : '',
                    '',
                    'Vui lòng tư vấn phí ship và thời gian giao hàng giúp tôi ạ!',
                  ].filter(Boolean).join('\n')

                  const url = settings.chat_messenger_url || settings.facebook_url || 'https://m.me/nordichomevn'
                  navigator.clipboard.writeText(msg).then(() => {
                    setMessengerUrl(url)
                    setCopiedToast(true)
                  })
                }}
                className="w-full bg-[#0084FF] text-white font-bold py-4 rounded-lg text-sm hover:bg-[#0073e0] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white flex-shrink-0">
                  <path d="M12 2C6.477 2 2 6.145 2 11.259c0 2.913 1.453 5.512 3.728 7.214V22l3.405-1.869c.909.251 1.87.387 2.867.387 5.523 0 10-4.144 10-9.259C22 6.145 17.523 2 12 2Zm.991 12.467-2.548-2.718-4.973 2.718 5.471-5.806 2.61 2.718 4.91-2.718-5.47 5.806Z" />
                </svg>
                Nhắn tin Messenger để được tư vấn
              </button>

              {/* Toast hướng dẫn paste */}
              {copiedToast && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
                  <p className="font-bold mb-1">✅ Đã sao chép thông tin đơn hàng!</p>
                  <p className="text-green-700 mb-3">
                    Bấm mở Messenger bên dưới, sau đó nhấn{' '}
                    <kbd className="bg-green-100 border border-green-300 px-1.5 py-0.5 rounded font-mono text-xs">Ctrl+V</kbd>{' '}
                    để dán nội dung vào khung chat.
                  </p>
                  <a
                    href={messengerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-[#0084FF] text-white font-bold py-2.5 rounded-lg text-sm hover:bg-[#0073e0] transition"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                      <path d="M12 2C6.477 2 2 6.145 2 11.259c0 2.913 1.453 5.512 3.728 7.214V22l3.405-1.869c.909.251 1.87.387 2.867.387 5.523 0 10-4.144 10-9.259C22 6.145 17.523 2 12 2Zm.991 12.467-2.548-2.718-4.973 2.718 5.471-5.806 2.61 2.718 4.91-2.718-5.47 5.806Z" />
                    </svg>
                    Mở Messenger →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <button type="submit"
              disabled={submitting || loadingFee || shippingFee === null}
              className="w-full bg-stone-900 text-amber-100 font-bold py-4 rounded-lg text-sm hover:bg-stone-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {submitting  ? <><Loader2 size={16} className="animate-spin" /> Đang xử lý...</>
              : loadingFee ? <><Loader2 size={16} className="animate-spin" /> Đang tính phí ship...</>
              : shippingFee === null ? 'Chọn địa chỉ để tính phí ship'
                                     : '✅ Xác nhận đặt hàng'}
            </button>
          )}

        </form>
      </main>
    </>
  )
}
