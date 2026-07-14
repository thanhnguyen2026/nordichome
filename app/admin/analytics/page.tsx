'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import { TrendingUp, ShoppingBag, Package, BarChart2, ArrowUp, ArrowDown, Trophy } from 'lucide-react'
import { SALES_CHANNEL_LABEL, SalesChannel } from '@/types'

const fmt  = (n: number) => n.toLocaleString('vi-VN') + '₫'
const fmtK = (n: number) => n >= 1_000_000
  ? (n / 1_000_000).toFixed(1) + 'tr'
  : n >= 1_000 ? Math.round(n / 1000) + 'k' : String(n)

type Range = 'today' | '7d' | '30d' | 'all'

interface OrderRow {
  id: string; order_code: string; customer_name: string
  created_at: string; revenue: number; cost: number
  profit: number; shipping_fee: number; status: string; channel: string
}

interface OrderItemRow {
  product_name: string
  quantity: number
  price: number
  order: { created_at: string; status: string } | null
}

function getRangeStart(r: Range): Date | null {
  const d = new Date()
  if (r === 'today') { d.setHours(0, 0, 0, 0); return d }
  if (r === '7d')  { d.setDate(d.getDate() - 7); return d }
  if (r === '30d') { d.setDate(d.getDate() - 30); return d }
  return null
}

