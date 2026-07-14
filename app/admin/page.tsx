'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import { ORDER_STATUS_LABEL, Order } from '@/types'
const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ products: 0, orders: 0, pending: 0, revenue: 0 })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ count: productCount }, { data: orders }] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_visible', true),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
      ])

      const pending = orders?.filter(o => o.status === 'pending').length || 0
      // Doanh thu tất cả đơn chưa huỷ (khớp với trang Thống kê mặc định)
      const revenue = orders
        ?.filter(o => o.status !== 'cancelled')
        .reduce((s, o) => s + Number(o.revenue ?? o.subtotal ?? 0), 0) || 0

      setStats({
        products: productCount || 0,
        orders: orders?.length || 0,
        pending,
        revenue,
      })
      setRecentOrders(orders?.slice(0, 5) || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <AdminLayout>
      <h1 className="text-2xl font-black mb-1">📊 Tổng quan</h1>
      <p className="text-stone-400 text-sm mb-6">Xin chào! Đây là tình hình cửa hàng của bạn.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Doanh thu', value: fmt(stats.revenue), icon: '💰', color: '#7ab89a', bg: '#f0fdf4', sub: 'Tất cả đơn chưa huỷ (trừ ship)' },
          { label: 'Tổng đơn hàng', value: stats.orders, icon: '📦', color: '#7aaac8', bg: '#eff6ff', sub: 'Tất cả trạng thái' },
          { label: 'Sản phẩm', value: stats.products, icon: '🛋️', color: '#a07abb', bg: '#f5f3ff', sub: 'Đang kinh doanh' },
          { label: 'Chờ xác nhận', value: stats.pending, icon: '⏳', color: '#d4a96a', bg: '#fffbeb', sub: 'Cần xử lý ngay' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 relative overflow-hidden">
            <div className="absolute -top-2 -right-2 text-5xl opacity-10">{s.icon}</div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3" style={{ background: s.bg }}>{s.icon}</div>
            <div className="text-xl font-black text-stone-800">{loading ? '...' : s.value}</div>
            <div className="text-xs font-semibold text-stone-600 mt-1">{s.label}</div>
            <div className="text-[10px] text-stone-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-sm">Đơn hàng gần đây</h2>
          <a href="/admin/orders" className="text-xs text-amber-700 font-semibold hover:underline">Xem tất cả →</a>
        </div>
        {loading ? (
          <div className="text-center py-8 text-stone-400 text-sm">Đang tải...</div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-sm">Chưa có đơn hàng nào</div>
        ) : (
          <table className="w-full text-sm block md:table">
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-stone-100">
                {['Mã đơn', 'Khách hàng', 'SĐT', 'Tổng tiền', 'Trạng thái', 'Ngày'].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-[11px] uppercase text-stone-400 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {recentOrders.map(o => (
                <tr key={o.id} className="block md:table-row mb-3 md:mb-0 rounded-xl md:rounded-none border md:border-0 border-stone-100 md:border-b md:border-b-stone-50">
                  <td className="flex items-center justify-between md:table-cell py-2 px-3 md:py-2.5 md:px-2 font-mono text-xs">
                    <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Mã đơn</span>
                    {o.order_code}
                  </td>
                  <td className="flex items-center justify-between md:table-cell py-2 px-3 md:py-2.5 md:px-2 font-semibold">
                    <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Khách hàng</span>
                    {o.customer_name}
                  </td>
                  <td className="flex items-center justify-between md:table-cell py-2 px-3 md:py-2.5 md:px-2 text-stone-500">
                    <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">SĐT</span>
                    {o.customer_phone}
                  </td>
                  <td className="flex items-center justify-between md:table-cell py-2 px-3 md:py-2.5 md:px-2 font-bold text-amber-700">
                    <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Tổng tiền</span>
                    {fmt(Number(o.total))}
                  </td>
                  <td className="flex items-center justify-between md:table-cell py-2 px-3 md:py-2.5 md:px-2">
                    <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Trạng thái</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100">
                      {ORDER_STATUS_LABEL[o.status as keyof typeof ORDER_STATUS_LABEL]}
                    </span>
                  </td>
                  <td className="flex items-center justify-between md:table-cell py-2 px-3 md:py-2.5 md:px-2 text-stone-400 text-xs">
                    <span className="text-[10px] uppercase text-stone-400 font-semibold md:hidden">Ngày</span>
                    {new Date(o.created_at).toLocaleDateString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  )
}