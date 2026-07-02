'use client'
import { useEffect, useRef } from 'react'

interface Props {
  children: React.ReactNode
  index?: number
  className?: string
  // Tắt cho lưới sản phẩm — khách xem hàng cần thấy ảnh rõ ngay, mờ dù chỉ
  // một nhịp cũng dễ bị hiểu nhầm là ảnh tải lỗi/chậm thay vì hiệu ứng chủ đích.
  blur?: boolean
}

const RISE_PX = 26
const BLUR_PX = 6
// Phần tử đạt trạng thái "hiện đầy đủ" sau khi mép trên đã đi qua ngần này % chiều cao viewport
const REVEAL_FRACTION = 0.6
// Mỗi phần tử tiếp theo trong danh sách cần cuộn thêm một chút mới "bắt kịp" — tạo
// cảm giác cuốn chiếu theo cuộn chuột thay vì cả nhóm bật cùng lúc như trước.
const STAGGER_PX = 34

/**
 * Hiện dần khi cuộn tới, tiến độ (opacity/translateY/scale/blur) bám theo % đã
 * cuộn qua thay vì bật/tắt nhị phân. Vẽ ngay một lần khi mount (không chờ
 * IntersectionObserver báo "đã vào khung nhìn") — chờ observer từng khiến
 * phần tử kẹt ở opacity 0 vĩnh viễn nếu callback đầu tiên bị lỡ nhịp lúc
 * layout còn dịch chuyển (ảnh đang tải, font đang swap, v.v.).
 */
export default function RevealOnScroll({ children, index = 0, className = '', blur = true }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.opacity = '1'
      return
    }

    const staggerOffset = Math.min(index, 8) * STAGGER_PX
    let frameId = 0
    let done = false

    const cleanup = () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }

    const paint = () => {
      frameId = 0
      if (done) return
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || document.documentElement.clientHeight
      const progress = Math.min(1, Math.max(0, (vh - rect.top - staggerOffset) / (vh * REVEAL_FRACTION)))

      el.style.opacity = String(progress)
      el.style.transform = `translateY(${(1 - progress) * RISE_PX}px) scale(${0.98 + progress * 0.02})`
      el.style.filter = blur && progress < 1 ? `blur(${(1 - progress) * BLUR_PX}px)` : ''

      if (progress >= 1) {
        done = true
        cleanup()
      }
    }

    function schedule() {
      if (frameId) return
      frameId = requestAnimationFrame(paint)
    }

    paint()
    if (!done) {
      window.addEventListener('scroll', schedule, { passive: true })
      window.addEventListener('resize', schedule, { passive: true })
    }

    return () => {
      cleanup()
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [index, blur])

  return (
    <div ref={ref} className={className} style={{ opacity: 0, willChange: 'transform, opacity, filter' }}>
      {children}
    </div>
  )
}
