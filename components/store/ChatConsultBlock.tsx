'use client'
import { useState } from 'react'
import { copyToClipboard } from '@/lib/clipboard'

interface ProductInfo {
  name: string
  sku?: string | null
  price: number
  sale_price?: number | null
  variantLabel?: string | null
  variantPrice?: number | null
  pageUrl?: string
}

interface Props {
  settings: Record<string, string>
  product?: ProductInfo
}

const CHANNELS = [
  { key: 'zalo',      label: 'Zalo',      color: '#0068FF' },
  { key: 'messenger', label: 'Messenger', color: '#0084FF' },
  { key: 'telegram',  label: 'Telegram',  color: '#26A5E4' },
  { key: 'instagram', label: 'Instagram', color: '#E1306C' },
]

const ICONS: Record<string, React.ReactNode> = {
  zalo: (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white flex-shrink-0">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Zm-2.5 6.5h5a.5.5 0 0 1 0 1H11v3.5h3.5a.5.5 0 0 1 0 1H11V15a.5.5 0 0 1-1 0v-1.5H9.5a.5.5 0 0 1 0-1H10V9.5H9.5a.5.5 0 0 1 0-1Z" />
    </svg>
  ),
  messenger: (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white flex-shrink-0">
      <path d="M12 2C6.477 2 2 6.145 2 11.259c0 2.913 1.453 5.512 3.728 7.214V22l3.405-1.869c.909.251 1.87.387 2.867.387 5.523 0 10-4.144 10-9.259C22 6.145 17.523 2 12 2Zm.991 12.467-2.548-2.718-4.973 2.718 5.471-5.806 2.61 2.718 4.91-2.718-5.47 5.806Z" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white flex-shrink-0">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm4.93 7.01-1.96 9.23c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.463c.537-.194 1.006.131.823.993Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white flex-shrink-0">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" />
    </svg>
  ),
}

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

function buildMessage(_ch: typeof CHANNELS[0], product?: ProductInfo): string {
  if (!product) return ''
  const effectivePrice = product.variantPrice ?? product.sale_price ?? product.price
  const lines = [
    `Xin chào Nordic Home! Tôi muốn hỏi về sản phẩm sau:`,
    ``,
    `📦 ${product.name}`,
    product.variantLabel ? `🎨 Mẫu: ${product.variantLabel}` : null,
    product.sku          ? `🔖 Mã SP: ${product.sku}` : null,
    `💰 Giá: ${fmt(effectivePrice)}`,
    product.pageUrl      ? `🔗 ${product.pageUrl}` : null,
    ``,
    `Vui lòng tư vấn thêm cho tôi ạ!`,
  ].filter((l): l is string => l !== null)
  return lines.join('\n')
}

export default function ChatConsultBlock({ settings, product }: Props) {
  const [toast, setToast] = useState<{ chKey: string; url: string } | null>(null)

  const active = CHANNELS.filter(
    ch => settings[`chat_${ch.key}_on`] === '1' && settings[`chat_${ch.key}_url`]
  )

  if (active.length === 0) return null

  const handleClick = async (ch: typeof CHANNELS[0], url: string) => {
    if (!product) {
      window.open(url, '_blank')
      return
    }
    // Copy trước rồi hiện hướng dẫn — nếu mở Messenger ngay lập tức, khách bị
    // chuyển app/tab trước khi kịp đọc "nhớ dán nội dung", tới nơi không biết
    // phải làm gì. Phải để khách thấy hướng dẫn trước, rồi mới tự bấm mở.
    const msg = buildMessage(ch, product)
    const ok = await copyToClipboard(msg)
    if (ok) setToast({ chKey: ch.key, url })
    else window.open(url, '_blank')
  }

  return (
    <div className="mt-4 rounded-xl border border-stone-100 bg-stone-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400">
        Tư vấn trực tiếp
      </p>

      <div className="flex flex-wrap gap-2">
        {active.map(ch => (
          <button
            key={ch.key}
            type="button"
            onClick={() => handleClick(ch, settings[`chat_${ch.key}_url`])}
            style={{ backgroundColor: ch.color }}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          >
            {ICONS[ch.key]}
            {ch.label}
          </button>
        ))}
      </div>

      {/* Toast hướng dẫn paste */}
      {toast && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          <p className="font-bold mb-1">✅ Đã sao chép thông tin sản phẩm!</p>
          <p className="text-green-700 text-xs mb-2.5">
            Bấm mở {CHANNELS.find(c => c.key === toast.chKey)?.label} bên dưới, rồi{' '}
            <span className="hidden md:inline">
              nhấn <kbd className="bg-green-100 border border-green-300 px-1.5 py-0.5 rounded font-mono text-xs">Ctrl+V</kbd>
            </span>
            <span className="md:hidden font-semibold">nhấn giữ vào khung chat → chọn Dán</span>
            {' '}để gửi thông tin sản phẩm.
          </p>
          <div className="flex gap-2">
            <a
              href={toast.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ backgroundColor: CHANNELS.find(c => c.key === toast.chKey)?.color }}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition"
            >
              {ICONS[toast.chKey]}
              Mở {CHANNELS.find(c => c.key === toast.chKey)?.label} →
            </a>
            <button
              onClick={() => setToast(null)}
              className="px-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-xs font-semibold transition"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
