import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendMessengerNotification } from '@/lib/messenger'
import { sendTelegramNotification } from '@/lib/telegram'
import { generateOrderCode } from '@/lib/orderCode'
import { CreateOrderPayload } from '@/types'

export async function POST(req: NextRequest) {
  const body: CreateOrderPayload = await req.json()
  const {
    customer_name, customer_phone, customer_address,
    customer_note, payment_method, items,
    shipping_fee = 0, shipping_zone = '', total_weight = 0,
  } = body

  if (!customer_name || !customer_phone || !customer_address || !items?.length) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const total = subtotal + (shipping_fee || 0)
  const order_code = generateOrderCode()

  // Revenue = tiền hàng (không tính ship)
  const revenue = subtotal
  // Cost = giá vốn variant nếu có, fallback về giá vốn sản phẩm
  const cost = items.reduce((s, i) => {
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
    items.map(i => ({
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

  // Đọc cài đặt bật/tắt kênh thông báo (mặc định Telegram bật, Messenger tắt)
  const { data: notifySettings } = await supabaseAdmin
    .from('settings')
    .select('key,value')
    .in('key', ['notify_telegram_on', 'notify_messenger_on'])
  const notifyMap = Object.fromEntries(notifySettings?.map(r => [r.key, r.value]) ?? [])
  const telegramOn  = notifyMap.notify_telegram_on !== '0'
  const messengerOn = notifyMap.notify_messenger_on === '1'

  if (telegramOn) {
    try {
      await sendTelegramNotification({
        order_code:       order.order_code,
        customer_name:    order.customer_name,
        customer_phone:   order.customer_phone,
        customer_address: order.customer_address,
        payment_method:   order.payment_method,
        total:            order.total,
        id:               order.id,
        items: items.map(i => ({
          product_name:  i.product_name,
          quantity:      i.quantity,
          price:         i.price,
          variant_label: i.variant_label ?? null,
        })),
      })
    } catch (e) { console.error('Telegram error:', e) }
  }

  if (messengerOn) {
    try {
      await sendMessengerNotification({
        order_code:     order.order_code,
        customer_name:  order.customer_name,
        customer_phone: order.customer_phone,
        total:          order.total,
        id:             order.id,
      })
    } catch (e) { console.error('Messenger error:', e) }
  }

  await supabaseAdmin.from('orders')
    .update({ notified_messenger: messengerOn }).eq('id', order.id)

  return NextResponse.json({ order_code: order.order_code, id: order.id })
}