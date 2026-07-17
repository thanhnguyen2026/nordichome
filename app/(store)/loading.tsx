import { Loader2 } from 'lucide-react'

// TopProgressBar (vệt màu mỏng trên cùng, gắn ở app/layout.tsx) báo hiệu đã
// BẮT ĐẦU điều hướng, nhưng nó tự hoàn tất ngay khi pathname đổi — tức là
// ngay khi Suspense boundary này bắt đầu hiện fallback, KHÔNG phải khi trang
// đích tải xong dữ liệu (product page fetch Supabase với force-dynamic nên
// có thể mất một khoảng đáng kể). Từng thử return null ở đây để tránh cảm
// giác "trang chết", nhưng hệ quả là màn hình trắng trơn suốt thời gian đó vì
// không còn tín hiệu tải nào cả. Giữ spinner nhẹ để luôn có gì đó hiển thị.
export default function StoreLoading() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-3 px-4">
      <Loader2 size={28} className="text-amber-600 animate-spin" />
      <p className="text-sm text-stone-400">Đang tải...</p>
    </main>
  )
}
