export function roundUpToHalfKg(weight: number): number {
  return Math.ceil(weight / 0.5) * 0.5
}

export function calcTotalWeight(items: Array<{
  product: { weight?: number; category?: { name?: string } }
  quantity: number
}>): { totalWeight: number; hasBulky: boolean } {
  let totalWeight = 0
  let hasBulky = false

  for (const item of items) {
    const w = item.product.weight ?? 0.5
    totalWeight += w * item.quantity

    const catName = item.product.category?.name?.toLowerCase() ?? ''
    if (catName.includes('nội thất') || catName.includes('sofa') || catName.includes('giường')) {
      hasBulky = true
    }
  }

  return { totalWeight: roundUpToHalfKg(totalWeight), hasBulky }
}
