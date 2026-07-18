'use client'
import { useEffect, useRef } from 'react'

// Dấu ngoặc kép khổng lồ mờ phía sau khối "Về chúng tôi" trôi chậm hơn chữ
// khi cuộn qua (parallax) -- dùng scroll listener trực tiếp như RevealOnScroll
// thay vì IntersectionObserver để cập nhật liên tục theo vị trí cuộn, không
// chỉ một lần khi vào/ra khung nhìn.
export default function ParallaxQuote() {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frameId = 0
    const paint = () => {
      frameId = 0
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || document.documentElement.clientHeight
      // progress: âm khi phần tử còn ở dưới khung nhìn, 0 khi ở giữa, dương
      // khi đã đi qua giữa -- nhân với hệ số nhỏ để dịch chuyển chậm hơn
      // nội dung xung quanh (cảm giác "trôi" đặc trưng parallax).
      const center = rect.top + rect.height / 2
      const progress = (vh / 2 - center) / vh
      el.style.transform = `translateY(${progress * 70}px)`
    }
    const schedule = () => { if (!frameId) frameId = requestAnimationFrame(paint) }

    paint()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <span ref={ref} className="font-serif text-[18rem] text-white/[0.04] leading-none inline-block will-change-transform">
      &ldquo;
    </span>
  )
}
