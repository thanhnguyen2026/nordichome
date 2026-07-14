// Server-side event endpoint — nhận từ client, gửi lên Meta CAPI
import { NextRequest, NextResponse } from 'next/server'
import { sendMetaEvent } from '@/lib/meta-capi'
import { getClientIp, rateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  try {
    // Chặn spam/giả mạo sự kiện conversion (tốn quota Meta CAPI, làm sai lệch
    // số liệu quảng cáo) — giới hạn rộng vì 1 phiên duyệt web bắn nhiều event
    // (view_item, add_to_cart, begin_checkout, purchase) trong thời gian ngắn.
    const ip = getClientIp(req.headers)
    if (!rateLimit(`events:${ip}`, 60, 5 * 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json()
    const { eventName, eventId, value, currency, contentIds, orderId, userPhone, fbp, fbc } = body

    if (!eventName || !eventId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const clientIp = (
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      ''
    ).trim()
    const userAgent   = req.headers.get('user-agent')  || ''
    const referer     = req.headers.get('referer')      || req.headers.get('origin') || ''

    await sendMetaEvent({
      eventName,
      eventId,
      eventSourceUrl: referer,
      value,
      currency: currency || 'VND',
      contentIds,
      orderId,
      userPhone,
      clientIp,
      userAgent,
      fbp,
      fbc,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/events]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
