'use client'
import { useEffect, useState, Fragment } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import { Order, OrderStatus, ORDER_STATUS_LABEL } from '@/types'
import { copyToClipboard } from '@/lib/clipboard'
import { ExternalLink, ShoppingCart, ChevronDown, ChevronUp, CheckCircle, MessageCircle } from 'lucide-react'

const fmt = (n: number) => Number(n).toLocaleString('vi-VN') + '₫'

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  shipping:  'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

interface OrderItem {
  id: string
  product_name: string
  product_image: string
  price: number
  quantity: number
  origin_url: string | null
  variant_label: string | null
}

type PaymentFilter = 'all' | 'unpaid' | 'paid'

export default function AdminOrders() {
  const [orders, setOrders]         = useState<Order[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [items, setItems]           = useState<Record<string, OrderItem[]>>({})
  const [loadingItems, setLoadingItems] = useState<string | null>(null)
  const [payFilter, setPayFilter]   = useState<PaymentFilter>('all')
  const [settings, setSettings]     = useState<Record<string, string>>({})
  const [copiedId, setCopiedId]     = useState<string | null>(null)

  const load = async () => {
    const [{ data: ordersData }, { data: settingsData }] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('key,value'),
    ])
    setOrders((ordersData as unknown as Order[]) || [])
    setSettings(Object.fromEntries(settingsData?.map(r => [r.key, r.value || '']) ?? []))
    setLoading(false)
  }

  // Tải dữ liệu lúc mount — dự án không dùng thư viện fetch data, đây là cách chuẩn hiện tại
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!items[id]) {
      setLoadingItems(id)
      const { data } = await supabase
        .from('order_items')
        .select('id, product_name, product_image, price, quantity, origin_url, variant_label')
        .eq('order_id', id)
      setItems(prev => ({ ...prev, [id]: (data as unknown as OrderItem[]) || [] }))
      setLoadingItems(null)
    }
  }

  const updateStatus = async (id: string, status: OrderStatus) => {
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  const markPaid = async (o: Order) => {
    await supabase.from('orders').update({ payment_status: 'paid', updated_at: new Date().toISOString() }).eq('id', o.id)
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, payment_status: 'paid' as const } : x))
  }

  const saveTracking = async (id: string, code: string) => {
    await supabase.from('orders').update({ tracking_code: code || null }).eq('id', id)
    setOrders(prev => prev.map(x => x.id === id ? { ...x, tracking_code: code } : x))
  }

  const remindCustomer = (o: Order) => {
    const bank = settings.bank_id && settings.bank_account
      ? `\n🏦 Chuyển khoản:\n  Ngân hàng: ${settings.bank_id}\n  Số TK: ${settings.bank_account}\n  Chủ TK: ${settings.bank_holder || ''}\n  Số tiền: ${fmt(o.total)}\n  Nội dung: ${o.order_code}`
      : ''
    const msg = `Xin chào ${o.customer_name}! 👋\n\nĐơn hàng ${o.order_code} (${fmt(o.total)}) của bạn đã được xác nhận.${bank}\n\nVui lòng thanh toán để chúng tôi xử lý đơn sớm nhất nhé! Cảm ơn bạn 🙏`

    copyToClipboard(msg).then(() => {
      setCopiedId(o.id)
      setTimeout(() => setCopiedId(null), 3000)
      const url = settings.chat_messenger_url || settings.facebook_url || ''
      if (url) window.open(url, '_blank')
    })
  }

  const countTaobaoLinks = (orderItems: OrderItem[]) =>
    orderItems.filter(i => i.origin_url).length

  const displayed = orders.filter(o => {
    if (payFilter === 'all') return true
    const ps = o.payment_status
    if (payFilter === 'unpaid') return o.payment_method === 'bank' && ps !== 'paid'
    if (payFilter === 'paid')   return ps === 'paid' || o.payment_method === 'cod'
    return true
  })

  const unpaidCount = orders.filter(o => o.payment_method === 'bank' && o.payment_status !== 'paid').length

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black">🛒 Đơn hàng</h1>
          <p className="text-stone-400 text-sm mt-1">{orders.length} đơn hàng</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
            <span key={k} className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${STATUS_COLOR[k as OrderStatus]}`}>
              {v}: {orders.filter(o => o.status === k).length}
            </span>
          ))}
        </div>
      </div>

      {/* Filter thanh toán */}
      <div className="flex gap-2 mb-4">
        {([
          { key: 'all',    label: 'Tất cả đơn' },
          { key: 'unpaid', label: `⏳ Chờ thanh toán${unpaidCount > 0 ? ` (${unpaidCount})` : ''}` },
          { key: 'paid',   label: '✅ Đã thanh toán' },
        ] as { key: PaymentFilter; label: string }[]).map(f => (
          <button key={f.key} onClick={() => setPayFilter(f.key)}
            className={`text-xs px-3 py-2 rounded-xl font-semibold transition ${
              payFilter === f.key
                ? f.key === 'unpaid' ? 'bg-amber-500 text-white' : 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-stone-400 text-sm">Đang tải...</div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-stone-400 text-sm">Không có đơn nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  {['Mã đơn', 'Khách hàng', 'SĐT', 'Tổng tiền', 'Thanh toán', 'Trạng thái', 'Ngày', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] uppercase text-stone-400 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(o => {
                  const payStatus = o.payment_status
                  const isBankUnpaid = o.payment_method === 'bank' && payStatus !== 'paid'
                  const isBankPaid   = o.payment_method === 'bank' && payStatus === 'paid'

                  return (
                    <Fragment key={o.id}>
                      <tr className={`border-t border-stone-50 transition ${expanded === o.id ? 'bg-stone-50' : 'hover:bg-stone-50/50'} ${isBankUnpaid ? 'border-l-2 border-l-amber-400' : ''}`}>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-stone-700">{o.order_code}</td>
                        <td className="py-3 px-4 font-semibold">{o.customer_name}</td>
                        <td className="py-3 px-4 text-stone-500">{o.customer_phone}</td>
                        <td className="py-3 px-4 font-bold text-amber-700 whitespace-nowrap">{fmt(o.total)}</td>

                        {/* Thanh toán */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1.5">
                            {/* Badge phương thức */}
                            <span className="text-xs text-stone-500">
                              {o.payment_method === 'cod' ? '💵 COD' : '🏦 CK'}
                            </span>
                            {/* Badge trạng thái thanh toán */}
                            {o.payment_method === 'cod' && (
                              <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-semibold w-fit">
                                Thu khi giao
                              </span>
                            )}
                            {isBankPaid && (
                              <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-semibold w-fit">
                                ✓ Đã nhận tiền
                              </span>
                            )}
                            {isBankUnpaid && (
                              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold w-fit animate-pulse">
                                ⏳ Chờ CK
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <select
                            value={o.status}
                            onChange={e => updateStatus(o.id, e.target.value as OrderStatus)}
                            className={`text-xs px-2 py-1 rounded-full border font-semibold cursor-pointer outline-none ${STATUS_COLOR[o.status]}`}
                          >
                            {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3 px-4 text-stone-400 text-xs whitespace-nowrap">
                          {new Date(o.created_at).toLocaleDateString('vi-VN')}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 justify-end flex-wrap">
                            {/* Nút nhắc khách */}
                            {isBankUnpaid && (
                              <>
                                <button onClick={() => remindCustomer(o)}
                                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${
                                    copiedId === o.id
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                  }`}>
                                  <MessageCircle size={11} />
                                  {copiedId === o.id ? 'Đã copy!' : 'Nhắc khách'}
                                </button>
                                <button onClick={() => markPaid(o)}
                                  className="flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1.5 rounded-lg transition whitespace-nowrap">
                                  <CheckCircle size={11} />
                                  Đã nhận tiền
                                </button>
                              </>
                            )}
                            <button onClick={() => toggleExpand(o.id)}
                              className="flex items-center gap-1 text-xs bg-stone-100 hover:bg-stone-200 rounded-lg px-2.5 py-1.5 transition">
                              Chi tiết {expanded === o.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expanded === o.id && (
                        <tr className="border-t border-stone-100">
                          <td colSpan={8} className="px-4 py-5 bg-stone-50/80">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div>
                                <div className="font-semibold text-xs uppercase tracking-wide text-stone-400 mb-2">📍 Giao hàng</div>
                                <div className="text-sm text-stone-600 leading-relaxed mb-3">{o.customer_address}</div>
                                {/* Mã vận đơn GHTK */}
                                <div>
                                  <label className="text-[10px] font-semibold text-stone-400 block mb-1">Mã vận đơn GHTK</label>
                                  <div className="flex gap-2">
                                    <input
                                      defaultValue={o.tracking_code || ''}
                                      onBlur={e => saveTracking(o.id, e.target.value.trim())}
                                      placeholder="Nhập mã sau khi tạo đơn GHTK"
                                      className="flex-1 text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-stone-400 font-mono"
                                    />
                                    {o.tracking_code && (
                                      <a href={`https://i.ghtk.vn/${o.tracking_code}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="text-xs bg-stone-100 hover:bg-stone-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1 transition">
                                        Xem <ExternalLink size={10} />
                                      </a>
                                    )}
                                  </div>
                                </div>
                                {!!o.total_weight && o.total_weight > 0 && (
                                  <div className="text-xs text-stone-400 mt-1">
                                    ⚖️ {o.total_weight}kg
                                    {o.shipping_zone && ` · ${({ inner: 'Nội tỉnh', south: 'Nội miền Nam', inter: 'Liên miền' } as Record<string, string>)[o.shipping_zone] || ''}`}
                                  </div>
                                )}
                                {o.customer_note && (
                                  <div className="mt-2 text-xs text-stone-500 bg-white rounded-lg p-2 border border-stone-100">
                                    📝 {o.customer_note}
                                  </div>
                                )}
                              </div>

                              <div className="md:col-span-2">
                                <div className="font-semibold text-xs uppercase tracking-wide text-stone-400 mb-2">📦 Sản phẩm</div>
                                {loadingItems === o.id ? (
                                  <div className="text-xs text-stone-400">Đang tải...</div>
                                ) : (
                                  <div className="space-y-2">
                                    {(items[o.id] || []).map(item => (
                                      <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-stone-100">
                                        <div className="relative w-12 h-12 bg-stone-100 rounded-lg overflow-hidden flex-shrink-0">
                                          {item.product_image
                                            ? <Image src={item.product_image} alt={item.product_name} fill sizes="48px" className="object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center text-xl">🛋️</div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-semibold text-sm truncate">{item.product_name}</div>
                                          {item.variant_label && (
                                            <div className="text-[11px] text-stone-400 mt-0.5 bg-stone-50 rounded px-1.5 py-0.5 inline-block">
                                              {item.variant_label}
                                            </div>
                                          )}
                                          <div className="text-xs text-stone-400 mt-0.5">
                                            {fmt(item.price)} × {item.quantity} =
                                            <span className="font-bold text-stone-700 ml-1">{fmt(item.price * item.quantity)}</span>
                                          </div>
                                        </div>
                                        {item.origin_url ? (
                                          <a href={item.origin_url} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition whitespace-nowrap flex-shrink-0">
                                            <ShoppingCart size={12} /> Taobao <ExternalLink size={10} />
                                          </a>
                                        ) : (
                                          <span className="text-xs text-stone-300 flex-shrink-0 px-3">Không có link</span>
                                        )}
                                      </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-2 border-t border-stone-100">
                                      <div>
                                        {countTaobaoLinks(items[o.id] || []) > 0 && (
                                          <span className="bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                                            🛒 {countTaobaoLinks(items[o.id] || [])} link Taobao
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-sm font-black text-stone-800">
                                        Tổng: <span className="text-amber-700">{fmt(o.total)}</span>
                                        {!!o.shipping_fee && o.shipping_fee > 0 && (
                                          <span className="text-xs text-stone-400 font-normal ml-1">
                                            (gồm ship {fmt(o.shipping_fee)})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
