/**
 * Sao chép text an toàn cho mọi môi trường.
 *
 * navigator.clipboard chỉ tồn tại trong "secure context" (HTTPS hoặc
 * localhost) — khi xem demo qua IP LAN (http://192.168.x.x) hoặc HTTP thường,
 * navigator.clipboard là undefined và gọi .writeText sẽ crash ngay lập tức.
 * Fallback dùng execCommand('copy') qua textarea ẩn, hoạt động cả trên HTTP.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // rơi xuống fallback bên dưới
    }
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
