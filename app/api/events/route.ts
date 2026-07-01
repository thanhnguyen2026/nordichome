// Server-side event endpoint — nhận từ client, gửi lên Meta CAPI
import { NextRequest, NextResponse } from 'next/server'
import { sendMetaEvent } from '@/lib/meta-capi'

export async function POST(req: NextRequest) {
  try {
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
