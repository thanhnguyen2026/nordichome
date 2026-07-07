import { describe, it, expect } from 'vitest'
import {
  isCampaignRunning, bestCampaignPrice, hasCampaignFor,
  applyCampaignsToProduct, soonestEndingCampaign,
} from './campaignPrice'
import type { Campaign } from '@/types'

const now = new Date('2026-07-15T12:00:00')

const baseCampaign: Campaign = {
  id: '1',
  name: 'Test',
  discount_type: 'percent',
  discount_value: 10,
  scope: 'all',
  product_ids: [],
  starts_at: '2026-07-01',
  ends_at: '2026-07-31',
  is_active: true,
  created_at: now.toISOString(),
}

describe('isCampaignRunning', () => {
  it('false khi tắt', () => {
    expect(isCampaignRunning({ ...baseCampaign, is_active: false }, now)).toBe(false)
  })
  it('false khi chưa tới ngày bắt đầu', () => {
    expect(isCampaignRunning({ ...baseCampaign, starts_at: '2026-08-01' }, now)).toBe(false)
  })
  it('false khi đã qua ngày kết thúc', () => {
    expect(isCampaignRunning({ ...baseCampaign, ends_at: '2026-07-14' }, now)).toBe(false)
  })
  it('true khi đang trong khoảng ngày', () => {
    expect(isCampaignRunning(baseCampaign, now)).toBe(true)
  })
})

describe('bestCampaignPrice', () => {
  it('null khi không có campaign nào áp dụng', () => {
    expect(bestCampaignPrice('p1', 100_000, [], now)).toBeNull()
  })

  it('áp scope "all" cho mọi sản phẩm', () => {
    expect(bestCampaignPrice('p1', 100_000, [baseCampaign], now)).toBe(90_000)
  })

  it('scope "selected" chỉ áp cho sản phẩm trong danh sách', () => {
    const c: Campaign = { ...baseCampaign, scope: 'selected', product_ids: ['p1'] }
    expect(bestCampaignPrice('p1', 100_000, [c], now)).toBe(90_000)
    expect(bestCampaignPrice('p2', 100_000, [c], now)).toBeNull()
  })

  it('lấy giá thấp nhất khi nhiều campaign cùng áp dụng', () => {
    const c1: Campaign = { ...baseCampaign, id: '1', discount_value: 10 }
    const c2: Campaign = { ...baseCampaign, id: '2', scope: 'selected', product_ids: ['p1'], discount_value: 30 }
    expect(bestCampaignPrice('p1', 100_000, [c1, c2], now)).toBe(70_000)
  })
})

describe('hasCampaignFor', () => {
  it('true khi có campaign áp dụng đang chạy', () => {
    expect(hasCampaignFor('p1', [baseCampaign], now)).toBe(true)
  })
  it('false khi campaign hết hạn', () => {
    expect(hasCampaignFor('p1', [{ ...baseCampaign, ends_at: '2026-07-01' }], now)).toBe(false)
  })
})

describe('applyCampaignsToProduct', () => {
  it('áp giá campaign khi sản phẩm chưa có sale_price', () => {
    const result = applyCampaignsToProduct({ id: 'p1', price: 100_000, sale_price: null }, [baseCampaign], now)
    expect(result.sale_price).toBe(90_000)
  })

  it('không đè lên sale_price đã set thủ công', () => {
    const result = applyCampaignsToProduct({ id: 'p1', price: 100_000, sale_price: 95_000 }, [baseCampaign], now)
    expect(result.sale_price).toBe(95_000)
  })
})

describe('soonestEndingCampaign', () => {
  it('null khi không có campaign nào đang chạy', () => {
    expect(soonestEndingCampaign([], now)).toBeNull()
  })

  it('lấy campaign hết hạn sớm nhất trong số đang chạy', () => {
    const c1: Campaign = { ...baseCampaign, id: '1', ends_at: '2026-07-31' }
    const c2: Campaign = { ...baseCampaign, id: '2', ends_at: '2026-07-20' }
    expect(soonestEndingCampaign([c1, c2], now)?.id).toBe('2')
  })
})
