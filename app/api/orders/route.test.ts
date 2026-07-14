import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase với 1 hàng đợi (FIFO) riêng cho từng bảng và từng tên RPC —
// mỗi lệnh gọi .from(table)... hoặc .rpc(name, ...) lấy ra 1 kết quả kế tiếp
// trong hàng đợi tương ứng. Đủ để mô phỏng chuỗi truy vấn thật của route mà
// không cần một DB Postgres thật (route dùng RPC nguyên tử — điều quan trọng
// cần test là code XỬ LÝ ĐÚNG khi RPC báo thất bại, không phải bản thân RPC).
const state = vi.hoisted(() => ({
  queues:    {} as Record<string, Array<{ data: unknown; error?: unknown }>>,
  rpcQueues: {} as Record<string, Array<{ data: unknown; error?: unknown }>>,
  rpcCalls:  [] as { name: string; params: unknown }[],
  insertPayloads: {} as Record<string, unknown[]>,
}))

function resetMockState() {
  state.queues = {}
  state.rpcQueues = {}
  state.rpcCalls = []
  state.insertPayloads = {}
}

function queue(table: string, ...results: Array<{ data: unknown; error?: unknown }>) {
  state.queues[table] = [...(state.queues[table] ?? []), ...results]
}

function queueRpc(name: string, ...results: Array<{ data: unknown; error?: unknown }>) {
  state.rpcQueues[name] = [...(state.rpcQueues[name] ?? []), ...results]
}

vi.mock('@/lib/supabaseAdmin', () => {
  function shift(table: string): { data: unknown; error: unknown } {
    const q = state.queues[table]
    if (!q || q.length === 0) return { data: null, error: null }
    const item = q.shift()!
    return { data: item.data, error: item.error ?? null }
  }
  function makeBuilder(table: string) {
    const builder: {
      select: () => typeof builder
      eq: () => typeof builder
      in: () => typeof builder
      ilike: () => typeof builder
      order: () => typeof builder
      insert: (payload: unknown) => typeof builder
      update: (payload: unknown) => typeof builder
      single: () => Promise<{ data: unknown; error: unknown }>
      maybeSingle: () => Promise<{ data: unknown; error: unknown }>
      then: (resolve: (v: { data: unknown; error: unknown }) => void, reject?: (e: unknown) => void) => Promise<void>
    } = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      ilike: () => builder,
      order: () => builder,
      insert: (payload: unknown) => {
        (state.insertPayloads[table] ??= []).push(payload)
        return builder
      },
      update: () => builder,
      single: () => Promise.resolve(shift(table)),
      maybeSingle: () => Promise.resolve(shift(table)),
      then: (resolve, reject) => Promise.resolve(shift(table)).then(resolve, reject),
    }
    return builder
  }
  return {
    supabaseAdmin: {
      from: (table: string) => makeBuilder(table),
      rpc: (name: string, params: unknown) => {
        state.rpcCalls.push({ name, params })
        const q = state.rpcQueues[name]
        const result = q && q.length > 0 ? q.shift()! : { data: null, error: null }
        return Promise.resolve(result)
      },
    },
  }
})

vi.mock('@/lib/telegram', () => ({
  sendTelegramNotification: vi.fn(async () => {}),
  sendLowStockAlert: vi.fn(async () => {}),
}))
vi.mock('@/lib/messenger', () => ({
  sendMessengerNotification: vi.fn(async () => {}),
}))

const { POST } = await import('./route')

