export function generateOrderCode(now: Date = new Date()): string {
  const yy     = String(now.getFullYear()).slice(2)
  const mm     = String(now.getMonth() + 1).padStart(2, '0')
  const dd     = String(now.getDate()).padStart(2, '0')
  const date   = `${yy}${mm}${dd}` // YYMMDD → 260629
  const random = Math.random().toString(36).slice(2, 6).toUpperCase() // 4 ký tự random A-Z0-9
  return `NH${date}${random}` // VD: NH260629A3X7
}
