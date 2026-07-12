import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Tra cứu trạng thái vận đơn thật bên GHTK (đã lấy hàng/đang giao/đã giao...)
// — admin bấm thủ công để kiểm tra, không tự động đổi status nội bộ (tránh
// map sai trạng thái GHTK sang trạng thái đơn của shop).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const headers: Record<string, string> = { Token: token }
  if (partnerCode) headers['X-Client-Source'] = partnerCode

  try {
    const res = await fetch(
      `https://services.giaohangtietkiem.vn/services/shipment/v2/${encodeURIComponent(order.tracking_code)}`,
      { headers, cache: 'no-store' }
    )
    const data = await res.json()

    if (!data.success) {
      return NextResponse.json({ error: data.message || 'Không tra cứu được trạng thái' }, { status: 400 })
    }

    return NextResponse.json({
      status: data.order?.status,
      statusText: data.order?.status_text,
    })
  } catch {
    return NextResponse.json({ error: 'Lỗi kết nối GHTK, vui lòng thử lại' }, { status: 500 })
  }
}
