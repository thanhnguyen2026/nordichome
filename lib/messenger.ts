export async function sendMessengerNotification(order: {
  order_code: string
  customer_name: string
  customer_phone: string
  total: number
  id: string
}) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN
  const recipientId = process.env.FB_RECIPIENT_ID
  if (!token || !recipientId) {
    console.log('⚠️ Chưa cấu hình FB_PAGE_ACCESS_TOKEN hoặc FB_RECIPIENT_ID')
    return
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const text =
    `🛋️ ĐƠN HÀNG MỚI - NORDIC HOME\n\n` +
    `📦 Mã đơn: ${order.order_code}\n` +
    `👤 Khách: ${order.customer_name}\n` +
    `📞 SĐT: ${order.customer_phone}\n` +
    `💰 Giá trị: ${order.total.toLocaleString('vi-VN')}₫\n\n` +
    `👉 Xem trong Admin: ${siteUrl}/admin/orders`

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
        }),
      }
    )
    const data = await res.json()
    if (data.error) {
      console.error('❌ Lỗi gửi Messenger:', data.error.message)
    } else {
      console.log('✅ Đã gửi thông báo Messenger thành công!')
    }
  } catch (err) {
    console.error('❌ Messenger gửi thất bại:', err)
  }
}