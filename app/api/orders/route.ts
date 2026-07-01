import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendMessengerNotification } from '@/lib/messenger'
import { sendTelegramNotification } from '@/lib/telegram'

function generateOrderCode() {
  const now    = new Date()
  const yy     = String(now.getFullYear()).slice(2)
  const mm     = String(now.getMonth() + 1).padStart(2, '0')
  const dd     = String(now.getDate()).padStart(2, '0')
  const date   = `${yy}${mm}${dd}` // YYMMDD → 260629
  const random = Math.random().toString(36).slice(2, 6).toUpperCase() // 4 ký tự random A-Z0-9
  return `NH${date}${random}` // VD: NH260629A3X7
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    customer_name, customer_phone, customer_address,
    customer_note, payment_method, items,
    shipping_fee = 0, shipping_zone = '', total_weight = 0,
  } = body

  if (!customer_name || !customer_phone || !customer_address || !items?.length) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
  }

  const subtotal = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0)
  const total = subtotal + (shipping_fee || 0)
  const order_code = generateOrderCode()

  // Revenue = tiền hàng (không tính ship)
  const revenue = subtotal
  // Cost = giá vốn variant nếu có, fallback về giá vốn sản phẩm
  const cost = items.reduce((s: number, i: any) => {
    const unitCost = i.variant_cost_price ?? i.cost_price ?? 0
    return s + unitCost * i.quantity
  }, 0)
  // Profit = doanh thu - giá vốn (ship do khách trả cho GHTK, không tính vào P&L)
  const profit = revenue - cost

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .insert({
      order_code, customer_name, customer_phone,
      customer_address, customer_note, payment_method,
      subtotal, total, status: 'pending',
      shipping_fee, shipping_zone, total_weight,
      revenue, cost, profit,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Lưu order_items kèm variant info (server-side only)
  await supabaseAdmin.from('order_items').insert(
    items.map((i: any) => ({
      order_id:      order.id,
      product_id:    i.product_id,
      product_name:  i.product_name,
      // Ưu tiên ảnh variant, fallback về ảnh sản phẩm
      product_image: i.variant_image || i.product_image,
      price:         i.price,
      quantity:      i.quantity,
      cost_price:    i.variant_cost_price ?? i.cost_price ?? 0,
      origin_url:    i.origin_url || null,
      // Thông tin biến thể
      variant_id:    i.variant_id || null,
      variant_label: i.variant_label || null,
    }))
  )

  // Gửi Telegram (await để đảm bảo gửi trước khi response trả về)
  try {
    await sendTelegramNotification({
      order_code:       order.order_code,
      customer_name:    order.customer_name,
      customer_phone:   order.customer_phone,
      customer_address: order.customer_address,
      payment_method:   order.payment_method,
      total:            order.total,
      id:               order.id,
      items: items.map((i: any) => ({
        product_name:  i.product_name,
        quantity:      i.quantity,
        price:         i.price,
        variant_label: i.variant_label ?? null,
      })),
    })
  } catch (e) { console.error('Telegram error:', e) }

  await supabaseAdmin.from('orders')
    .update({ notified_messenger: true }).eq('id', order.id)

  return NextResponse.json({ order_code: order.order_code, id: order.id })
}