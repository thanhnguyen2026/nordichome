export function roundUpToHalfKg(weight: number): number {
  return Math.ceil(weight / 0.5) * 0.5
}

export function calcTotalWeight(items: Array<{
  product: { weight?: number; is_bulky?: boolean; free_shipping?: boolean }
  quantity: number
}>): { totalWeight: number; hasBulky: boolean } {
  let totalWeight = 0
  let hasBulky = false

  for (const item of items) {
    // Sản phẩm đánh dấu free_shipping không cộng cân nặng vào phí ship —
    // is_bulky vẫn tính bình thường (yêu cầu liên hệ tư vấn không phụ thuộc phí ship).
    if (!item.product.free_shipping) {
      const w = item.product.weight ?? 0.5
      totalWeight += w * item.quantity
    }

    if (item.product.is_bulky) hasBulky = true
  }

  return { totalWeight: roundUpToHalfKg(totalWeight), hasBulky }
}
