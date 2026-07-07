import { Campaign } from '@/types'

export function isCampaignRunning(campaign: Campaign, now: Date): boolean {
  if (!campaign.is_active) return false
  if (campaign.starts_at && now < new Date(campaign.starts_at)) return false
  if (campaign.ends_at && now > new Date(campaign.ends_at)) return false
  return true
}

function campaignAppliesTo(campaign: Campaign, productId: string): boolean {
  return campaign.scope === 'all' || campaign.product_ids.includes(productId)
}

function discountedPrice(price: number, campaign: Campaign): number {
  const discounted = campaign.discount_type === 'fixed'
    ? price - campaign.discount_value
    : price * (1 - campaign.discount_value / 100)
  return Math.max(0, Math.round(discounted))
}

// Nhiều khuyến mãi có thể cùng áp cho 1 sản phẩm (VD: 1 cái toàn shop + 1 cái
// riêng cho sản phẩm đó) — lấy giá thấp nhất (có lợi nhất cho khách), không cộng dồn.
export function bestCampaignPrice(productId: string, price: number, campaigns: Campaign[], now: Date): number | null {
  const applicable = campaigns.filter(c => isCampaignRunning(c, now) && campaignAppliesTo(c, productId))
  if (applicable.length === 0) return null
  return Math.min(...applicable.map(c => discountedPrice(price, c)))
}

export function hasCampaignFor(productId: string, campaigns: Campaign[], now: Date): boolean {
  return campaigns.some(c => isCampaignRunning(c, now) && campaignAppliesTo(c, productId))
}

// Chỉ áp giá campaign khi sản phẩm CHƯA có sale_price thủ công — tôn trọng
// giá admin đã tự set riêng cho sản phẩm đó, không đè lên.
export function applyCampaignsToProduct<T extends { id: string; price: number; sale_price: number | null }>(
  product: T,
  campaigns: Campaign[],
  now: Date
): T {
  if (product.sale_price != null) return product
  const best = bestCampaignPrice(product.id, product.price, campaigns, now)
  if (best == null) return product
  return { ...product, sale_price: best }
}

export function applyCampaignsToProducts<T extends { id: string; price: number; sale_price: number | null }>(
  products: T[],
  campaigns: Campaign[],
  now: Date
): T[] {
  return products.map(p => applyCampaignsToProduct(p, campaigns, now))
}

// Khuyến mãi đang chạy sắp hết hạn sớm nhất — dùng hiển thị banner topbar.
export function soonestEndingCampaign(campaigns: Campaign[], now: Date): Campaign | null {
  const running = campaigns.filter(c => isCampaignRunning(c, now) && c.ends_at)
  if (running.length === 0) return null
  return running.reduce((soonest, c) =>
    new Date(c.ends_at!).getTime() < new Date(soonest.ends_at!).getTime() ? c : soonest
  )
}
