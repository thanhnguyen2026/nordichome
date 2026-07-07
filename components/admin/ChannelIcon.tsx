import { SalesChannel } from '@/types'

// Native <select><option> không render được HTML/ảnh bên trong option (chỉ
// hiện text thuần), nên icon kênh bán chỉ dùng được trong dropdown tự chế
// (xem ChannelSelect bên dưới), không dùng được với <select> gốc.
export default function ChannelIcon({ channel, size = 16 }: { channel: SalesChannel; size?: number }) {
  const s = { width: size, height: size, flexShrink: 0 } as const

  if (channel === 'facebook') {
    return (
      <svg style={s} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="12" fill="#1877F2" />
        <path fill="#fff" d="M13.5 21v-7.6h2.6l.4-3h-3v-1.9c0-.87.24-1.46 1.49-1.46h1.6V4.35C15.94 4.24 15.02 4.18 13.94 4.18c-2.24 0-3.78 1.36-3.78 3.87v2.16H7.5v3h2.66V21h3.34z" />
      </svg>
    )
  }
  if (channel === 'shopee') {
    return (
      <svg style={s} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="6" fill="#EE4D2D" />
        <path fill="#fff" d="M8 8.2V7a4 4 0 0 1 8 0v1.2h2.1L19 20.5H5L5.9 8.2H8zm1.6 0h4.8V7a2.4 2.4 0 0 0-4.8 0v1.2z" />
      </svg>
    )
  }
  if (channel === 'tiktok') {
    return (
      <svg style={s} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="6" fill="#000" />
        <path fill="#25F4EE" d="M15.1 3.3c.4 1.8 1.6 3 3.4 3.2v2.5c-1.3 0-2.4-.4-3.4-1v6.2c0 3.1-2.5 5.5-5.5 5.5S4 17.3 4 14.2s2.5-5.5 5.5-5.5c.3 0 .6 0 .9.1v2.6a3 3 0 1 0 2 2.8V3.3h2.7z" />
        <path fill="#FE2C55" fillOpacity=".72" d="M14.4 3.3c.4 1.8 1.6 3 3.4 3.2v2.5c-1.3 0-2.4-.4-3.4-1v6.2c0 3.1-2.5 5.5-5.5 5.5S3.4 17.3 3.4 14.2s2.5-5.5 5.5-5.5c.3 0 .6 0 .9.1v2.6a3 3 0 1 0 2 2.8V3.3h2.6z" />
      </svg>
    )
  }
  return (
    <svg style={s} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="6" fill="#78716c" />
      <path fill="#fff" d="M6 8l6-3 6 3v8l-6 3-6-3V8zm6-1L7 9.2 12 11l5-1.8L12 7zm-5 3.1V15l4 2v-4.9L7 10.1zm6 6.9l4-2v-4.9l-4 1.9V17z" />
    </svg>
  )
}
