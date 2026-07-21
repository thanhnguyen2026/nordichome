import { supabase } from '@/lib/supabase'

export interface RatingSummary {
  avg: number
  count: number
}

// Điểm trung bình + số review ĐÃ DUYỆT cho một tập sản phẩm — dùng để hiện sao
// trên lưới (ProductCard). Gộp ở JS thay vì GROUP BY (PostgREST không group gọn
// qua client, quy mô shop nhỏ nên gộp tay là đủ). Trả map RỖNG nếu không có id
// hoặc lỗi (vd bảng reviews chưa tồn tại) — nơi gọi tự guard, lưới không vỡ.
export async function getRatingSummaries(productIds: string[]): Promise<Record<string, RatingSummary>> {
  if (!productIds.length) return {}
  const { data, error } = await supabase
    .from('reviews')
    .select('product_id, rating')
    .eq('status', 'approved')
    .in('product_id', productIds)
  if (error || !data) return {}

  const acc: Record<string, { sum: number; count: number }> = {}
  for (const r of data as { product_id: string; rating: number }[]) {
    const a = acc[r.product_id] ?? (acc[r.product_id] = { sum: 0, count: 0 })
    a.sum += r.rating
    a.count++
  }
  const out: Record<string, RatingSummary> = {}
  for (const [id, a] of Object.entries(acc)) out[id] = { avg: a.sum / a.count, count: a.count }
  return out
}
