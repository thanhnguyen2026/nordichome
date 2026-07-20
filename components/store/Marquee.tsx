// Preset màu định nghĩa CỨNG trong code (không lưu class Tailwind trong DB) --
// Tailwind biên dịch CSS bằng cách quét TĨNH mã nguồn lúc build để biết class
// nào cần sinh ra; nó không quét dữ liệu trong database. Nếu admin gõ tay
// "bg-emerald-950" rồi lưu vào settings và ta render className={value} trực
// tiếp, class đó sẽ không được Tailwind sinh CSS (không lỗi, chỉ im lặng
// không có tác dụng trên production). Lưu KEY của preset trong settings,
// tra bảng này để lấy class thật -- Tailwind thấy các literal string dưới
// đây ngay trong file này nên luôn build đúng.
export const MARQUEE_PRESETS = {
  default: {
    label: 'Mặc định', bg: 'bg-stone-50', border: 'border-stone-200',
    text: 'text-stone-600', iconColor: 'text-amber-500', icon: '✦', swatch: '#e7e5e4',
  },
  christmas: {
    // iconColor trùng với text (thay vì đỏ trước đây) -- dải ruy-băng đơn sắc
    // vàng champagne trông sang hơn là pha thêm điểm nhấn đỏ.
    label: 'Giáng sinh', bg: 'bg-emerald-950', border: 'border-emerald-900/50',
    text: 'text-amber-100', iconColor: 'text-amber-100', icon: '❄', swatch: '#022c22',
  },
  valentine: {
    // text đổi từ rose-100 sang amber-50: rose-100 trên nền rose-950 đủ tương
    // phản theo WCAG nhưng cùng tông hồng-đỏ với nền nên mắt vẫn thấy "chìm" —
    // amber-50 khác tông hẳn (đồng thời khớp accent vàng thương hiệu) nên nổi rõ hơn.
    label: 'Valentine 14/2', bg: 'bg-rose-950', border: 'border-rose-900',
    text: 'text-amber-50', iconColor: 'text-rose-300', icon: '♡', swatch: '#4c0519',
  },
  womensday: {
    label: 'Ngày 8/3', bg: 'bg-red-950', border: 'border-red-900',
    text: 'text-amber-50', iconColor: 'text-pink-300', icon: '✿', swatch: '#450a0a',
  },
  blackfriday: {
    label: 'Black Friday', bg: 'bg-black', border: 'border-stone-800',
    text: 'text-orange-300', iconColor: 'text-orange-400', icon: '●', swatch: '#000000',
  },
} as const

export type MarqueePresetKey = keyof typeof MARQUEE_PRESETS

interface Props {
  items: string[]
  preset?: MarqueePresetKey
  // Icon phân cách tuỳ chỉnh (admin gõ tay) -- để trống thì dùng icon mặc định của preset.
  separatorIcon?: string
}

// Dải chữ chạy ngang liên tục giữa các section — phá nhịp lưới đều đặn của
// trang, đặc trưng các trang thương hiệu cao cấp. Nhân đôi danh sách để cuộn
// liền mạch (khi nửa đầu trôi hết, nửa sau đã xếp sẵn ngay tại vị trí cũ).
// Vẫn thuần CSS animation (animate-marquee, xem globals.css) -- không JS,
// không giật lag dù đổi preset.
export default function Marquee({ items, preset = 'default', separatorIcon }: Props) {
  const theme = MARQUEE_PRESETS[preset]
  // U+FE0E (text presentation selector) buộc ký tự hiển thị dạng nét mảnh kế
  // thừa màu CSS (currentColor) thay vì dạng emoji nhiều màu cố định của hệ
  // điều hành -- vài ký tự như ❄ (U+2744) mặc định/khi dán từ bàn phím emoji
  // dễ bị render thành emoji màu bất kể class text-* đặt gì, phá vỡ tông màu
  // đơn sắc của dải ruy-băng. Áp dụng chung cho cả icon mặc định lẫn icon
  // admin tự gõ -- vô hại với ký tự không có phiên bản emoji.
  const icon = (separatorIcon?.trim() || theme.icon) + '︎'
  const content = [...items, ...items]

  return (
    <div className={`overflow-hidden border-y py-4 transition-colors duration-300 ${theme.bg} ${theme.border}`} aria-hidden="true">
      <div className="flex w-max animate-marquee">
        {content.map((item, i) => (
          <span key={i} className={`flex items-center gap-12 pr-12 font-serif italic leading-none text-sm uppercase tracking-widest whitespace-nowrap ${theme.text}`}>
            {item}
            <span className={`not-italic ${theme.iconColor}`}>{icon}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
