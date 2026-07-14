import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const PICK_PROVINCE = process.env.GHTK_PICK_PROVINCE || 'Hồ Chí Minh'
const PICK_DISTRICT = process.env.GHTK_PICK_DISTRICT || 'Quận Phú Nhuận'
const PICK_WARD      = process.env.GHTK_PICK_WARD || undefined
const PICK_ADDRESS   = process.env.GHTK_PICK_ADDRESS
const PICK_NAME       = process.env.GHTK_PICK_NAME
const PICK_TEL         = process.env.GHTK_PICK_TEL

// Tạo đơn thật bên GHTK để lấy mã vận đơn tự động, thay vì admin phải tự
// tạo đơn trên web GHTK rồi gõ tay mã vào. Chỉ dùng được với đơn có sẵn
// customer_district/customer_ward (đơn tạo từ sau khi thêm 2 cột này —
// đơn cũ vẫn phải nhập mã tay như trước).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const pickOption = body.pickOption === 'post' ? 'post' : 'cod'
  const token = process.env.GHTK_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Chưa cấu hình GHTK_TOKEN' }, { status: 500 })
  }
  if (!PICK_ADDRESS || !PICK_NAME || !PICK_TEL) {
    return NextResponse.json({ error: 'Chưa cấu hình đủ thông tin người gửi (GHTK_PICK_NAME/GHTK_PICK_TEL/GHTK_PICK_ADDRESS) trong biến môi trường' }, { status: 500 })
  }

  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Không tìm thấy đơn hàng' }, { status: 404 })
  }
  if (!order.customer_district || !order.customer_ward) {
    return NextResponse.json({ error: 'Đơn hàng này thiếu quận/huyện hoặc phường/xã (đơn tạo trước khi có tính năng này) — vui lòng nhập mã vận đơn thủ công' }, { status: 400 })
  }
  if (!order.shipping_zone) {
    return NextResponse.json({ error: 'Đơn hàng này thiếu tỉnh/thành — vui lòng nhập mã vận đơn thủ công' }, { status: 400 })
  }
  if (order.tracking_code) {
    return NextResponse.json({ error: 'Đơn hàng đã có mã vận đơn' }, { status: 400 })
  }

  const { data: orderItems } = await supabaseAdmin
    .from('order_items')
    .select('product_name, variant_label, quantity')
    .eq('order_id', id)

  // Chia đều tổng cân nặng đơn theo số lượng từng dòng — order_items không
  // lưu cân nặng riêng, chỉ orders.total_weight có tổng cho cả đơn.
  const totalWeight = Math.max(order.total_weight || 0.5, 0.1)
  const totalQty = orderItems?.reduce((s, i) => s + i.quantity, 0) || 0
  const weightPerUnit = totalQty > 0 ? totalWeight / totalQty : totalWeight

  const products = orderItems?.length
    ? orderItems.map(i => ({
        name: i.variant_label ? `${i.product_name} - ${i.variant_label}` : i.product_name,
        weight: Math.max(weightPerUnit * i.quantity, 0.1),
        quantity: i.quantity,
        product_code: order.order_code,
      }))
    : [{
        name: `Đơn hàng ${order.order_code}`,
        weight: totalWeight,
        quantity: 1,
        product_code: order.order_code,
      }]

  const payload = {
    products,
    order: {
      id: order.order_code,
      pick_name: PICK_NAME,
      pick_address: PICK_ADDRESS,
      pick_province: PICK_PROVINCE,
      pick_district: PICK_DISTRICT,
      pick_ward: PICK_WARD,
      pick_tel: PICK_TEL,
      tel: order.customer_phone,
      name: order.customer_name,
      address: order.customer_address,
      province: order.shipping_zone || undefined,
      district: order.customer_district,
      ward: order.customer_ward,
      hamlet: 'Khác',
      is_freeship: '1',
      pick_money: order.payment_method === 'cod' ? Math.round(order.total) : 0,
      note: order.customer_note || '',
      value: Math.round(order.total),
      transport: 'road',
      pick_option: pickOption,
      // Tag 10 — cho khách xem hàng trước khi nhận/trả tiền. Mặc định của
      // GHTK là KHÔNG cho xem nếu bỏ trống, không phù hợp với đơn COD.
      tags: [10],
    },
  }

  const partnerCode = process.env.GHTK_PARTNER_CODE
  const headers: Record<string, string> = { Token: token, 'Content-Type': 'application/json' }
  if (partnerCode) headers['X-Client-Source'] = partnerCode

  try {
    const res = await fetch('https://services.giaohangtietkiem.vn/services/shipment/order/?ver=1.5', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    const data = await res.json()

    // Đơn đã tồn tại bên GHTK (thường do lần gọi trước bị lag mạng, GHTK đã
    // tạo thành công nhưng app chưa kịp lưu mã) — GHTK trả kèm ghtk_label,
    // tự phục hồi thay vì bắt admin liên hệ hỗ trợ.
    if (!data.success && data.error?.code === 'ORDER_ID_EXIST' && data.error?.ghtk_label) {
      await supabaseAdmin.from('orders').update({ tracking_code: data.error.ghtk_label }).eq('id', id)
      return NextResponse.json({ trackingCode: data.error.ghtk_label })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.message || 'GHTK từ chối tạo đơn' }, { status: 400 })
    }

    const trackingCode = data.order?.label
    if (!trackingCode) {
      return NextResponse.json({ error: 'GHTK không trả về mã vận đơn' }, { status: 502 })
    }

    await supabaseAdmin.from('orders').update({ tracking_code: trackingCode }).eq('id', id)

    return NextResponse.json({ trackingCode })
  } catch {
    return NextResponse.json({ error: 'Lỗi kết nối GHTK, vui lòng thử lại' }, { status: 500 })
  }
}
