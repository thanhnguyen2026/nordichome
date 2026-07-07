import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendMessengerNotification } from '@/lib/messenger'
import { sendTelegramNotification } from '@/lib/telegram'
import { generateOrderCode } from '@/lib/orderCode'
import { checkCoupon } from '@/lib/coupon'
import { hasCampaignFor } from '@/lib/campaignPrice'
import { CreateOrderPayload, Coupon, Campaign } from '@/types'

export async function POST(req: NextRequest) {
  const body: CreateOrderPayload = await req.json()
  const {
    customer_name, customer_phone, customer_address,
    customer_note, payment_method, items,
    shipping_fee = 0, shipping_zone = '', total_weight = 0,
    coupon_code,
  } = body

  if (!customer_name || !customer_phone || !customer_address || !items?.length) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
  }

  // Kiểm tra tồn kho biến thể — chặn ở server vì VariantSelector chỉ ẩn/disable
  // mẫu hết hàng ở client, không ngăn được người cố tình gọi thẳng API. Sản
  // phẩm không có biến thể chỉ có cờ in_stock thủ công, không có số để kiểm.
  const variantItems = items.filter(i => i.variant_id)
  const variantStockMap: Record<string, number> = {}
  if (variantItems.length > 0) {
    const { data: variants } = await supabaseAdmin
      .from('product_variants')
      .select('id, stock')
      .in('id', variantItems.map(i => i.variant_id!))
    variants?.forEach(v => { variantStockMap[v.id] = v.stock })

    for (const i of variantItems) {
      const available = variantStockMap[i.variant_id!] ?? 0
      if (available < i.quantity) {
        const label = i.variant_label ? ` (${i.variant_label})` : ''
        return NextResponse.json(
          { error: `"${i.product_name}"${label} không đủ hàng — chỉ còn ${available}` },
          { status: 400 }
        )
      }
    }
  }

  // Kiểm tra tồn kho cấp sản phẩm cho sản phẩm KHÔNG biến thể (chỉ khi admin
  // có nhập số lượng cụ thể — products.stock null nghĩa là không theo dõi,
  // bỏ qua, giữ hành vi cũ dựa vào cờ in_stock thủ công).
  const noVariantItems = items.filter(i => !i.variant_id)
  const neededByProduct: Record<string, number> = {}
  noVariantItems.forEach(i => { neededByProduct[i.product_id] = (neededByProduct[i.product_id] || 0) + i.quantity })

  const productStockMap: Record<string, number> = {}
  const productIds = Object.keys(neededByProduct)
  if (productIds.length > 0) {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, stock')
      .in('id', productIds)
    products?.forEach(p => { if (p.stock != null) productStockMap[p.id] = p.stock })
  }

  for (const [productId, needed] of Object.entries(neededByProduct)) {
    if (!(productId in productStockMap)) continue
    const available = productStockMap[productId]
    if (available < needed) {
      const item = noVariantItems.find(i => i.product_id === productId)
      return NextResponse.json(
        { error: `"${item?.product_name}" không đủ hàng — chỉ còn ${available}` },
        { status: 400 }
      )
    }
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)

  // Re-validate mã giảm giá ở server — không tin số discount client tự tính,
  // vì giỏ hàng/subtotal có thể đổi giữa lúc khách áp mã và lúc bấm đặt hàng.
  // Không cho dùng mã giảm giá nếu có sản phẩm trong đơn đang được áp khuyến
  // mãi — tránh cộng dồn 2 loại giảm giá (chặn cả server phòng client bị bypass).
  let discount_amount = 0
  let appliedCoupon: Coupon | null = null
  if (coupon_code) {
    const { data: campaignsRaw } = await supabaseAdmin.from('campaigns').select('*').eq('is_active', true)
    const campaigns = (campaignsRaw ?? []) as unknown as Campaign[]
    const now = new Date()
    if (items.some(i => hasCampaignFor(i.product_id, campaigns, now))) {
      return NextResponse.json({ error: 'Sản phẩm đang được áp khuyến mãi, không dùng thêm mã giảm giá được' }, { status: 400 })
    }

    const { data: coupon } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .ilike('code', coupon_code.trim())
      .maybeSingle<Coupon>()

    if (!coupon) return NextResponse.json({ error: 'Mã giảm giá không tồn tại' }, { status: 400 })
    const result = checkCoupon(coupon, subtotal)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    discount_amount = result.discount_amount
    appliedCoupon = coupon
  }

  const total = subtotal - discount_amount + (shipping_fee || 0)
  const order_code = generateOrderCode()

  // Revenue = tiền hàng sau giảm giá (không tính ship)
  const revenue = subtotal - discount_amount
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
      coupon_code: appliedCoupon?.code ?? null,
      discount_amount,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Cộng lượt dùng mã — không tuyệt đối atomic dưới tải đồng thời cao, nhưng
  // đủ dùng ở quy mô hiện tại (không có race condition thực tế đáng lo)
  if (appliedCoupon) {
    await supabaseAdmin.from('coupons')
      .update({ used_count: appliedCoupon.used_count + 1 })
      .eq('id', appliedCoupon.id)
  }

  // Trừ tồn kho biến thể đã đặt (không atomic, cùng mức chấp nhận rủi ro như used_count ở trên)
  for (const i of variantItems) {
    const current = variantStockMap[i.variant_id!] ?? 0
    await supabaseAdmin.from('product_variants')
      .update({ stock: Math.max(0, current - i.quantity) })
      .eq('id', i.variant_id!)
  }

  // Trừ tồn kho cấp sản phẩm (không biến thể, có theo dõi số lượng) — in_stock
  // tự suy ra từ số còn lại, không cần admin bật/tắt tay nữa.
  for (const [productId, needed] of Object.entries(neededByProduct)) {
    if (!(productId in productStockMap)) continue
    const newStock = Math.max(0, productStockMap[productId] - needed)
    await supabaseAdmin.from('products')
      .update({ stock: newStock, in_stock: newStock > 0 })
      .eq('id', productId)
  }

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