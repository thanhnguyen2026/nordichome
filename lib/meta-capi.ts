// ── Meta Conversions API (server-side) ──────────────────────────────────────
// Gửi song song với client pixel để tăng match rate, dùng event_id dedup

import crypto from 'crypto'

const PIXEL_ID      = process.env.META_PIXEL_ID
const ACCESS_TOKEN  = process.env.META_ACCESS_TOKEN
const API_VERSION   = 'v19.0'

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

export interface MetaEventParams {
  eventName:       string
  eventId:         string
  eventSourceUrl:  string
  value?:          number
  currency?:       string
  contentIds?:     string[]
  orderId?:        string
  userPhone?:      string
  clientIp?:       string
  userAgent?:      string
  fbp?:            string
  fbc?:            string
}

export async function sendMetaEvent(p: MetaEventParams): Promise<void> {
  if (!PIXEL_ID || !ACCESS_TOKEN) return

  const userData: Record<string, string> = {}
  if (p.userPhone)  userData.ph                 = sha256(p.userPhone.replace(/\D/g, ''))
  if (p.clientIp)   userData.client_ip_address  = p.clientIp
  if (p.userAgent)  userData.client_user_agent  = p.userAgent
  if (p.fbp)        userData.fbp                = p.fbp
  if (p.fbc)        userData.fbc                = p.fbc

  const customData: Record<string, any> = {}
  if (p.value      !== undefined) customData.value       = p.value
  if (p.currency)                 customData.currency    = p.currency
  if (p.contentIds?.length)       customData.content_ids = p.contentIds
  if (p.orderId)                  customData.order_id    = p.orderId

  const payload = {
    data: [{
      event_name:       p.eventName,
      event_time:       Math.floor(Date.now() / 1000),
      event_id:         p.eventId,
      event_source_url: p.eventSourceUrl,
      action_source:    'website',
      user_data:        userData,
      custom_data:      Object.keys(customData).length ? customData : undefined,
    }],
  }

  try {
    await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    )
  } catch (err) {
    console.error('[Meta CAPI]', err)
  }
}
