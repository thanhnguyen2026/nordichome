'use client'
import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCartStore, itemKey } from '@/store/cartStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { calcTotalWeight } from '@/lib/shipping'
import { Truck, AlertTriangle, Loader2, ClipboardList, User, CreditCard, Receipt, Tag, Smartphone, PartyPopper, FileCheck2, Copy } from 'lucide-react'
import { trackPurchase, generateEventId, getCookie } from '@/lib/analytics'
import { copyToClipboard } from '@/lib/clipboard'
import { hasCampaignFor } from '@/lib/campaignPrice'
import SearchableSelect from '@/components/store/SearchableSelect'
import type { Campaign } from '@/types'

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

interface AddrItem { code: number; name: string }

export default function CheckoutPage() {
  const { items, total, clearCart } = useCartStore()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [nowRef] = useState(() => new Date())
  // Sinh 1 lần khi vào trang, giữ nguyên qua các lần bấm lại nút đặt hàng —
  // chống tạo trùng đơn khi double-click hoặc mạng tự động retry request.
  const [idempotencyKey] = useState(() => crypto.randomUUID())

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
  const [formError,     setFormError]     = useState('')
  const [orderCode,     setOrderCode]     = useState('')
  const [paidTotal,     setPaidTotal]     = useState(0)
  const [paidMethod,    setPaidMethod]    = useState('')
  const [messengerUrl,  setMessengerUrl]  = useState('')
  const [copiedToast,   setCopiedToast]   = useState(false)
  const router = useRouter()
  const hasHydrated = useCartStore(s => s.hasHydrated)

  // Mã giảm giá
  const [couponInput,   setCouponInput]   = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_amount: number } | null>(null)
  const [couponError,   setCouponError]   = useState('')
  const [couponLoading, setCouponLoading] = useState(false)

  const { totalWeight, hasBulky } = calcTotalWeight(items)
  const discountAmount = appliedCoupon?.discount_amount ?? 0
  const grandTotal = total() - discountAmount + (shippingFee ?? 0)

  const applyCoupon = async () => {
    if (!couponInput.trim()) return
    setCouponLoading(true)
    setCouponError('')
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponInput.trim(),
          subtotal: total(),
          product_ids: items.map(i => i.product.id),
        }),
      })
      const data = await res.json()
      if (data.error) { setCouponError(data.error); setAppliedCoupon(null) }
      else setAppliedCoupon({ code: data.code, discount_amount: data.discount_amount })
    } catch {
      setCouponError('Lỗi kết nối, thử lại sau')
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError('')
  }

  // ── Load settings + khuyến mãi + tỉnh/thành ──────────────────────────────────
  useEffect(() => {
    supabase.from('settings').select('key,value').then(({ data }) => {
      setSettings(Object.fromEntries(data?.map(r => [r.key, r.value || '']) ?? []))
    })
    supabase.from('campaigns').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setCampaigns(data as unknown as Campaign[])
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
  // Pattern "fetch khi 1 giá trị đổi" — dự án không dùng thư viện fetch data
  // (SWR/React Query) nên đây vẫn là cách chuẩn hiện tại, không tái cấu trúc
  // logic địa chỉ/phí ship (rủi ro cao) chỉ để thoả rule lint mới.
  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  // Đơn tối thiểu để freeship — để trống/0 nghĩa là freeship mọi đơn (giữ hành vi cũ)
  const freeshipMinOrder = Number(settings.freeship_min_order) || 0
  const thresholdFreeship = settings.freeship_enabled === '1' && (freeshipMinOrder === 0 || total() >= freeshipMinOrder)
  // Toàn bộ giỏ hàng đều là sản phẩm free_shipping riêng — cộng dồn với
  // freeship theo ngưỡng đơn hàng ở trên, không thay thế.
  const allItemsFreeShip = items.length > 0 && items.every(i => i.product.free_shipping)
  const isFreeship = thresholdFreeship || allItemsFreeShip

  // Có sản phẩm nào trong giỏ đang được áp khuyến mãi không → ẩn ô nhập mã
  // giảm giá, không cộng dồn 2 loại giảm giá cùng lúc.
  const campaignActive = items.some(i => hasCampaignFor(i.product.id, campaigns, nowRef))

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

  /* eslint-disable react-hooks/set-state-in-effect */
  // Freeship bật → set fee = 0 ngay, không cần chọn địa chỉ
  useEffect(() => {
    if (isFreeship && !hasBulky) setShippingFee(0)
  }, [isFreeship, hasBulky])

  useEffect(() => {
    if (form.ward) fetchShipping(form.province, form.district, form.ward)
  }, [form.ward, form.province, form.district, fetchShipping])
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Submit đơn ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim() || !form.phone.trim()) {
      return setFormError('Vui lòng điền đầy đủ họ tên và số điện thoại!')
    }
    if (!form.province || !form.district || !form.ward || !form.streetAddress) {
      return setFormError('Vui lòng điền đầy đủ địa chỉ!')
    }
    if (!hasBulky && shippingFee === null) {
      return setFormError('Vui lòng chờ hệ thống tính phí vận chuyển!')
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
        customer_district: form.district,
        customer_ward:     form.ward,
        customer_note:    form.note,
        payment_method:   form.payment,
        shipping_fee:     shippingFee ?? 0,
        shipping_zone:    form.province,
        total_weight:     totalWeight,
        coupon_code:      appliedCoupon?.code ?? null,
        idempotency_key:  idempotencyKey,
        items: items.map(i => ({
          product_id:         i.product.id,
          product_name:       i.product.name,
          product_image:      i.product.cover_image,
          price:              i.product.sale_price ?? i.product.price,
          quantity:           i.quantity,
          cost_price:         i.product.cost_price ?? 0,
          origin_url:         i.product.origin_url ?? '',
          variant_id:         i.product.variant_id ?? null,
          variant_label:      i.product.variant_label ?? null,
          variant_image:      i.product.variant_image ?? null,
          variant_cost_price: i.product.variant_cost_price ?? null,
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
        variantLabel: i.product.variant_label ?? null,
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
      setFormError(data.error || 'Có lỗi xảy ra, vui lòng thử lại')
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
        <div className="flex justify-center mb-3">
          {isBank && hasBank
            ? <FileCheck2 size={44} className="text-stone-400" />
            : <PartyPopper size={44} className="text-amber-500" />}
        </div>
        <h1 className="text-2xl font-black mb-1">
          {isBank && hasBank ? 'Đơn hàng đã được ghi nhận' : 'Đặt hàng thành công!'}
        </h1>
        {isBank && hasBank && (
          <p className="text-stone-500 text-sm mb-3 max-w-xs mx-auto leading-relaxed">
            Đơn sẽ được xử lý sau khi chúng tôi nhận được thanh toán từ bạn
          </p>
        )}
        <p className="text-stone-500 text-sm mb-1">Mã đơn hàng của bạn:</p>
        <div className="text-xl font-black text-amber-700 font-mono mb-4">{orderCode}</div>

        {isBank && hasBank ? (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 text-left">
            <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-stone-800 mb-1">
              <CreditCard size={15} />Quét mã QR để thanh toán
            </p>
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
                <button onClick={() => copyToClipboard(settings.bank_account)}
                  className="flex items-center gap-1 font-mono font-bold hover:text-amber-700 transition" title="Bấm để sao chép">
                  {settings.bank_account} <Copy size={13} />
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
                <button onClick={() => copyToClipboard(orderCode)}
                  className="flex items-center gap-1 font-mono font-bold hover:text-amber-700 transition" title="Bấm để sao chép">
                  {orderCode} <Copy size={13} />
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
          <Link
            href={`/orders/${orderCode}?phone=${encodeURIComponent(form.phone)}`}
            className="bg-amber-500 text-white px-6 py-3 rounded-lg text-sm font-bold inline-block hover:bg-amber-600 transition text-center"
          >
            📦 Theo dõi đơn hàng
          </Link>
          <Link href="/" className="bg-stone-900 text-amber-100 px-6 py-3 rounded-lg text-sm font-bold inline-block hover:bg-stone-800 transition text-center">
            Về trang chủ
          </Link>
        </div>
      </main>
    )
  }

  // ── Form đặt hàng ───────────────────────────────────────────────────────────
  return (
    <>
      <header className="bg-white border-b border-stone-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            {settings.logo_url && (
              <Image src={settings.logo_url} alt="Logo" width={48} height={48} className="h-12 w-12 object-contain rounded-lg" />
            )}
            <div>
              <div className="text-base md:text-lg font-black text-stone-900 tracking-wide leading-tight">
                {settings.site_name || 'NORDIC HOME'}
              </div>
              <div className="font-serif italic font-semibold text-[10px] text-amber-700 tracking-[2px]">
                Simplify & Enjoy
              </div>
            </div>
          </Link>
          <Link href="/cart" className="text-sm font-semibold text-stone-600 hover:text-stone-900">← Giỏ hàng</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-black mb-6 flex items-center gap-2"><ClipboardList size={22} /> Thông tin đặt hàng</h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Thông tin khách hàng */}
          <div className="bg-white rounded-2xl border border-stone-100 p-6 space-y-4">
            <h2 className="font-bold text-sm text-stone-700 flex items-center gap-1.5"><User size={16} /> Thông tin nhận hàng</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Họ tên *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  autoComplete="name"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-stone-400" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Số điện thoại *</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  type="tel" inputMode="tel" autoComplete="tel"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-stone-400" required />
              </div>
            </div>

            {/* Địa chỉ 3 cấp */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Tỉnh / Thành phố */}
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Tỉnh / Thành phố *</label>
                <SearchableSelect
                  value={form.province}
                  onChange={name => setForm(f => ({ ...f, province: name, district: '', ward: '' }))}
                  options={provinces}
                  placeholder="-- Chọn tỉnh/TP --"
                  required
                />
              </div>

              {/* Quận / Huyện */}
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Quận / Huyện *</label>
                <SearchableSelect
                  value={form.district}
                  onChange={name => setForm(f => ({ ...f, district: name, ward: '' }))}
                  options={districts}
                  placeholder="-- Chọn quận/huyện --"
                  disabled={!form.province}
                  loading={addrLoading === 'districts'}
                  required
                />
              </div>

              {/* Phường / Xã */}
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Phường / Xã *</label>
                <SearchableSelect
                  value={form.ward}
                  onChange={name => setForm(f => ({ ...f, ward: name }))}
                  options={wards}
                  placeholder="-- Chọn phường/xã --"
                  disabled={!form.district}
                  loading={addrLoading === 'wards'}
                  required
                />
              </div>
            </div>

            {/* Số nhà, đường */}
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Số nhà, tên đường *</label>
              <input value={form.streetAddress}
                onChange={e => setForm(f => ({ ...f, streetAddress: e.target.value }))}
                placeholder="VD: 123 Nguyễn Văn A"
                autoComplete="address-line1"
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
                  {thresholdFreeship ? (settings.freeship_label || '🎉 Miễn phí vận chuyển') : '🎉 Miễn phí vận chuyển'}
                </div>
                <div className="text-xs text-green-600 mt-0.5">
                  {thresholdFreeship ? 'Áp dụng cho toàn bộ đơn hàng' : 'Sản phẩm trong giỏ hàng được miễn phí vận chuyển'}
                </div>
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
            <h2 className="font-bold text-sm text-stone-700 mb-3 flex items-center gap-1.5"><CreditCard size={16} /> Phương thức thanh toán</h2>
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
                <p className="font-bold text-amber-800 mb-2 flex items-center gap-1.5"><Smartphone size={16} /> Thông tin chuyển khoản</p>
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
            <h2 className="font-bold text-sm text-stone-700 mb-3 flex items-center gap-1.5"><Receipt size={16} /> Tóm tắt đơn hàng</h2>
            {items.map(item => {
              const variantLabel = item.product.variant_label
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
            {/* Mã giảm giá — ẩn khi sản phẩm trong giỏ đang có khuyến mãi, tránh cộng dồn 2 loại giảm giá */}
            {campaignActive ? (
              <div className="border-t border-stone-100 mt-3 pt-3">
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  🎉 Sản phẩm đang được áp khuyến mãi — không dùng thêm mã giảm giá được trong đợt này.
                </p>
              </div>
            ) : (
            <div className="border-t border-stone-100 mt-3 pt-3">
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                  <span className="text-green-700 font-semibold flex items-center gap-1.5"><Tag size={14} /> {appliedCoupon.code} đã áp dụng</span>
                  <button type="button" onClick={removeCoupon} className="text-green-700 hover:text-green-900 text-xs underline">Gỡ mã</button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={e => { setCouponInput(e.target.value); setCouponError('') }}
                      placeholder="Mã giảm giá (nếu có)"
                      className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
                    />
                    <button type="button" onClick={applyCoupon} disabled={couponLoading || !couponInput.trim()}
                      className="text-sm font-semibold px-4 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                      {couponLoading ? 'Đang kiểm tra...' : 'Áp dụng'}
                    </button>
                  </div>
                  {couponError && <p className="text-xs text-red-500 mt-1.5">{couponError}</p>}
                </div>
              )}
            </div>
            )}

            <div className="border-t border-stone-100 mt-3 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Tiền hàng</span>
                <span>{fmt(total())}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Giảm giá</span>
                  <span className="text-green-600 font-semibold">-{fmt(discountAmount)}</span>
                </div>
              )}
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
                    const variant = i.product.variant_label ? ` (${i.product.variant_label})` : ''
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
                  copyToClipboard(msg).then(() => {
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
            <div className="space-y-2">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 flex items-start gap-2">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
              <button type="submit"
                disabled={submitting || loadingFee || shippingFee === null}
                className="w-full bg-stone-900 text-amber-100 font-bold py-4 rounded-lg text-sm hover:bg-stone-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {submitting  ? <><Loader2 size={16} className="animate-spin" /> Đang xử lý...</>
                : loadingFee ? <><Loader2 size={16} className="animate-spin" /> Đang tính phí ship...</>
                : shippingFee === null ? 'Chọn địa chỉ để tính phí ship'
                                       : '✅ Xác nhận đặt hàng'}
              </button>
            </div>
          )}

        </form>
      </main>
    </>
  )
}
