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
    customer_district, customer_ward,
    customer_note, payment_method, items,
    shipping_fee = 0, shipping_zone = '', total_weight = 0,
    coupon_code, idempotency_key,
  } = body

  if (!customer_name || !customer_phone || !customer_address || !items?.length) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
  }

  // Double-click / mạng tự retry gửi lại đúng khoá này — trả về đơn đã tạo
  // thay vì tạo mới và trừ kho/coupon thêm lần nữa.
  if (idempotency_key) {
    const { data: existing } = await supabaseAdmin
      .from('orders')
      .select('id, order_code')
      .eq('idempotency_key', idempotency_key)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ order_code: existing.order_code, id: existing.id })
    }
  }

  // Hàng đặt trước chưa về kho nên không có số tồn kho thật — bỏ qua toàn bộ
  // kiểm tra tồn kho bên dưới cho các sản phẩm này (khớp với việc VariantSelector
  // cũng không khóa mẫu hết hàng khi is_preorder).
  //
  // Giá vốn cũng tra lại ở đây (không tin client gửi lên) — cost_price bị cố
  // tình giấu khỏi PUBLIC_PRODUCT_COLUMNS để không lộ cho khách, nên phía
  // trình duyệt không bao giờ có giá trị thật để gửi lên; phải tự tra DB.
  const allProductIds = Array.from(new Set(items.map(i => i.product_id)))
  const preorderProductIds = new Set<string>()
  const productCostMap: Record<string, number> = {}
  if (allProductIds.length > 0) {
    const { data: productRows } = await supabaseAdmin
      .from('products')
      .select('id, is_preorder, cost_price')
      .in('id', allProductIds)
    productRows?.forEach(p => {
      if (p.is_preorder) preorderProductIds.add(p.id)
      productCostMap[p.id] = p.cost_price || 0
    })
  }

  const allVariantIds = Array.from(new Set(items.map(i => i.variant_id).filter((id): id is string => !!id)))
  const variantCostMap: Record<string, number> = {}
  if (allVariantIds.length > 0) {
    const { data: variantCostRows } = await supabaseAdmin
      .from('product_variants')
      .select('id, cost_price')
      .in('id', allVariantIds)
    variantCostRows?.forEach(v => { variantCostMap[v.id] = v.cost_price || 0 })
  }

  const realCostOf = (i: (typeof items)[number]) =>
    i.variant_id ? (variantCostMap[i.variant_id] ?? 0) : (productCostMap[i.product_id] ?? 0)

  // Kiểm tra tồn kho biến thể — chặn ở server vì VariantSelector chỉ ẩn/disable
  // mẫu hết hàng ở client, không ngăn được người cố tình gọi thẳng API. Sản
  // phẩm không có biến thể chỉ có cờ in_stock thủ công, không có số để kiểm.
  const variantItems = items.filter(i => i.variant_id && !preorderProductIds.has(i.product_id))
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
  const noVariantItems = items.filter(i => !i.variant_id && !preorderProductIds.has(i.product_id))
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
  // Cost = giá vốn variant nếu có, fallback về giá vốn sản phẩm — tra thật
  // từ DB ở trên (realCostOf), không dùng số cost_price client gửi lên.
  const cost = items.reduce((s, i) => s + realCostOf(i) * i.quantity, 0)
  // Profit = doanh thu - giá vốn (ship do khách trả cho GHTK, không tính vào P&L)
  const profit = revenue - cost

  // Trừ tồn kho + cộng lượt dùng mã qua RPC nguyên tử TRƯỚC khi tạo đơn — mỗi
  // RPC chỉ ghi nếu điều kiện (đủ hàng/chưa hết lượt) còn đúng tại thời điểm
  // ghi, tránh bán vượt tồn kho hoặc vượt usage_limit khi nhiều đơn cùng
  // tranh giành. Pre-check ở trên chỉ để báo lỗi thân thiện ở trường hợp
  // thường gặp (không có đua tranh); RPC ở đây mới là chốt chặn thật.
  const decrementedVariants: { id: string; qty: number }[] = []
  const decrementedProducts: { id: string; qty: number }[] = []
  let couponIncremented = false

  const rollbackDecrements = async () => {
    for (const d of decrementedVariants) {
      await supabaseAdmin.rpc('increment_variant_stock', { p_variant_id: d.id, p_qty: d.qty })
    }
    for (const d of decrementedProducts) {
      await supabaseAdmin.rpc('increment_product_stock', { p_product_id: d.id, p_qty: d.qty })
    }
    if (couponIncremented && appliedCoupon) {
      await supabaseAdmin.rpc('decrement_coupon_usage', { p_coupon_id: appliedCoupon.id })
    }
  }

  for (const i of variantItems) {
    const { data: newStock, error: decErr } = await supabaseAdmin
      .rpc('decrement_variant_stock', { p_variant_id: i.variant_id, p_qty: i.quantity })
    if (decErr || newStock == null) {
      await rollbackDecrements()
      const label = i.variant_label ? ` (${i.variant_label})` : ''
      return NextResponse.json({ error: `"${i.product_name}"${label} vừa hết hàng, vui lòng thử lại` }, { status: 400 })
    }
    decrementedVariants.push({ id: i.variant_id!, qty: i.quantity })
  }

  for (const [productId, needed] of Object.entries(neededByProduct)) {
    if (!(productId in productStockMap)) continue
    const { data: newStock, error: decErr } = await supabaseAdmin
      .rpc('decrement_product_stock', { p_product_id: productId, p_qty: needed })
    if (decErr || newStock == null) {
      await rollbackDecrements()
      const item = noVariantItems.find(i => i.product_id === productId)
      return NextResponse.json({ error: `"${item?.product_name}" vừa hết hàng, vui lòng thử lại` }, { status: 400 })
    }
    decrementedProducts.push({ id: productId, qty: needed })
  }

  if (appliedCoupon) {
    const { data: newUsed, error: couponErr } = await supabaseAdmin
      .rpc('increment_coupon_usage', { p_coupon_id: appliedCoupon.id, p_limit: appliedCoupon.usage_limit })
    if (couponErr || newUsed == null) {
      await rollbackDecrements()
      return NextResponse.json({ error: 'Mã giảm giá vừa hết lượt sử dụng, vui lòng bỏ mã và thử lại' }, { status: 400 })
    }
    couponIncremented = true
  }

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .insert({
      order_code, customer_name, customer_phone,
      customer_address, customer_district: customer_district || null, customer_ward: customer_ward || null,
      customer_note, payment_method,
      subtotal, total, status: 'pending',
      shipping_fee, shipping_zone, total_weight,
      revenue, cost, profit,
      coupon_code: appliedCoupon?.code ?? null,
      discount_amount,
      idempotency_key: idempotency_key || null,
    })
    .select().single()

  if (error) {
    await rollbackDecrements()
    // Request khác với cùng idempotency_key đã tạo đơn trước — trả về đơn đó
    // thay vì báo lỗi, thay vì tạo đơn thứ 2.
    if (idempotency_key && error.code === '23505') {
      const { data: existing } = await supabaseAdmin
        .from('orders').select('id, order_code').eq('idempotency_key', idempotency_key).maybeSingle()
      if (existing) return NextResponse.json({ order_code: existing.order_code, id: existing.id })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
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
      cost_price:    realCostOf(i),
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