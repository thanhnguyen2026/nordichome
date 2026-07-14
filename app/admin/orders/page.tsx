'use client'
import { useEffect, useState, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import { Order, OrderStatus, ORDER_STATUS_LABEL, PurchaseStatus, PURCHASE_STATUS_LABEL, SALES_CHANNEL_LABEL } from '@/types'
import { copyToClipboard } from '@/lib/clipboard'
import { stripDiacritics } from '@/lib/text'
import { ExternalLink, ShoppingCart, ChevronDown, ChevronUp, CheckCircle, MessageCircle, Printer } from 'lucide-react'
import ManualOrderForm from '@/components/admin/ManualOrderForm'
import ChannelIcon from '@/components/admin/ChannelIcon'
import { usePrompt } from '@/components/admin/usePrompt'
import { useToast } from '@/components/admin/useToast'

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
  product_id: string | null
  product_name: string
  product_image: string
  price: number
  quantity: number
  origin_url: string | null
  variant_id: string | null
  variant_label: string | null
  purchase_status: PurchaseStatus
  ordered_at: string | null
  arrived_at: string | null
  taobao_tracking_code: string | null
  // Link Taobao thật tra theo sản phẩm hiện tại — đơn từ website luôn có
  // origin_url rỗng ở trên (cột public cố tình giấu link nguồn với khách),
  // nên phải tra sống từ bảng products mới thấy link nếu admin đã nhập sau đó.
  product?: { origin_url: string | null } | null
}

// Link Taobao hiệu lực: ưu tiên tra sống từ sản phẩm (luôn mới nhất, và bù
// được cho đơn website vốn không lưu origin_url lúc tạo đơn); origin_url lưu
// sẵn trên order_items chỉ còn dùng khi sản phẩm gốc đã bị xoá.
const effectiveOriginUrl = (item: OrderItem) => item.product?.origin_url ?? item.origin_url

const PURCHASE_STATUS_COLOR: Record<PurchaseStatus, string> = {
  not_ordered: 'bg-stone-100 text-stone-500 border-stone-200',
  ordered:     'bg-blue-50 text-blue-700 border-blue-200',
  arrived:     'bg-green-50 text-green-700 border-green-200',
}

type PaymentFilter = 'all' | 'unpaid' | 'paid'

// Excel mở CSV UTF-8 không có BOM sẽ hiển thị sai dấu tiếng Việt — thêm BOM
// để chữ có dấu (tên khách, địa chỉ) hiện đúng khi mở bằng Excel trên Windows.
const CSV_BOM = '﻿'
// Excel đọc CSV theo dấu phân cách cột cấu hình ở vùng miền Windows, không phải
// luôn luôn là dấu phẩy — máy đặt vùng miền Việt Nam (dùng "," làm dấu thập
// phân) mặc định lấy ";" làm dấu phân cách, nên CSV dùng "," sẽ bị dồn hết vào 1 cột.
const CSV_DELIMITER = ';'

