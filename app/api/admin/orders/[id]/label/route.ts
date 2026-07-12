import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Lấy đúng file nhãn PDF gốc do GHTK phát hành cho mã vận đơn của đơn này —
// admin mở tab mới rồi in thẳng từ trình xem PDF, giống hệt phiếu in tại
// bưu cục GHTK. Phải proxy qua server vì GHTK yêu cầu header Token mà
// trình duyệt không gắn được khi mở link trực tiếp.
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

  // page_size=A6 — khổ nhãn nhỏ tiêu chuẩn để cắt dán lên gói hàng.
  const res = await fetch(
    `https://services.giaohangtietkiem.vn/services/label/${encodeURIComponent(order.tracking_code)}?page_size=A6`,
    { headers, cache: 'no-store' }
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'Không lấy được nhãn từ GHTK' }, { status: 502 })
  }

  const pdf = await res.arrayBuffer()
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="nhan-${order.tracking_code}.pdf"`,
    },
  })
}