function makeRequest(payload: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

const basePayload = {
  customer_name: 'Nguyễn Văn A',
  customer_phone: '0900000000',
  customer_address: '123 Đường ABC',
  customer_note: '',
  payment_method: 'cod' as const,
  items: [] as unknown[],
}

beforeEach(() => {
  resetMockState()
})

describe('POST /api/orders — trừ kho/coupon nguyên tử + idempotency', () => {
  it('tạo đơn thành công, trừ kho qua RPC đúng 1 lần', async () => {
    queue('products', { data: [{ id: 'p1', is_preorder: false, cost_price: 100_000 }] })
    queue('product_variants',
      { data: [{ id: 'v1', cost_price: 100_000 }] }, // cost lookup
      { data: [{ id: 'v1', stock: 10 }] },            // pre-check stock
    )
    queueRpc('decrement_variant_stock', { data: 8 }) // còn 8 sau khi trừ 2
    queue('orders',
      { data: { id: 'order-1', order_code: 'NH000001', customer_name: 'Nguyễn Văn A', customer_phone: '0900000000', customer_address: '123 Đường ABC', payment_method: 'cod', total: 200_000 } }, // insert
      { data: null }, // update notified_messenger
    )
    queue('order_items', { data: null })
    queue('settings', { data: [] })

    const res = await POST(makeRequest({
      ...basePayload,
      items: [{
        product_id: 'p1', product_name: 'Ghế sofa', product_image: '', price: 100_000,
        quantity: 2, cost_price: 0, origin_url: '', variant_id: 'v1', variant_label: 'Xám',
        variant_image: null, variant_cost_price: null,
      }],
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.order_code).toBe('NH000001')
    expect(state.rpcCalls).toEqual([
      { name: 'decrement_variant_stock', params: { p_variant_id: 'v1', p_qty: 2 } },
    ])
  })

  it('khoá idempotency trùng → trả về đơn cũ, không gọi RPC nào (không trừ kho lần 2)', async () => {
    queue('orders', { data: { id: 'existing-1', order_code: 'NH-EXIST' } })

    const res = await POST(makeRequest({
      ...basePayload,
      idempotency_key: 'same-key-123',
      items: [{
        product_id: 'p1', product_name: 'Ghế sofa', product_image: '', price: 100_000,
        quantity: 1, cost_price: 0, origin_url: '', variant_id: null, variant_label: null,
        variant_image: null, variant_cost_price: null,
      }],
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ order_code: 'NH-EXIST', id: 'existing-1' })
    expect(state.rpcCalls).toEqual([])
  })

  it('hết hàng ngay lúc trừ kho nguyên tử (thua race) → rollback phần đã trừ, trả lỗi 400', async () => {
    queue('products', { data: [{ id: 'p1', is_preorder: false, cost_price: 0 }] })
    queue('product_variants',
      { data: [{ id: 'v1', cost_price: 0 }, { id: 'v2', cost_price: 0 }] }, // cost lookup
      { data: [{ id: 'v1', stock: 5 }, { id: 'v2', stock: 5 }] },           // pre-check: cả 2 đều còn hàng
    )
    // v1 trừ thành công, v2 thua race (WHERE stock >= qty không khớp dòng nào)
    queueRpc('decrement_variant_stock', { data: 4 }, { data: null })

    const res = await POST(makeRequest({
      ...basePayload,
      items: [
        { product_id: 'p1', product_name: 'Sản phẩm A', product_image: '', price: 100_000, quantity: 1, cost_price: 0, origin_url: '', variant_id: 'v1', variant_label: null, variant_image: null, variant_cost_price: null },
        { product_id: 'p1', product_name: 'Sản phẩm B', product_image: '', price: 100_000, quantity: 1, cost_price: 0, origin_url: '', variant_id: 'v2', variant_label: null, variant_image: null, variant_cost_price: null },
      ],
    }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('vừa hết hàng')

    const names = state.rpcCalls.map(c => c.name)
    expect(names).toEqual([
      'decrement_variant_stock', // v1 — thành công
      'decrement_variant_stock', // v2 — thất bại
      'increment_variant_stock', // rollback v1
    ])
    expect(state.rpcCalls[2].params).toEqual({ p_variant_id: 'v1', p_qty: 1 })
  })

  it('coupon vừa hết lượt lúc cộng nguyên tử (thua race) → rollback tồn kho đã trừ, trả lỗi 400', async () => {
    queue('products', { data: [{ id: 'p1', is_preorder: false, cost_price: 0 }] })
    queue('product_variants',
      { data: [{ id: 'v1', cost_price: 0 }] }, // cost lookup
      { data: [{ id: 'v1', stock: 5 }] },      // pre-check
    )
    queueRpc('decrement_variant_stock', { data: 4 })
    queue('campaigns', { data: [] })
    queue('coupons', { data: { id: 'c1', code: 'SALE10', discount_type: 'fixed', discount_value: 10_000, min_order_amount: 0, max_discount_amount: null, starts_at: null, ends_at: null, usage_limit: 5, used_count: 4, is_active: true, created_at: new Date().toISOString() } })
    // used_count=4 < usage_limit=5 nên checkCoupon() cho qua, nhưng RPC nguyên tử
    // báo đã hết lượt (giả lập 1 request khác vừa dùng nốt lượt cuối trước đó)
    queueRpc('increment_coupon_usage', { data: null })

    const res = await POST(makeRequest({
      ...basePayload,
      coupon_code: 'SALE10',
      items: [{
        product_id: 'p1', product_name: 'Sản phẩm A', product_image: '', price: 100_000,
        quantity: 1, cost_price: 0, origin_url: '', variant_id: 'v1', variant_label: null,
        variant_image: null, variant_cost_price: null,
      }],
    }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('hết lượt sử dụng')

    const names = state.rpcCalls.map(c => c.name)
    expect(names).toEqual([
      'decrement_variant_stock',
      'increment_coupon_usage',
      'increment_variant_stock', // rollback tồn kho đã trừ
    ])
  })
})