function csvCell(value: string | number): string {
  const s = String(value)
  return new RegExp(`["${CSV_DELIMITER}\n]`).test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = CSV_BOM + rows.map(row => row.map(csvCell).join(CSV_DELIMITER)).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminOrders() {
  const [orders, setOrders]         = useState<Order[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [items, setItems]           = useState<Record<string, OrderItem[]>>({})
  const [loadingItems, setLoadingItems] = useState<string | null>(null)
  // Ảnh sản phẩm trong chi tiết đơn có thể là link ngoài dán tay (VariantsManager
  // cho phép dán link ảnh trực tiếp, không giới hạn domain) — next/image sẽ lỗi
  // nếu domain không nằm trong remotePatterns, hoặc file đã bị xoá khỏi storage.
  // Theo dõi item nào lỗi ảnh để tự chuyển sang icon thay vì hiện ảnh vỡ/trống.
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set())
  const [payFilter, setPayFilter]   = useState<PaymentFilter>('all')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch]         = useState('')
  const [settings, setSettings]     = useState<Record<string, string>>({})
  const [copiedId, setCopiedId]     = useState<string | null>(null)
  const [showManualForm, setShowManualForm] = useState(false)
  const [creatingGhtkId, setCreatingGhtkId] = useState<string | null>(null)
  // Đơn nào được tick "tự mang ra bưu cục" — mặc định không tick = GHTK cử người đến lấy tại kho.
  const [dropOffIds, setDropOffIds] = useState<Set<string>>(new Set())
  const [syncingGhtkId, setSyncingGhtkId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const { promptValue, PromptDialog } = usePrompt()
  const { showToast, Toast } = useToast()

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
      const { data, error } = await supabase
        .from('order_items')
        .select('id, product_id, product_name, product_image, price, quantity, origin_url, variant_id, variant_label, purchase_status, ordered_at, arrived_at, taobao_tracking_code')
        .eq('order_id', id)
      if (error) console.error('Lỗi tải sản phẩm đơn hàng:', error)
      const rows = (data as unknown as OrderItem[]) || []

      // Tra sống link Taobao theo sản phẩm bằng query riêng (không join) — đơn
      // giản, tránh mọi rủi ro Postgrest không resolve được quan hệ embedded.
      const productIds = Array.from(new Set(rows.map(r => r.product_id).filter((v): v is string => !!v)))
      if (productIds.length > 0) {
        const { data: prods, error: prodErr } = await supabase.from('products').select('id, origin_url').in('id', productIds)
        if (prodErr) console.error('Lỗi tra link Taobao:', prodErr)
        const originMap = new Map((prods || []).map(p => [p.id, p.origin_url as string | null]))
        rows.forEach(r => { if (r.product_id) r.product = { origin_url: originMap.get(r.product_id) ?? null } })
      }

      setItems(prev => ({ ...prev, [id]: rows }))
      setLoadingItems(null)
    }
  }

  // Cộng lại đúng số lượng đã trừ — cho cả biến thể lẫn sản phẩm không biến
  // thể có theo dõi số lượng (products.stock khác null). Sản phẩm không biến
  // thể mà không nhập số lượng thì vẫn chỉ có cờ in_stock thủ công, bỏ qua.
  const restoreStock = async (orderId: string) => {
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_id, variant_id, quantity')
      .eq('order_id', orderId)

    const withVariant = (orderItems || []).filter((i): i is { product_id: string; variant_id: string; quantity: number } => Boolean(i.variant_id))
    for (const i of withVariant) {
      const { data: v } = await supabase.from('product_variants').select('stock').eq('id', i.variant_id).single()
      if (v) await supabase.from('product_variants').update({ stock: v.stock + i.quantity }).eq('id', i.variant_id)
    }

    const withoutVariant = (orderItems || []).filter(i => !i.variant_id)
    const neededByProduct: Record<string, number> = {}
    withoutVariant.forEach(i => { neededByProduct[i.product_id] = (neededByProduct[i.product_id] || 0) + i.quantity })
    for (const [productId, qty] of Object.entries(neededByProduct)) {
      const { data: p } = await supabase.from('products').select('stock').eq('id', productId).single()
      if (p?.stock != null) {
        const newStock = p.stock + qty
        await supabase.from('products').update({ stock: newStock, in_stock: newStock > 0 }).eq('id', productId)
      }
    }
  }

  const updateStatus = async (o: Order, status: OrderStatus) => {
    if (status === 'cancelled' && o.status !== 'cancelled') {
      const reason = await promptValue('Lý do hủy đơn (bắt buộc):')
      if (!reason?.trim()) return

      let refund_amount = 0
      if (o.payment_status === 'paid') {
        const input = await promptValue(`Đơn đã thanh toán ${fmt(o.total)} — số tiền hoàn lại cho khách:`, { defaultValue: String(o.total), type: 'number' })
        if (input === null) return
        refund_amount = Math.max(0, Math.round(Number(input) || 0))
      }

      if (!o.stock_restored) await restoreStock(o.id)

      await supabase.from('orders').update({
        status, cancel_reason: reason.trim(), refund_amount,
        stock_restored: true, updated_at: new Date().toISOString(),
      }).eq('id', o.id)

      setOrders(prev => prev.map(x => x.id === o.id
        ? { ...x, status, cancel_reason: reason.trim(), refund_amount, stock_restored: true }
        : x))

      // Hủy luôn vận đơn bên GHTK nếu có — không chặn việc hủy đơn nội bộ
      // nếu GHTK từ chối (vd: đơn đã bắt đầu giao thì GHTK không cho hủy).
      if (o.tracking_code) {
        const res = await fetch(`/api/admin/orders/${o.id}/ghtk-cancel`, { method: 'POST' })
        if (!res.ok) {
          const data = await res.json()
          showToast(`Đã hủy đơn, nhưng không hủy được vận đơn GHTK: ${data.error || 'lỗi không rõ'}`)
        }
      }
      return
    }

    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', o.id)
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status } : x))
  }

  const markPaid = async (o: Order) => {
    await supabase.from('orders').update({ payment_status: 'paid', updated_at: new Date().toISOString() }).eq('id', o.id)
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, payment_status: 'paid' as const } : x))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(prev =>
      prev.size === displayed.length ? new Set() : new Set(displayed.map(o => o.id))
    )
  }

  // Đổi trạng thái hàng loạt — không nhận 'cancelled' ở đây vì hủy đơn cần
  // nhập lý do + số tiền hoàn riêng cho từng đơn (xem updateStatus phía trên).
  const bulkUpdateStatus = async (status: Exclude<OrderStatus, 'cancelled'>) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkBusy(true)
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).in('id', ids)
    setOrders(prev => prev.map(x => ids.includes(x.id) ? { ...x, status } : x))
    setSelectedIds(new Set())
    setBulkBusy(false)
  }

  const bulkMarkPaid = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkBusy(true)
    await supabase.from('orders').update({ payment_status: 'paid', updated_at: new Date().toISOString() }).in('id', ids)
    setOrders(prev => prev.map(x => ids.includes(x.id) ? { ...x, payment_status: 'paid' as const } : x))
    setSelectedIds(new Set())
    setBulkBusy(false)
  }

  // Đổi trạng thái tự ghi luôn ngày tương ứng (đỡ phải tự gõ tay mỗi lần),
  // nhưng ngày vẫn sửa được riêng qua updatePurchaseDate bên dưới — cho
  // trường hợp cập nhật hệ thống trễ hơn ngày đặt/về hàng thực tế.
  const updatePurchaseStatus = async (orderId: string, itemId: string, status: PurchaseStatus) => {
    const now = new Date().toISOString()
    const patch: Partial<OrderItem> = { purchase_status: status }
    if (status === 'ordered') patch.ordered_at = now
    if (status === 'arrived') patch.arrived_at = now

    await supabase.from('order_items').update(patch).eq('id', itemId)
    setItems(prev => ({
      ...prev,
      [orderId]: (prev[orderId] || []).map(i => i.id === itemId ? { ...i, ...patch } : i),
    }))
  }

  const updatePurchaseDate = async (orderId: string, itemId: string, field: 'ordered_at' | 'arrived_at', dateStr: string) => {
    const value = dateStr ? new Date(dateStr).toISOString() : null
    await supabase.from('order_items').update({ [field]: value }).eq('id', itemId)
    setItems(prev => ({
      ...prev,
      [orderId]: (prev[orderId] || []).map(i => i.id === itemId ? { ...i, [field]: value } : i),
    }))
  }

  const updateTaobaoTrackingCode = async (orderId: string, itemId: string, code: string) => {
    const value = code.trim() || null
    await supabase.from('order_items').update({ taobao_tracking_code: value }).eq('id', itemId)
    setItems(prev => ({
      ...prev,
      [orderId]: (prev[orderId] || []).map(i => i.id === itemId ? { ...i, taobao_tracking_code: value } : i),
    }))
  }

  // <input type="date"> cần định dạng YYYY-MM-DD (giờ local, không phải UTC),
  // rút ra thẳng từ Date thay vì cắt chuỗi ISO (ISO là UTC nên cắt chuỗi có
  // thể lệch ngày với giờ Việt Nam).
  const toDateInputValue = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const saveTracking = async (id: string, code: string) => {
    await supabase.from('orders').update({ tracking_code: code || null }).eq('id', id)
    setOrders(prev => prev.map(x => x.id === id ? { ...x, tracking_code: code } : x))
  }

  // Gọi GHTK tạo đơn thật để lấy mã vận đơn tự động (thay vì admin tự tạo
  // đơn trên web GHTK rồi gõ tay mã vào ô tracking_code).
  const createGhtkOrder = async (o: Order) => {
    setCreatingGhtkId(o.id)
    try {
      const pickOption = dropOffIds.has(o.id) ? 'post' : 'cod'
      const res = await fetch(`/api/admin/orders/${o.id}/ghtk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickOption }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Không tạo được đơn GHTK')
        return
      }
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, tracking_code: data.trackingCode } : x))
    } catch {
      showToast('Lỗi kết nối, vui lòng thử lại')
    } finally {
      setCreatingGhtkId(null)
    }
  }

  // Mở nhãn PDF gốc do GHTK phát hành cho mã vận đơn — admin in thẳng từ đó.
  const printGhtkLabel = (o: Order) => {
    window.open(`/api/admin/orders/${o.id}/label`, '_blank')
  }

  const syncGhtkStatus = async (o: Order) => {
    setSyncingGhtkId(o.id)
    try {
      const res = await fetch(`/api/admin/orders/${o.id}/ghtk-status`)
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Không tra cứu được trạng thái')
        return
      }
      showToast(`Trạng thái GHTK: ${data.statusText || data.status || 'không rõ'}`, { variant: 'info' })
    } catch {
      showToast('Lỗi kết nối, vui lòng thử lại')
    } finally {
      setSyncingGhtkId(null)
    }
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
    orderItems.filter(i => effectiveOriginUrl(i)).length

  const q = stripDiacritics(search.trim())

  const displayed = orders.filter(o => {
    if (payFilter !== 'all') {
      const ps = o.payment_status
      if (payFilter === 'unpaid' && !(o.payment_method === 'bank' && ps !== 'paid')) return false
      if (payFilter === 'paid' && !(ps === 'paid' || o.payment_method === 'cod')) return false
    }
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (q) {
      const hit = stripDiacritics(o.order_code).includes(q)
        || stripDiacritics(o.customer_name).includes(q)
        || o.customer_phone.includes(q)
      if (!hit) return false
    }
    return true
  })

  const unpaidCount = orders.filter(o => o.payment_method === 'bank' && o.payment_status !== 'paid').length

  const exportCsv = () => {
    const header = ['Mã đơn', 'Kênh', 'Khách hàng', 'SĐT', 'Địa chỉ', 'Tổng tiền', 'Mã giảm giá', 'Đã giảm', 'Thanh toán', 'Đã TT?', 'Trạng thái', 'Lý do hủy', 'Đã hoàn', 'Ngày tạo']
    const rows = displayed.map(o => [
      o.order_code,
      SALES_CHANNEL_LABEL[o.channel] || o.channel,
      o.customer_name,
      o.customer_phone,
      o.customer_address,
      o.total,
      o.coupon_code || '',
      o.discount_amount || 0,
      o.payment_method === 'cod' ? 'COD' : 'Chuyển khoản',
      o.payment_method === 'cod' ? 'Thu khi giao' : (o.payment_status === 'paid' ? 'Đã nhận tiền' : 'Chờ CK'),
      ORDER_STATUS_LABEL[o.status],
      o.cancel_reason || '',
      o.refund_amount || 0,
      new Date(o.created_at).toLocaleString('vi-VN'),
    ])
    downloadCsv(`don-hang_${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
  }

  // File riêng cho theo dõi nhập hàng — mỗi dòng = 1 sản phẩm cần nhập (khác
  // CSV đơn hàng ở trên, mỗi dòng = 1 đơn), vì 1 đơn có thể gồm nhiều sản
  // phẩm với tiến độ nhập hàng khác nhau.
  const [exportingPurchase, setExportingPurchase] = useState(false)
  const exportPurchaseTrackingCsv = async () => {
    setExportingPurchase(true)
    // Không lọc origin_url ở DB nữa — đơn website luôn có order_items.origin_url
    // rỗng (cột public giấu link nguồn với khách), phải tra sống qua product mới
    // biết sản phẩm có link Taobao hay không, nên lọc ở JS sau khi có cả 2 nguồn.
    const { data, error } = await supabase
      .from('order_items')
      .select('product_id, product_name, variant_label, quantity, origin_url, purchase_status, ordered_at, arrived_at, taobao_tracking_code, order:orders(order_code, customer_name, created_at)')
    if (error) console.error('Lỗi xuất CSV theo dõi nhập hàng:', error)

    type Row = {
      product_id: string | null
      product_name: string; variant_label: string | null; quantity: number
      origin_url: string | null; purchase_status: PurchaseStatus
      ordered_at: string | null; arrived_at: string | null; taobao_tracking_code: string | null
      order: { order_code: string; customer_name: string; created_at: string } | null
      product?: { origin_url: string | null } | null
    }
    const allRows = (data as unknown as Row[]) || []

    // Tra sống link Taobao theo sản phẩm bằng query riêng (không join), cùng
    // cách với toggleExpand — tránh rủi ro Postgrest không resolve được quan hệ embedded.
    const productIds = Array.from(new Set(allRows.map(r => r.product_id).filter((v): v is string => !!v)))
    if (productIds.length > 0) {
      const { data: prods } = await supabase.from('products').select('id, origin_url').in('id', productIds)
      const originMap = new Map((prods || []).map(p => [p.id, p.origin_url as string | null]))
      allRows.forEach(r => { if (r.product_id) r.product = { origin_url: originMap.get(r.product_id) ?? null } })
    }
    setExportingPurchase(false)

    const effectiveUrl = (r: Row) => r.product?.origin_url ?? r.origin_url

    const rows = allRows
      .filter(effectiveUrl)
      .sort((a, b) => (b.order?.created_at || '').localeCompare(a.order?.created_at || ''))

    const header = ['Mã đơn', 'Khách hàng', 'Sản phẩm', 'Số lượng', 'Link Taobao', 'Trạng thái', 'Ngày đặt TQ', 'Ngày về kho', 'Mã vận chuyển TQ']
    const csvRows = rows.map(r => [
      r.order?.order_code || '',
      r.order?.customer_name || '',
      r.variant_label ? `${r.product_name} (${r.variant_label})` : r.product_name,
      r.quantity,
      effectiveUrl(r) || '',
      PURCHASE_STATUS_LABEL[r.purchase_status],
      r.ordered_at ? new Date(r.ordered_at).toLocaleDateString('vi-VN') : '',
      r.arrived_at ? new Date(r.arrived_at).toLocaleDateString('vi-VN') : '',
      r.taobao_tracking_code || '',
    ])
    downloadCsv(`theo-doi-nhap-hang_${new Date().toISOString().slice(0, 10)}.csv`, [header, ...csvRows])
  }

  return (
    <AdminLayout>
      {PromptDialog}
      {Toast}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black">🛒 Đơn hàng</h1>
          <p className="text-stone-400 text-sm mt-1">{orders.length} đơn hàng</p>
        </div>
        <div className="flex gap-2 flex-wrap items-start">
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
            <span key={k} className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${STATUS_COLOR[k as OrderStatus]}`}>
              {v}: {orders.filter(o => o.status === k).length}
            </span>
          ))}
          <button onClick={() => setShowManualForm(true)}
            className="bg-stone-900 text-amber-100 rounded-lg px-4 py-1.5 text-xs font-bold hover:bg-stone-800 transition">
            ➕ Thêm đơn thủ công
          </button>
        </div>
      </div>

      {showManualForm && (
        <ManualOrderForm
          onClose={() => setShowManualForm(false)}
          onCreated={() => { setShowManualForm(false); load() }}
        />
      )}

      {/* Tìm kiếm + lọc trạng thái + xuất CSV */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo tên, SĐT hoặc mã đơn..."
          className="flex-1 min-w-[220px] text-sm border border-stone-200 rounded-xl px-3.5 py-2 outline-none focus:border-stone-400"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as OrderStatus | 'all')}
          className="text-sm border border-stone-200 rounded-xl px-3 py-2 outline-none focus:border-stone-400 bg-white"
        >
          <option value="all">Mọi trạng thái</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button onClick={exportCsv} disabled={displayed.length === 0}
          className="text-sm font-semibold px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
          ⬇️ Xuất CSV ({displayed.length})
        </button>
        <button onClick={exportPurchaseTrackingCsv} disabled={exportingPurchase}
          className="text-sm font-semibold px-3.5 py-2 rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
          🛒 {exportingPurchase ? 'Đang xuất...' : 'Xuất CSV theo dõi nhập hàng'}
        </button>
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

      {/* Toolbar bulk actions — chỉ hiện khi có đơn được chọn */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 bg-stone-900 text-white rounded-xl px-4 py-2.5">
          <span className="text-xs font-semibold mr-1">Đã chọn {selectedIds.size} đơn</span>
          {(['confirmed', 'shipping', 'completed'] as const).map(s => (
            <button key={s} onClick={() => bulkUpdateStatus(s)} disabled={bulkBusy}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition disabled:opacity-40">
              → {ORDER_STATUS_LABEL[s]}
            </button>
          ))}
          <button onClick={bulkMarkPaid} disabled={bulkBusy}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 transition disabled:opacity-40">
            ✅ Đã nhận tiền
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10 transition ml-auto">
            Bỏ chọn
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-stone-400 text-sm">Đang tải...</div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-stone-400 text-sm">
            {orders.length === 0 ? 'Không có đơn nào.' : 'Không tìm thấy đơn nào khớp bộ lọc.'}
          </div>
        ) : (
          <>
          {/* "Chọn tất cả" chỉ hiện trên mobile — thead (chứa checkbox chọn tất cả
              của bảng desktop) bị ẩn hoàn toàn ở layout thẻ xếp dọc */}
          <label className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-stone-100 text-xs font-semibold text-stone-500 cursor-pointer">
            <input type="checkbox"
              checked={selectedIds.size > 0 && selectedIds.size === displayed.length}
              onChange={toggleSelectAll} />
            Chọn tất cả ({displayed.length})
          </label>
          <div className="overflow-x-auto bg-stone-100 md:bg-transparent px-1.5 py-2 md:p-0">
            <table className="w-full text-sm block md:table md:min-w-[900px]">
              <thead className="hidden md:table-header-group">
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="text-left py-3 px-4 w-8">
                    <input type="checkbox" aria-label="Chọn tất cả"
                      checked={selectedIds.size > 0 && selectedIds.size === displayed.length}
                      onChange={toggleSelectAll} />
                  </th>
                  {['Mã đơn', 'Khách hàng', 'SĐT', 'Tổng tiền', 'Thanh toán', 'Trạng thái', 'Ngày', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] uppercase text-stone-400 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {displayed.map(o => {
                  const payStatus = o.payment_status
                  const isBankUnpaid = o.payment_method === 'bank' && payStatus !== 'paid'
                  const isBankPaid   = o.payment_method === 'bank' && payStatus === 'paid'

                  return (
                    <Fragment key={o.id}>
                      <tr className={`block md:table-row mb-3 last:mb-0 md:mb-0 rounded-xl md:rounded-none bg-white md:bg-transparent shadow-sm md:shadow-none border md:border-0 md:border-t border-stone-200 md:border-t-stone-50 transition ${expanded === o.id ? 'bg-stone-50' : 'md:hover:bg-stone-50/50'} ${isBankUnpaid ? 'border-l-2 border-l-amber-400' : ''}`}>
                        <td className="flex items-center justify-between md:table-cell py-2.5 px-4 md:py-3 md:w-8">
                          <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Chọn</span>
                          <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleSelect(o.id)} />
                        </td>
                        <td className="flex items-center justify-between md:table-cell py-2.5 px-4 md:py-3">
                          <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Mã đơn</span>
                          <div className="text-right md:text-left">
                            <div className="font-mono text-xs font-bold text-stone-700">{o.order_code}</div>
                            {o.channel !== 'website' && (
                              <div className="flex items-center gap-1 text-[10px] bg-stone-100 text-stone-600 border border-stone-200 px-1.5 py-0.5 rounded-full font-semibold w-fit mt-1 ml-auto md:ml-0">
                                <ChannelIcon channel={o.channel} size={11} />
                                {SALES_CHANNEL_LABEL[o.channel] || o.channel}
                              </div>
                            )}
                            {o.coupon_code && (
                              <div className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-semibold w-fit mt-1 ml-auto md:ml-0">
                                🏷️ {o.coupon_code}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="flex items-center justify-between md:table-cell py-2.5 px-4 md:py-3 font-semibold">
                          <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Khách hàng</span>
                          {o.customer_name}
                        </td>
                        <td className="flex items-center justify-between md:table-cell py-2.5 px-4 md:py-3 text-stone-500">
                          <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">SĐT</span>
                          {o.customer_phone}
                        </td>
                        <td className="flex items-center justify-between md:table-cell py-2.5 px-4 md:py-3 font-bold text-amber-700 md:whitespace-nowrap">
                          <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Tổng tiền</span>
                          <div className="text-right md:text-left">
                            {fmt(o.total)}
                            {!!o.discount_amount && o.discount_amount > 0 && (
                              <div className="text-[10px] text-green-600 font-normal">-{fmt(o.discount_amount)}</div>
                            )}
                          </div>
                        </td>

                        {/* Thanh toán */}
                        <td className="flex items-center justify-between md:table-cell py-2.5 px-4 md:py-3">
                          <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Thanh toán</span>
                          <div className="flex flex-col items-end md:items-start gap-1.5">
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

                        <td className="flex items-center justify-between md:table-cell py-2.5 px-4 md:py-3">
                          <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Trạng thái</span>
                          <select
                            value={o.status}
                            onChange={e => updateStatus(o, e.target.value as OrderStatus)}
                            className={`text-xs px-2 py-1 rounded-full border font-semibold cursor-pointer outline-none ${STATUS_COLOR[o.status]}`}
                          >
                            {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </td>

                        <td className="flex items-center justify-between md:table-cell py-2.5 px-4 md:py-3 text-stone-400 text-xs md:whitespace-nowrap">
                          <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Ngày</span>
                          {new Date(o.created_at).toLocaleDateString('vi-VN')}
                        </td>

                        <td className="md:table-cell py-2.5 px-4 md:py-3">
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
                        <tr className="block md:table-row -mt-3 md:mt-0 mb-3 md:mb-0 rounded-b-xl md:rounded-none border md:border-0 md:border-t border-x border-b border-stone-200 md:border-t-stone-100 border-t-0 shadow-sm md:shadow-none">
                          <td colSpan={9} className="block md:table-cell px-4 py-5 bg-stone-50 md:bg-stone-50/80 rounded-b-xl md:rounded-none">
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
                                  {!o.tracking_code && (
                                    <label className="flex items-center gap-1.5 mt-2 text-xs text-stone-500 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={dropOffIds.has(o.id)}
                                        onChange={e => setDropOffIds(prev => {
                                          const next = new Set(prev)
                                          if (e.target.checked) next.add(o.id); else next.delete(o.id)
                                          return next
                                        })}
                                      />
                                      Tự mang ra bưu cục GHTK (bỏ trống = GHTK đến lấy tại kho)
                                    </label>
                                  )}
                                  <div className="flex gap-2 mt-2">
                                    {!o.tracking_code && (
                                      <button onClick={() => createGhtkOrder(o)}
                                        disabled={creatingGhtkId === o.id}
                                        className="text-xs bg-stone-900 hover:bg-stone-800 text-white rounded-lg px-2.5 py-1.5 flex items-center gap-1 transition disabled:opacity-50">
                                        {creatingGhtkId === o.id ? 'Đang tạo...' : '📦 Tạo đơn GHTK'}
                                      </button>
                                    )}
                                    {o.tracking_code && (
                                      <>
                                        <button onClick={() => printGhtkLabel(o)}
                                          className="text-xs bg-stone-100 hover:bg-stone-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1 transition">
                                          <Printer size={10} /> In nhãn
                                        </button>
                                        <button onClick={() => syncGhtkStatus(o)}
                                          disabled={syncingGhtkId === o.id}
                                          className="text-xs bg-stone-100 hover:bg-stone-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1 transition disabled:opacity-50">
                                          🔄 {syncingGhtkId === o.id ? 'Đang tra...' : 'Đồng bộ trạng thái'}
                                        </button>
                                      </>
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
                                {o.status === 'cancelled' && o.cancel_reason && (
                                  <div className="mt-2 text-xs bg-red-50 border border-red-200 rounded-lg p-2 space-y-1">
                                    <div className="text-red-700"><span className="font-semibold">Lý do hủy:</span> {o.cancel_reason}</div>
                                    {!!o.refund_amount && o.refund_amount > 0 && (
                                      <div className="text-red-700"><span className="font-semibold">Đã hoàn:</span> {fmt(o.refund_amount)}</div>
                                    )}
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
                                      <div key={item.id} className="bg-white rounded-xl p-3 border border-stone-100">
                                        <div className="flex items-center gap-3">
                                          <div className="relative w-12 h-12 bg-stone-100 rounded-lg overflow-hidden flex-shrink-0">
                                            {item.product_image && !brokenImageIds.has(item.id) ? (
                                              // Ảnh có thể là link ngoài dán tay, không giới hạn domain — dùng <img>
                                              // thường thay vì next/image để không bị chặn bởi remotePatterns.
                                              // eslint-disable-next-line @next/next/no-img-element
                                              <img
                                                src={item.product_image}
                                                alt={item.product_name}
                                                className="w-full h-full object-cover"
                                                onError={() => setBrokenImageIds(prev => new Set(prev).add(item.id))}
                                              />
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center text-xl">🛋️</div>
                                            )}
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
                                          {effectiveOriginUrl(item) ? (
                                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                              <a href={effectiveOriginUrl(item)!} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition whitespace-nowrap">
                                                <ShoppingCart size={12} /> Taobao <ExternalLink size={10} />
                                              </a>
                                              <select
                                                value={item.purchase_status}
                                                onChange={e => updatePurchaseStatus(o.id, item.id, e.target.value as PurchaseStatus)}
                                                className={`text-[11px] px-2 py-1 rounded-full border font-semibold cursor-pointer outline-none ${PURCHASE_STATUS_COLOR[item.purchase_status]}`}
                                              >
                                                {Object.entries(PURCHASE_STATUS_LABEL).map(([k, v]) => (
                                                  <option key={k} value={k}>{v}</option>
                                                ))}
                                              </select>
                                            </div>
                                          ) : (
                                            <span className="text-xs text-stone-300 flex-shrink-0 px-3">Không có link</span>
                                          )}
                                        </div>

                                        {/* Theo dõi nhập hàng — chỉ hiện khi đã bắt đầu đặt hàng TQ */}
                                        {effectiveOriginUrl(item) && item.purchase_status !== 'not_ordered' && (
                                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 pt-2.5 border-t border-stone-100 text-[11px] text-stone-500">
                                            <label className="flex items-center gap-1.5">
                                              Ngày đặt TQ:
                                              <input type="date" value={toDateInputValue(item.ordered_at)}
                                                onChange={e => updatePurchaseDate(o.id, item.id, 'ordered_at', e.target.value)}
                                                className="border border-stone-200 rounded px-1.5 py-0.5 outline-none focus:border-stone-400" />
                                            </label>
                                            {item.purchase_status === 'arrived' && (
                                              <label className="flex items-center gap-1.5">
                                                Ngày về kho:
                                                <input type="date" value={toDateInputValue(item.arrived_at)}
                                                  onChange={e => updatePurchaseDate(o.id, item.id, 'arrived_at', e.target.value)}
                                                  className="border border-stone-200 rounded px-1.5 py-0.5 outline-none focus:border-stone-400" />
                                              </label>
                                            )}
                                            <label className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                                              Mã vận chuyển TQ:
                                              <input type="text" defaultValue={item.taobao_tracking_code || ''}
                                                onBlur={e => updateTaobaoTrackingCode(o.id, item.id, e.target.value)}
                                                placeholder="Nhập mã vận đơn TQ"
                                                className="flex-1 border border-stone-200 rounded px-1.5 py-0.5 outline-none focus:border-stone-400 font-mono min-w-0" />
                                            </label>
                                          </div>
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
                                        {!!o.discount_amount && o.discount_amount > 0 && (
                                          <div className="text-xs font-semibold text-green-600 mb-0.5">
                                            🏷️ {o.coupon_code}: -{fmt(o.discount_amount)}
                                          </div>
                                        )}
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
          </>
        )}
      </div>
    </AdminLayout>
  )
}
