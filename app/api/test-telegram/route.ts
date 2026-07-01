import { NextResponse } from 'next/server'

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId   = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    return NextResponse.json({ ok: false, error: 'Chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID' })
  }

  const text = `Test thong bao tu Nordic Home Admin\nThoi gian: ${new Date().toLocaleString('vi-VN')}`

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    const data = await res.json()
    return NextResponse.json({ ok: data.ok, telegram_response: data })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