// ── SVG Bar Chart với tooltip ────────────────────────────────────────────────
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null)
  const max  = Math.max(...data.map(d => d.value), 1)
  const W    = 600; const H = 140
  const BAR_W = Math.max(8, (W - 40) / data.length - 4)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full" style={{ height: 170 }}
        onMouseLeave={() => setTooltip(null)}>
        {/* Y gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={0} y1={H - H * t} x2={W} y2={H - H * t}
            stroke="#f1ece8" strokeWidth={1} />
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const barH = Math.max(2, (d.value / max) * H)
          const x    = 20 + i * ((W - 40) / data.length) + ((W - 40) / data.length - BAR_W) / 2
          const cx   = x + BAR_W / 2
          return (
            <g key={d.label}
              onMouseEnter={() => setTooltip({ x: cx, y: H - barH, label: d.label, value: d.value })}
              style={{ cursor: 'pointer' }}>
              <rect x={x} y={H - barH} width={BAR_W} height={barH}
                rx={3} fill={tooltip?.label === d.label ? '#57534e' : (d.value > 0 ? '#78716c' : '#e7e5e4')} />
              {/* Hover zone rộng hơn cho dễ hover */}
              <rect x={x - 4} y={0} width={BAR_W + 8} height={H} fill="transparent" />
              {(data.length <= 14 || i % 2 === 0) && (
                <text x={cx} y={H + 18} textAnchor="middle" fontSize={9} fill="#a8a29e">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
        {/* Y labels */}
        {[0, 0.5, 1].map(t => (
          <text key={t} x={2} y={H - H * t + 4} fontSize={9} fill="#a8a29e">
            {fmtK(max * t)}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-stone-900 text-white text-xs rounded-xl px-3 py-2 shadow-lg -translate-x-1/2 -translate-y-full"
          style={{
            left: `${(tooltip.x / W) * 100}%`,
            top: `${(tooltip.y / (H + 30)) * 100}%`,
            marginTop: -8,
          }}
        >
          <div className="font-bold text-amber-300">{fmt(tooltip.value)}</div>
          <div className="text-stone-400 text-[10px]">{tooltip.label}</div>
        </div>
      )}
    </div>
  )
}

export default function AdminAnalytics() {
  const [allOrders, setAllOrders] = useState<OrderRow[]>([])
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [range,     setRange]     = useState<Range>('30d')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'with_cancelled'>('all')

  useEffect(() => {
    supabase
      .from('orders')
      .select('id,order_code,customer_name,created_at,revenue,cost,profit,shipping_fee,status,channel')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setAllOrders(data ?? []); setLoading(false) })
    supabase
      .from('order_items')
      .select('product_name, quantity, price, order:orders(created_at, status)')
      .then(({ data }) => setOrderItems((data as unknown as OrderItemRow[]) || []))
  }, [])

  // Filter by date range
  const rangeStart = getRangeStart(range)
  const filtered = useMemo(() => {
    let rows = rangeStart
      ? allOrders.filter(o => new Date(o.created_at) >= rangeStart!)
      : allOrders
    if (statusFilter === 'completed')      rows = rows.filter(o => o.status === 'completed')
    else if (statusFilter === 'all')       rows = rows.filter(o => o.status !== 'cancelled')
    // 'with_cancelled' = giữ tất cả, không lọc
    return rows
  }, [allOrders, statusFilter, rangeStart])

  // Stats
  const stats = useMemo(() => ({
    revenue:  filtered.reduce((s, o) => s + (o.revenue || 0), 0),
    cost:     filtered.reduce((s, o) => s + (o.cost    || 0), 0),
    profit:   filtered.reduce((s, o) => s + (o.profit  || 0), 0),
    orders:   filtered.length,
    avgOrder: filtered.length ? Math.round(filtered.reduce((s, o) => s + (o.revenue || 0), 0) / filtered.length) : 0,
  }), [filtered])

  const margin = stats.revenue > 0 ? ((stats.profit / stats.revenue) * 100).toFixed(1) : '0'

  // Doanh thu/số đơn theo kênh bán — cùng bộ lọc thời gian/trạng thái với bảng chính
  const channelStats = useMemo(() => {
    const map: Record<string, { orders: number; revenue: number }> = {}
    filtered.forEach(o => {
      const key = o.channel || 'website'
      if (!map[key]) map[key] = { orders: 0, revenue: 0 }
      map[key].orders += 1
      map[key].revenue += o.revenue || 0
    })
    return Object.entries(map)
      .map(([channel, v]) => ({ channel, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [filtered])

  // Top sản phẩm bán chạy theo số lượng — lọc theo cùng khoảng thời gian/trạng
  // thái với bảng đơn hàng chính, dựa trên order_items (product_name lưu sẵn
  // trên từng dòng, không cần join products).
  const topProducts = useMemo(() => {
    const rows = orderItems.filter(i => {
      if (!i.order) return false
      if (rangeStart && new Date(i.order.created_at) < rangeStart) return false
      if (statusFilter === 'completed') return i.order.status === 'completed'
      if (statusFilter === 'all') return i.order.status !== 'cancelled'
      return true
    })
    const map: Record<string, { name: string; qty: number; revenue: number }> = {}
    rows.forEach(i => {
      if (!map[i.product_name]) map[i.product_name] = { name: i.product_name, qty: 0, revenue: 0 }
      map[i.product_name].qty += i.quantity
      map[i.product_name].revenue += i.price * i.quantity
    })
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10)
  }, [orderItems, rangeStart, statusFilter])

  // Biểu đồ luôn loại bỏ đơn huỷ
  const chartOrders = (rangeStart
    ? allOrders.filter(o => new Date(o.created_at) >= rangeStart!)
    : allOrders
  ).filter(o => o.status !== 'cancelled')

  const chartData = useMemo(() => {
    const dayMap: Record<string, number> = {}
    chartOrders.forEach(o => {
      const day = o.created_at.slice(5, 10) // MM-DD
      dayMap[day] = (dayMap[day] || 0) + (o.revenue || 0)
    })
    return Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({ label, value }))
  }, [chartOrders])

  // Compare previous period — độ dài kỳ trước lấy trực tiếp từ `range` (số
  // ngày cố định) thay vì tính lệch theo Date.now(), vì gọi hàm "không thuần"
  // (impure) như Date.now() bên trong useMemo có thể cho kết quả không ổn
  // định giữa các lần render.
  const prevStart = useMemo(() => {
    if (!rangeStart || range === 'all') return null
    const days = range === 'today' ? 1 : range === '7d' ? 7 : 30
    const d = new Date(rangeStart)
    d.setDate(d.getDate() - days)
    return d
  }, [rangeStart, range])

  const prevOrders = prevStart
    ? allOrders.filter(o => {
        const t = new Date(o.created_at).getTime()
        return t >= prevStart.getTime() && t < (rangeStart?.getTime() ?? Infinity)
      })
    : []
  const prevRevenue = prevOrders.reduce((s, o) => s + (o.revenue || 0), 0)
  const revDelta = prevRevenue > 0 ? ((stats.revenue - prevRevenue) / prevRevenue * 100).toFixed(1) : null

  const RANGE_TABS: { key: Range; label: string }[] = [
    { key: 'today', label: 'Hôm nay' },
    { key: '7d',    label: '7 ngày'  },
    { key: '30d',   label: '30 ngày' },
    { key: 'all',   label: 'Tất cả'  },
  ]

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black">📊 Thống kê</h1>
          <p className="text-stone-400 text-sm mt-0.5">Doanh thu, lợi nhuận và hiệu suất kinh doanh</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {RANGE_TABS.map(t => (
            <button key={t.key} onClick={() => setRange(t.key)}
              className={`text-xs px-3 py-2 rounded-lg font-semibold transition ${
                range === t.key ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}>
              {t.label}
            </button>
          ))}
          <div className="w-px bg-stone-200 mx-1" />
          {([
            { key: 'all',       label: 'Mọi đơn' },
            { key: 'completed', label: 'Hoàn thành' },
          ] as { key: 'all' | 'completed'; label: string }[]).map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`text-xs px-3 py-2 rounded-lg font-semibold transition ${
                statusFilter === f.key ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Doanh thu', value: fmt(stats.revenue), sub: `${stats.orders} đơn hàng`,
            icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50',
            delta: revDelta,
          },
          {
            label: 'Giá vốn', value: fmt(stats.cost), sub: 'Chi phí nhập hàng',
            icon: Package, color: 'text-amber-600', bg: 'bg-amber-50', delta: null,
          },
          {
            label: 'Lợi nhuận', value: fmt(stats.profit), sub: `Biên ${margin}%`,
            icon: TrendingUp,
            color: stats.profit >= 0 ? 'text-green-600' : 'text-red-500',
            bg:    stats.profit >= 0 ? 'bg-green-50'  : 'bg-red-50',
            delta: null,
          },
          {
            label: 'Đơn TB', value: fmt(stats.avgOrder), sub: 'Giá trị trung bình / đơn',
            icon: BarChart2, color: 'text-violet-600', bg: 'bg-violet-50', delta: null,
          },
        ].map(card => (
          <div key={card.label} className={`${card.bg} rounded-2xl p-4 shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{card.label}</span>
              <card.icon size={16} className={card.color} />
            </div>
            <div className={`text-xl font-black ${card.color} mb-0.5`}>
              {loading ? '—' : card.value}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              {card.sub}
              {card.delta && (
                <span className={`flex items-center gap-0.5 font-semibold ${Number(card.delta) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {Number(card.delta) >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                  {Math.abs(Number(card.delta))}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-bold mb-4">📈 Doanh thu theo ngày</h2>
          <BarChart data={chartData} />
        </div>
      )}

      {/* Top sản phẩm bán chạy + theo kênh bán */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-1.5"><Trophy size={15} className="text-amber-500" /> Sản phẩm bán chạy</h2>
          {loading ? (
            <div className="text-center py-6 text-stone-400 text-sm">Đang tải...</div>
          ) : topProducts.length === 0 ? (
            <div className="text-center py-6 text-stone-400 text-sm">Chưa có dữ liệu trong khoảng thời gian này</div>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-black text-stone-300 w-4 flex-shrink-0">{i + 1}</span>
                    <span className="truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                    <span className="text-stone-400">{p.qty} sp</span>
                    <span className="font-bold text-blue-700 whitespace-nowrap">{fmt(p.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <h2 className="text-sm font-bold mb-4">📡 Doanh thu theo kênh</h2>
          {loading ? (
            <div className="text-center py-6 text-stone-400 text-sm">Đang tải...</div>
          ) : channelStats.length === 0 ? (
            <div className="text-center py-6 text-stone-400 text-sm">Chưa có dữ liệu trong khoảng thời gian này</div>
          ) : (
            <div className="space-y-2">
              {channelStats.map(c => (
                <div key={c.channel} className="flex items-center justify-between gap-3 text-sm">
                  <span>{SALES_CHANNEL_LABEL[c.channel as SalesChannel] || c.channel}</span>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                    <span className="text-stone-400">{c.orders} đơn</span>
                    <span className="font-bold text-blue-700 whitespace-nowrap">{fmt(c.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bảng đơn hàng */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-50 flex items-center justify-between">
          <h2 className="font-bold text-sm">📋 Nhật ký tài chính ({filtered.length} đơn)</h2>
        </div>
        {loading ? (
          <div className="text-center py-12 text-stone-400 text-sm">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm">Không có đơn nào trong khoảng thời gian này</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm block md:table md:min-w-[700px]">
              <thead className="hidden md:table-header-group">
                <tr className="bg-stone-50">
                  {['Mã đơn', 'Khách hàng', 'Ngày', 'Doanh thu', 'Giá vốn', 'Ship', 'Lợi nhuận', 'Trạng thái'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] uppercase text-stone-400 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {filtered.map(o => {
                  const isProfit = o.profit >= 0
                  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
                    completed: { label: 'Hoàn thành',    cls: 'bg-green-50 text-green-700' },
                    pending:   { label: 'Chờ xác nhận',  cls: 'bg-amber-50 text-amber-700' },
                    confirmed: { label: 'Đã xác nhận',   cls: 'bg-blue-50 text-blue-700'   },
                    shipping:  { label: 'Đang giao',     cls: 'bg-violet-50 text-violet-700'},
                    cancelled: { label: 'Đã huỷ',        cls: 'bg-red-50 text-red-600'     },
                  }
                  const st = STATUS_MAP[o.status] ?? { label: o.status, cls: 'bg-stone-100 text-stone-600' }
                  return (
                    <tr key={o.id} className="block md:table-row mb-3 md:mb-0 rounded-xl md:rounded-none border md:border-0 border-stone-100 md:border-t md:border-t-stone-50 hover:bg-stone-50/50 transition">
                      <td className="flex items-center justify-between md:table-cell py-2 px-4 md:py-2.5 font-mono text-xs font-bold">
                        <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Mã đơn</span>
                        {o.order_code}
                      </td>
                      <td className="flex items-center justify-between md:table-cell py-2 px-4 md:py-2.5 font-medium md:max-w-[120px] md:truncate">
                        <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Khách hàng</span>
                        {o.customer_name}
                      </td>
                      <td className="flex items-center justify-between md:table-cell py-2 px-4 md:py-2.5 text-stone-400 text-xs md:whitespace-nowrap">
                        <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Ngày</span>
                        {new Date(o.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="flex items-center justify-between md:table-cell py-2 px-4 md:py-2.5 font-semibold text-blue-700 md:whitespace-nowrap">
                        <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Doanh thu</span>
                        {fmt(o.revenue || 0)}
                      </td>
                      <td className="flex items-center justify-between md:table-cell py-2 px-4 md:py-2.5 text-amber-700 md:whitespace-nowrap">
                        <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Giá vốn</span>
                        {fmt(o.cost || 0)}
                      </td>
                      <td className="flex items-center justify-between md:table-cell py-2 px-4 md:py-2.5 text-stone-500 text-xs md:whitespace-nowrap">
                        <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Ship</span>
                        {o.shipping_fee > 0 ? fmt(o.shipping_fee) : '—'}
                      </td>
                      <td className="flex items-center justify-between md:table-cell py-2 px-4 md:py-2.5 md:whitespace-nowrap">
                        <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Lợi nhuận</span>
                        <span className={`font-black text-sm ${isProfit ? 'text-green-600' : 'text-red-500'}`}>
                          {isProfit ? '+' : ''}{fmt(o.profit || 0)}
                        </span>
                      </td>
                      <td className="flex items-center justify-between md:table-cell py-2 px-4 md:py-2.5">
                        <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Trạng thái</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="block md:table-footer-group">
                <tr className="flex items-center justify-between md:table-row border-t-2 border-stone-100 bg-stone-50 rounded-xl md:rounded-none px-4 md:px-0">
                  <td className="hidden md:table-cell" colSpan={3} />
                  <td className="py-3 px-0 md:px-4 text-xs font-bold text-stone-500 uppercase md:hidden">Tổng cộng</td>
                  <td className="hidden md:table-cell py-3 px-4 font-black text-blue-700 whitespace-nowrap">{fmt(stats.revenue)}</td>
                  <td className="hidden md:table-cell py-3 px-4 font-black text-amber-700 whitespace-nowrap">{fmt(stats.cost)}</td>
                  <td className="hidden md:table-cell" />
                  <td className="py-3 px-0 md:px-4 md:whitespace-nowrap">
                    <span className={`font-black text-base ${stats.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {stats.profit >= 0 ? '+' : ''}{fmt(stats.profit)}
                    </span>
                  </td>
                  <td className="hidden md:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
