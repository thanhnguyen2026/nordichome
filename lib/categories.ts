import { supabase } from '@/lib/supabase'
import type { Category } from '@/types'

// Dựng cây danh mục cha-con phía server (dùng cho Header) — tránh phải gửi
// toàn bộ thư viện Supabase JS xuống trình duyệt chỉ để làm việc này, vì
// Header nằm ở mọi trang nên chi phí bundle nhân lên theo mọi lượt xem trang.
export async function getCategoryTree(): Promise<Category[]> {
  const { data } = await supabase.from('categories').select('*').eq('is_visible', true).order('sort_order')
  if (!data) return []

  const map = new Map<string, Category>()
  data.forEach(c => map.set(c.id, { ...c, children: [] }))
  const roots: Category[] = []
  data.forEach(c => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children!.push(map.get(c.id)!)
    } else if (!c.parent_id) {
      roots.push(map.get(c.id)!)
    }
  })

  // sort_order của danh mục con đánh số lại từ 0 riêng theo từng cha nên bị
  // trùng giá trị giữa các nhóm — sắp xếp tường minh để không phụ thuộc vào
  // thứ tự không ổn định khi ORDER BY có nhiều dòng trùng.
  roots.sort((a, b) => a.sort_order - b.sort_order)
  roots.forEach(r => r.children!.sort((a, b) => a.sort_order - b.sort_order))
  return roots
}
