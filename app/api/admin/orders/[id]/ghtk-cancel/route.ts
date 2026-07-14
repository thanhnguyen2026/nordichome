import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAdminUser } from '@/lib/adminAuth'

// Hủy vận đơn thật bên GHTK khi admin hủy đơn trong hệ thống — tránh quên
// hủy bên GHTK khiến shipper vẫn đi giao đơn đã hủy. GHTK chỉ cho hủy khi
// đơn còn ở trạng thái chưa lấy/đã lấy/đang lấy hàng (không hủy được nếu
// đã bắt đầu giao), nên lỗi ở đây không nên chặn việc hủy đơn nội bộ.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const { id } = await params
  const token = process.env.GHTK_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Chưa cấu hình GHTK_TOKEN' }, { status: 500 })
  }

  const { data: order } = await supabaseAdmin.from('orders').select('tracking_code').eq('id', id).single()
  if (!order?.tracking_code) {
    return NextResponse.json({ error: 'Đơn hàng chưa có mã vận đơn GHTK' }, { status: 400 })
  }

  const partnerCode = process.env.GHTK_PARTNER_CODE
  const headers: Record<string, string> = { Token: token, 'Content-Type': 'application/json' }
  if (partnerCode) headers['X-Client-Source'] = partnerCode

  try {
    const res = await fetch(
      `https://services.giaohangtietkiem.vn/services/shipment/cancel/${encodeURIComponent(order.tracking_code)}`,
      { method: 'POST', headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) }
    )
    const data = await res.json()

    if (!data.success) {
      return NextResponse.json({ error: data.message || 'GHTK không hủy được đơn này' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Lỗi kết nối GHTK, vui lòng thử lại' }, { status: 500 })
  }
}
