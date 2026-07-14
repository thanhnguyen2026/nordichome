export async function sendTelegramNotification(order: {
  order_code: string
  customer_name: string
  customer_phone: string
  customer_address?: string
  payment_method: string
  total: number
  items?: Array<{ product_name: string; quantity: number; price: number; variant_label?: string | null }>
  id: string
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId   = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'

  const paymentLabel = order.payment_method === 'cod'
    ? 'COD - Thu tiền khi giao'
    : 'Chuyển khoản - Chờ xác nhận'

  const lines: string[] = [
    '🛋️ ĐƠN HÀNG MỚI - NORDIC HOME',
    '',
    'Mã đơn: ' + order.order_code,
    'Khách: ' + order.customer_name,
    'SĐT: ' + order.customer_phone,
  ]

  if (order.customer_address) lines.push('Địa chỉ: ' + order.customer_address)

  lines.push('')
  lines.push('Thanh toán: ' + paymentLabel)

  if (order.items?.length) {
    lines.push('')
    lines.push('Sản phẩm:')
    order.items.forEach(i => {
      const v = i.variant_label ? ' (' + i.variant_label + ')' : ''
      lines.push('- ' + i.product_name + v + ' x' + i.quantity + ' = ' + fmt(i.price * i.quantity))
    })
  }

  lines.push('')
  lines.push('Tổng: ' + fmt(order.total))
  lines.push('')
  lines.push('Xem admin: ' + (siteUrl || '') + '/admin/orders')
  lines.push('Link theo doi don: ' + (siteUrl || '') + '/orders/' + order.order_code + '?phone=' + order.customer_phone)

  const text = lines.join('\n')
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      })
      const data = await res.json()
      if (data.ok) {
        console.log('Telegram OK')
        return
      }
      console.error('Telegram error:', data.description)
      return // lỗi từ Telegram (vd: chat_id sai) không cần retry
    } catch (err) {
      console.error(`Telegram failed (attempt ${attempt}/${maxAttempts}):`, err)
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }
}

// Báo ngay khi 1 đơn vừa đặt làm tồn kho 1 sản phẩm/biến thể tụt xuống mức
// "sắp hết" — trước đây chỉ thấy khi admin tự mở tab Sản phẩm và nhìn badge.
export async function sendLowStockAlert(items: Array<{ name: string; stock: number }>) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId   = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId || items.length === 0) return

  const lines: string[] = ['⚠️ SẮP HẾT HÀNG', '']
  items.forEach(i => lines.push(`- ${i.name}: còn ${i.stock}`))
  const text = lines.join('\n')

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    const data = await res.json()
    if (!data.ok) console.error('Telegram low-stock alert error:', data.description)
  } catch (err) {
    console.error('Telegram low-stock alert failed:', err)
  }
}
