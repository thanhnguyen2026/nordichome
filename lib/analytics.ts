// ── Client-side analytics utilities ─────────────────────────────────────────

declare global {
  interface Window {
    dataLayer: any[]
    gtag:  (...args: any[]) => void
    fbq:   (...args: any[]) => void
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function dlPush(obj: Record<string, any>) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ ecommerce: null }) // GA4 clear
  window.dataLayer.push(obj)
}

function gtag(...args: any[]) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args)
  }
}

function fbq(...args: any[]) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq(...args)
  }
}

export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── UTM capture ──────────────────────────────────────────────────────────────

export function captureUTM() {
  if (typeof window === 'undefined') return
  const p = new URLSearchParams(window.location.search)
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']
  const utm: Record<string, string> = {}
  let found = false
  keys.forEach(k => { const v = p.get(k); if (v) { utm[k] = v; found = true } })
  if (found) sessionStorage.setItem('utm_data', JSON.stringify(utm))
}

export function getUTM(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(sessionStorage.getItem('utm_data') || '{}') } catch { return {} }
}

export function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? match[2] : ''
}

// ── view_item ────────────────────────────────────────────────────────────────

export function trackViewItem(product: {
  id: string; name: string; price: number; sale_price?: number | null
  category?: string; slug?: string
}) {
  const price = product.sale_price ?? product.price
  const item  = {
    item_id: product.id, item_name: product.name,
    item_category: product.category ?? '', price, quantity: 1,
  }

  // GTM dataLayer
  dlPush({ event: 'view_item', ecommerce: { currency: 'VND', value: price, items: [item] } })

  // GA4 direct
  gtag('event', 'view_item', { currency: 'VND', value: price, items: [item] })

  // Meta Pixel
  fbq('track', 'ViewContent', {
    content_ids:  [product.id],
    content_name: product.name,
    content_type: 'product',
    value:        price,
    currency:     'VND',
  })
}

// ── add_to_cart ──────────────────────────────────────────────────────────────

export function trackAddToCart(product: {
  id: string; name: string; price: number
  variantId?: string | null; variantLabel?: string | null; category?: string
}, quantity: number) {
  const value = product.price * quantity
  const item  = {
    item_id: product.id, item_name: product.name,
    item_variant: product.variantLabel ?? '',
    item_category: product.category ?? '',
    price: product.price, quantity,
  }

  dlPush({ event: 'add_to_cart', ecommerce: { currency: 'VND', value, items: [item] } })

  gtag('event', 'add_to_cart', { currency: 'VND', value, items: [item] })

  fbq('track', 'AddToCart', {
    content_ids:  [product.id],
    content_name: product.name,
    content_type: 'product',
    value,
    currency:     'VND',
  })
}

// ── begin_checkout ───────────────────────────────────────────────────────────

export function trackBeginCheckout(items: Array<{
  product: { id: string; name: string; price: number; sale_price?: number | null }
  quantity: number
}>, total: number) {
  const mappedItems = items.map(i => ({
    item_id:   i.product.id,
    item_name: i.product.name,
    price:     i.product.sale_price ?? i.product.price,
    quantity:  i.quantity,
  }))

  dlPush({ event: 'begin_checkout', ecommerce: { currency: 'VND', value: total, items: mappedItems } })

  gtag('event', 'begin_checkout', { currency: 'VND', value: total, items: mappedItems })

  fbq('track', 'InitiateCheckout', {
    content_ids: items.map(i => i.product.id),
    value:       total,
    currency:    'VND',
    num_items:   items.reduce((s, i) => s + i.quantity, 0),
  })
}

// ── purchase ─────────────────────────────────────────────────────────────────

export function trackPurchase(params: {
  orderId:  string
  total:    number
  shipping: number
  subtotal: number
  items:    Array<{
    id: string; name: string; price: number; quantity: number
    variantLabel?: string | null
  }>
  eventId: string
}) {
  const mappedItems = params.items.map(i => ({
    item_id:      i.id,
    item_name:    i.name,
    item_variant: i.variantLabel ?? '',
    price:        i.price,
    quantity:     i.quantity,
  }))

  // GTM dataLayer (GA4 + GTM tags)
  dlPush({
    event:    'purchase',
    event_id: params.eventId,
    ecommerce: {
      currency:       'VND',
      transaction_id: params.orderId,
      value:          params.total,
      shipping:       params.shipping,
      items:          mappedItems,
    },
  })

  // GA4 direct
  gtag('event', 'purchase', {
    currency:       'VND',
    transaction_id: params.orderId,
    value:          params.total,
    shipping:       params.shipping,
    items:          mappedItems,
  })

  // Google Ads conversion
  const gadsId    = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  const gadsLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL
  if (gadsId && gadsLabel) {
    gtag('event', 'conversion', {
      send_to:        `${gadsId}/${gadsLabel}`,
      value:          params.total,
      currency:       'VND',
      transaction_id: params.orderId,
    })
  }

  // Meta Pixel (client-side, event_id cho dedup với CAPI)
  fbq('track', 'Purchase', {
    content_ids: params.items.map(i => i.id),
    value:       params.total,
    currency:    'VND',
    num_items:   params.items.reduce((s, i) => s + i.quantity, 0),
  }, { eventID: params.eventId })
}
