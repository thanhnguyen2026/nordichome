'use client'

import { useEffect } from 'react'
import { ROUTE_CONTENT_READY_EVENT } from '@/components/store/TopProgressBar'

// Không hiện UI gì cả — TopProgressBar (vệt màu mỏng trên cùng, gắn ở
// app/layout.tsx) là tín hiệu tải trang duy nhất. Component này chỉ tồn tại
// để BÁO cho TopProgressBar biết chính xác lúc nào nội dung thật đã sẵn sàng:
// nó chỉ được mount trong lúc Suspense boundary còn hiện fallback (tức trang
// đích, ví dụ /products với query Supabase force-dynamic, còn đang tải), và
// bị unmount ngay khi nội dung thật thay thế fallback này. Bắn sự kiện lúc
// unmount (không phải mount) để TopProgressBar biết "đã xong" đúng thời
// điểm, thay vì tự đoán hết bằng pathname đổi — pathname đổi sớm hơn nhiều,
// ngay lúc fallback này bắt đầu hiện chứ không phải lúc nó biến mất.
export default function StoreLoading() {
  useEffect(() => {
    return () => {
      window.dispatchEvent(new Event(ROUTE_CONTENT_READY_EVENT))
    }
  }, [])
  return null
}
