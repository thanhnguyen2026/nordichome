import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generateOrderCode } from '@/lib/orderCode'
import { SalesChannel } from '@/types'

interface ManualOrderItem {
  product_id: string
  product_name: string
  product_image: string
  price: number
  quantity: number
  cost_price: number
  origin_url: string | null
  variant_id: string | null
  variant_label: string | null
}

interface ManualOrderPayload {
  customer_name: string
  customer_phone: string
  customer_address: string
  customer_note: string
  channel: SalesChannel
  payment_method: 'cod' | 'bank'
  payment_status: 'pending' | 'paid'
  shipping_fee?: number
  items: ManualOrderItem[]
}

export async function POST(req: NextRequest) {
  // Đơn thủ công chỉ dành cho admin — route này không nằm trong matcher của
  // proxy.ts (chỉ chặn /admin/*), nên phải tự xác thực phiên đăng nhập ở đây.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const body: ManualOrderPayload = await req.json()
  const {
    customer_name, customer_phone, customer_address, customer_note,
    channel, payment_method, payment_status, items, shipping_fee = 0,
  } = body

  if (!customer_name || !customer_phone || !customer_address || !items?.length) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
  }

  // Hàng đặt trước chưa về kho nên không có số tồn kho thật — bỏ qua kiểm tra
  // tồn kho cho các sản phẩm này, khớp với logic ở /api/orders.
  const allProductIds = Array.from(new Set(items.map(i => i.product_id)))
  const preorderProductIds = new Set<string>()
  if (allProductIds.length > 0) {
    const { data: preorderRows } = await supabaseAdmin
      .from('products')
      .select('id, is_preorder')
      .in('id', allProductIds)
    preorderRows?.forEach(p => { if (p.is_preorder) preorderProductIds.add(p.id) })
  }

  // Trừ tồn kho theo đúng logic đơn website — kho hàng vật lý dùng chung
  // giữa các kênh, bán ở đâu cũng phải trừ chung 1 chỗ.
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
  const total = subtotal + (shipping_fee || 0)
  const order_code = generateOrderCode()

  const revenue = subtotal
  const cost = items.reduce((s, i) => s + (i.cost_price || 0) * i.quantity, 0)
  const profit = revenue - cost

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .insert({
      order_code, customer_name, customer_phone,
      customer_address, customer_note: customer_note || '',
      payment_method, payment_status,
      subtotal, total, status: 'pending',
      shipping_fee, channel,
      revenue, cost, profit,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  for (const i of variantItems) {
    const current = variantStockMap[i.variant_id!] ?? 0
    await supabaseAdmin.from('product_variants')
      .update({ stock: Math.max(0, current - i.quantity) })
      .eq('id', i.variant_id!)
  }

  for (const [productId, needed] of Object.entries(neededByProduct)) {
    if (!(productId in productStockMap)) continue
    const newStock = Math.max(0, productStockMap[productId] - needed)
    await supabaseAdmin.from('products')
      .update({ stock: newStock, in_stock: newStock > 0 })
      .eq('id', productId)
  }

  await supabaseAdmin.from('order_items').insert(
    items.map(i => ({
      order_id:      order.id,
      product_id:    i.product_id,
      product_name:  i.product_name,
      product_image: i.product_image,
      price:         i.price,
      quantity:      i.quantity,
      cost_price:    i.cost_price || 0,
      origin_url:    i.origin_url || null,
      variant_id:    i.variant_id || null,
      variant_label: i.variant_label || null,
    }))
  )

  return NextResponse.json({ order_code: order.order_code, id: order.id })
}
