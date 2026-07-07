interface TaobaoCostInput {
  priceCny: number
  weightKg: number
  exchangeRate: number
  feePercent: number
  shippingPerKg: number
}

// Giá vốn = Giá Taobao (¥) × Tỷ giá × (1 + Hệ số phí%) + Giá ship/kg × Cân nặng
// Làm tròn đến 1.000đ gần nhất — tiền lẻ dưới 1.000đ không có ý nghĩa thực tế
// khi thao tác, sai số không đáng kể so với độ chính xác cần cho lợi nhuận.
export function calcTaobaoCost({ priceCny, weightKg, exchangeRate, feePercent, shippingPerKg }: TaobaoCostInput): number {
  const converted = priceCny * exchangeRate * (1 + feePercent / 100)
  const shipping = shippingPerKg * weightKg
  return Math.round((converted + shipping) / 1000) * 1000
}
