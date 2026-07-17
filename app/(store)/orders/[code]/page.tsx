import { supabaseAdmin } from '@/lib/supabaseAdmin'
const supabase = supabaseAdmin
import { headers } from 'next/headers'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, Circle, XCircle, Package, MapPin, Phone, CreditCard, ExternalLink, SearchX, ImageOff, Clock } from 'lucide-react'
import { getClientIp, rateLimit } from '@/lib/rateLimit'
import type { Order } from '@/types'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

const TIMELINE = [
  { statuses: ['pending'],              label: 'Đã tiếp nhận',      desc: 'Đơn hàng đã được ghi nhận'              },
  { statuses: ['confirmed'],            label: 'Đang xử lý',        desc: 'Đang chuẩn bị / đặt hàng nhà cung cấp' },
  { statuses: ['shipping'],             label: 'Đang giao hàng',    desc: 'Hàng đang trên đường đến bạn'           },
  { statuses: ['completed'],            label: 'Giao thành công',   desc: 'Bạn đã nhận được hàng'                  },
]

function getStageIndex(status: string): number {
  return TIMELINE.findIndex(s => s.statuses.includes(status))
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ code: string }>
  searchParams: Promise<{ phone?: string }>
}) {
  const { code }  = await params
  const { phone } = await searchParams

  // Mã đơn + SĐT là 2 yếu tố xác thực duy nhất cho trang này — giới hạn tần
  // suất để chặn dò brute-force cặp (mã đơn ngẫu nhiên, SĐT) hàng loạt.
  const ip = getClientIp(await headers())
  if (!rateLimit(`order-lookup:${ip}`, 20, 60_000)) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-stone-500 mb-4">Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.</p>
          <Link href="/orders/track" className="text-sm font-bold underline">← Tra cứu lại</Link>
        </div>
      </main>
    )
  }

  if (!phone) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-stone-500 mb-4">Vui lòng nhập số điện thoại để xem đơn hàng.</p>
          <Link href="/orders/track" className="text-sm font-bold underline">← Tra cứu lại</Link>
        </div>
      </main>
    )
  }

  // Fetch order + items song song
  const [{ data: orderRaw }, { data: settings }] = await Promise.all([
    supabase.from('orders')
      .select('*')
      .eq('order_code', code.toUpperCase())
      .single(),
    supabase.from('settings').select('key,value'),
  ])
  const order = orderRaw as unknown as Order | null

  // Verify: order tồn tại + số điện thoại khớp
  if (!order || order.customer_phone !== phone.trim()) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <SearchX size={44} className="text-stone-300 mx-auto mb-4" />
          <h1 className="text-xl font-black text-stone-900 mb-2">Không tìm thấy đơn hàng</h1>
          <p className="text-stone-400 text-sm mb-6">
            Mã đơn hoặc số điện thoại không đúng. Vui lòng kiểm tra lại.
          </p>
          <Link href="/orders/track"
            className="bg-stone-900 text-amber-100 px-6 py-3 rounded-xl text-sm font-bold inline-block hover:bg-stone-800 transition">
            ← Tra cứu lại
          </Link>
        </div>
      </main>
    )
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('id, product_name, product_image, price, quantity, variant_label')
    .eq('order_id', order.id)

  const s = Object.fromEntries(settings?.map(r => [r.key, r.value]) ?? [])
  const isCancelled = order.status === 'cancelled'
  const currentStage = getStageIndex(order.status)

  const paymentLabel = order.payment_method === 'cod' ? 'COD — Thu tiền khi giao' : 'Chuyển khoản ngân hàng'
  const paymentPaid  = order.payment_status === 'paid' || order.payment_method === 'cod'

  return (
    <main className="min-h-screen bg-stone-50 pb-16">
      {/* Header tối giản */}
      <header className="bg-white border-b border-stone-100">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {s.logo_url && (
              <Image src={s.logo_url} alt="Logo" width={36} height={36} className="h-9 w-9 object-contain rounded-lg" />
            )}
            <div>
              <div className="text-base font-black text-stone-900 leading-tight">{s.site_name || 'NORDIC HOME'}</div>
              <div className="font-serif italic font-semibold text-[9px] text-amber-700 tracking-[2px]">
                Simplify & Enjoy
              </div>
            </div>
          </Link>
          <Link href="/orders/track" className="text-xs text-stone-400 hover:text-stone-700 transition">
            ← Tra cứu đơn khác
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Mã đơn + trạng thái */}
        <div className="bg-white rounded-2xl border border-stone-100 p-6">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <p className="text-xs text-stone-400 mb-0.5">Mã đơn hàng</p>
              <h1 className="text-xl font-black font-mono tracking-wider text-stone-900">{order.order_code}</h1>
            </div>
            {isCancelled ? (
              <span className="flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full border border-red-100">
                <XCircle size={13} /> Đã huỷ
              </span>
            ) : order.status === 'completed' ? (
              <span className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full border border-green-100">
                <CheckCircle2 size={13} /> Hoàn thành
              </span>
            ) : (
              <span className="bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-100">
                Đang xử lý
              </span>
            )}
          </div>
          <p className="text-xs text-stone-400">
            Đặt ngày {new Date(order.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </div>

        {/* Timeline */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl border border-stone-100 p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-6">Hành trình đơn hàng</p>

            {/* Desktop: ngang / Mobile: dọc */}
            <div className="hidden sm:flex items-start justify-between relative">
              {/* Line nền */}
              <div className="absolute top-4 left-0 right-0 h-0.5 bg-stone-100 z-0" />
              {/* Line đã hoàn thành */}
              <div
                className="absolute top-4 left-0 h-0.5 bg-stone-900 z-0 transition-all duration-500"
                style={{ width: currentStage >= 0 ? `${(currentStage / (TIMELINE.length - 1)) * 100}%` : '0%' }}
              />
              {TIMELINE.map((stage, i) => {
                const done    = i < currentStage
                const current = i === currentStage
                return (
                  <div key={i} className="relative z-10 flex flex-col items-center text-center w-1/4 px-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-colors ${
                      done    ? 'bg-stone-900 text-white'
                      : current ? 'bg-amber-500 text-white ring-4 ring-amber-100'
                      : 'bg-stone-100 text-stone-300'
                    }`}>
                      {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </div>
                    <p className={`text-xs font-bold leading-tight ${current ? 'text-amber-700' : done ? 'text-stone-700' : 'text-stone-300'}`}>
                      {stage.label}
                    </p>
                    {current && (
                      <p className="text-[10px] text-stone-400 mt-0.5 leading-snug">{stage.desc}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Mobile: dọc */}
            <div className="sm:hidden space-y-0">
              {TIMELINE.map((stage, i) => {
                const done    = i < currentStage
                const current = i === currentStage
                const last    = i === TIMELINE.length - 1
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        done    ? 'bg-stone-900 text-white'
                        : current ? 'bg-amber-500 text-white'
                        : 'bg-stone-100 text-stone-300'
                      }`}>
                        {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                      </div>
                      {!last && <div className={`w-0.5 flex-1 my-1 ${done || current ? 'bg-stone-300' : 'bg-stone-100'}`} style={{ minHeight: 20 }} />}
                    </div>
                    <div className={`pb-4 ${last ? '' : ''}`}>
                      <p className={`text-sm font-bold ${current ? 'text-amber-700' : done ? 'text-stone-700' : 'text-stone-300'}`}>
                        {stage.label}
                      </p>
                      {current && <p className="text-xs text-stone-400 mt-0.5">{stage.desc}</p>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Tracking GHTK nếu có */}
            {order.tracking_code && (
              <div className="mt-5 pt-4 border-t border-stone-100">
                <p className="text-xs text-stone-500 mb-2">Mã vận đơn GHTK:</p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-stone-800">{order.tracking_code}</span>
                  <a
                    href={`https://i.ghtk.vn/${order.tracking_code}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    Xem trên GHTK <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sản phẩm */}
        <div className="bg-white rounded-2xl border border-stone-100 p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-4">
            <Package size={12} className="inline mr-1" />Sản phẩm đặt mua
          </p>
          <div className="space-y-3">
            {(items || []).map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="relative w-14 h-14 bg-stone-100 rounded-xl overflow-hidden flex-shrink-0">
                  {item.product_image
                    ? <Image src={item.product_image} fill sizes="56px" className="object-cover" alt={item.product_name} />
                    : <div className="w-full h-full flex items-center justify-center"><ImageOff size={20} className="text-stone-300" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800 truncate">{item.product_name}</p>
                  {item.variant_label && (
                    <p className="text-[11px] text-stone-400 mt-0.5">{item.variant_label}</p>
                  )}
                  <p className="text-xs text-stone-500 mt-0.5">{fmt(item.price)} × {item.quantity}</p>
                </div>
                <p className="text-sm font-bold text-stone-800 flex-shrink-0">{fmt(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>

          {/* Tổng */}
          <div className="border-t border-stone-100 mt-4 pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-stone-500">
              <span>Tiền hàng</span>
              <span>{fmt(order.subtotal || order.total)}</span>
            </div>
            {!!order.shipping_fee && order.shipping_fee > 0 && (
              <div className="flex justify-between text-stone-500">
                <span>Phí vận chuyển</span>
                <span>{fmt(order.shipping_fee)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-base border-t border-stone-100 pt-2 mt-2">
              <span>Tổng cộng</span>
              <span className="text-amber-700">{fmt(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Thông tin giao hàng + thanh toán */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-stone-100 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">
              <MapPin size={12} className="inline mr-1" />Địa chỉ giao hàng
            </p>
            <p className="text-sm text-stone-700 leading-relaxed">{order.customer_address}</p>
            <p className="text-sm text-stone-500 mt-2 flex items-center gap-1.5">
              <Phone size={12} /> {order.customer_phone}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-100 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">
              <CreditCard size={12} className="inline mr-1" />Thanh toán
            </p>
            <p className="text-sm text-stone-700">{paymentLabel}</p>
            <div className="mt-2">
              {paymentPaid ? (
                <span className="flex items-center gap-1 w-fit text-xs bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full font-semibold">
                  <CheckCircle2 size={11} /> Đã thanh toán
                </span>
              ) : (
                <span className="flex items-center gap-1 w-fit text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-full font-semibold">
                  <Clock size={11} /> Chờ thanh toán
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cần hỗ trợ */}
        {s.chat_messenger_url || s.chat_zalo_url ? (
          <div className="bg-stone-50 rounded-2xl border border-stone-100 p-5 text-center">
            <p className="text-sm text-stone-500 mb-3">Cần hỗ trợ về đơn hàng?</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {s.chat_messenger_url && (
                <a href={s.chat_messenger_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-[#006AFF] text-white text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 transition">
                  <svg viewBox="0 0 32 32" className="w-3.5 h-3.5 fill-current">
                    <path d="M16 3C8.82 3 3 8.475 3 15.167c0 3.885 1.937 7.348 4.97 9.617V29l4.54-2.492a13.87 13.87 0 0 0 3.49.442c7.18 0 13-5.475 13-12.167C29 8.475 23.18 3 16 3Zm1.32 16.62-3.39-3.62-6.63 3.62 7.29-7.74 3.47 3.62 6.55-3.62-7.29 7.74Z"/>
                  </svg>
                  Messenger
                </a>
              )}
              {s.chat_zalo_url && (
                <a href={s.chat_zalo_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-[#0068FF] text-white text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 transition">
                  <svg viewBox="0 0 32 32" className="w-3.5 h-3.5 fill-current">
                    <path d="M16 2C8.268 2 2 8.268 2 16c0 2.52.7 4.88 1.918 6.89L2 30l7.274-1.892A13.93 13.93 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2Zm-4 9h8a.75.75 0 0 1 0 1.5h-2.5v5h2.5a.75.75 0 0 1 0 1.5H12a.75.75 0 0 1 0-1.5h2.5v-5H12A.75.75 0 0 1 12 11Z"/>
                  </svg>
                  Zalo
                </a>
              )}
            </div>
          </div>
        ) : null}

      </div>
    </main>
  )
}
