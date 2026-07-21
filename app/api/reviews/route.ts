import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getClientIp, rateLimit } from '@/lib/rateLimit'

// Khách gửi đánh giá sản phẩm — public, KHÔNG đăng nhập. Mọi review luôn vào
// status 'pending' chờ admin duyệt (không có đường lên 'approved' trực tiếp →
// chặn review giả/spam hiển thị ngay). Rate-limit theo IP để chống spam hàng loạt.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  if (!rateLimit(`review:${ip}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: 'Bạn gửi quá nhanh, vui lòng thử lại sau ít phút' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 })

  const productId  = String(body.product_id  || '').trim()
  const authorName = String(body.author_name || '').trim()
  const phone      = String(body.phone       || '').trim()
  const rating     = Math.round(Number(body.rating))
  const comment    = String(body.comment     || '').trim()

  if (!productId)                    return NextResponse.json({ error: 'Thiếu sản phẩm' }, { status: 400 })
  if (!authorName)                   return NextResponse.json({ error: 'Vui lòng nhập tên của bạn' }, { status: 400 })
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: 'Vui lòng chọn số sao (1–5)' }, { status: 400 })
  if (comment.length > 2000)         return NextResponse.json({ error: 'Nội dung quá dài (tối đa 2000 ký tự)' }, { status: 400 })

  // Sản phẩm phải tồn tại + đang hiển thị — chặn gửi review vào id rác.
  const { data: product } = await supabaseAdmin
    .from('products').select('id').eq('id', productId).eq('is_visible', true).single()
  if (!product) return NextResponse.json({ error: 'Sản phẩm không tồn tại' }, { status: 404 })

  // Đối chiếu "đã mua hàng": SĐT này có đơn đã giao/hoàn thành chứa sản phẩm đó.
  // Tách 2 truy vấn (lấy id đơn khớp SĐT+trạng thái → dò dòng hàng) cho rõ ràng,
  // không phụ thuộc cú pháp join lồng của PostgREST.
  let isVerified = false
  if (phone) {
    const { data: orders } = await supabaseAdmin
      .from('orders').select('id')
      .eq('customer_phone', phone)
      .in('status', ['shipping', 'completed'])
    const orderIds = orders?.map(o => o.id) ?? []
    if (orderIds.length) {
      const { data: matched } = await supabaseAdmin
        .from('order_items').select('id')
        .eq('product_id', productId)
        .in('order_id', orderIds)
        .limit(1)
      isVerified = !!matched?.length
    }
  }

  const { error } = await supabaseAdmin.from('reviews').insert({
    product_id: productId,
    author_name: authorName.slice(0, 60),
    author_phone: phone || null,
    rating,
    comment,
    is_verified_purchase: isVerified,
    status: 'pending',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
