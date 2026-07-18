'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'

export default function ProductGallery({ images, productName }: { images: string[]; productName: string }) {
  const [active, setActive] = useState(0)

  // Vuốt tay để chuyển ảnh trên mobile
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragPx, setDragPx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const touch = useRef<{ startX: number; startY: number; locked: boolean | null; lastX: number; lastT: number; velocity: number }>(
    { startX: 0, startY: 0, locked: null, lastX: 0, lastT: 0, velocity: 0 }
  )
  // active/dragPx mới nhất cho các listener native (tránh closure cũ vì listener chỉ gắn 1 lần)
  // Gán trong useLayoutEffect (không phải trong thân render) — chạy trước khi
  // trình duyệt vẽ lại, giữ nguyên hành vi "luôn mới nhất" nhưng không vi phạm
  // quy tắc React về việc không được sửa ref trong lúc render.
  const activeRef = useRef(active)
  const dragPxRef = useRef(dragPx)
  useLayoutEffect(() => {
    activeRef.current = active
    dragPxRef.current = dragPx
  })

  // useCallback để giữ tham chiếu ổn định — effect vuốt ảnh bên dưới dùng
  // goTo trong touch listener native, nếu goTo đổi tham chiếu mỗi lần render
  // thì effect phải gỡ/gắn lại listener liên tục, có thể ngắt giữa chừng cử
  // chỉ vuốt đang thực hiện dở.
  const goTo = useCallback(
    (i: number) => setActive(Math.max(0, Math.min(images.length - 1, i))),
    [images.length]
  )

  // Khi chọn mẫu mới, ảnh của mẫu đó được đẩy lên vị trí đầu mảng images[0]
  // (xem ProductDetailClient) — nhảy về đúng ảnh đó dù đang xem ảnh nào khác.
  // Reset ngay trong lúc render (pattern "Adjusting state when a prop changes"
  // của React) thay vì trong useEffect, tránh render thừa 1 nhịp.
  const [prevFirstImage, setPrevFirstImage] = useState(images[0])
  if (images[0] !== prevFirstImage) {
    setPrevFirstImage(images[0])
    setActive(0)
  }

  useEffect(() => {
    const el = trackRef.current
    if (!el || images.length <= 1) return

    // React gắn onTouchMove ở chế độ passive theo mặc định, nên gọi
    // preventDefault() bên trong JSX prop sẽ KHÔNG có tác dụng — trình duyệt
    // vẫn tự quyết cuộn dọc trang trước khi tay cầm kịp chặn. Phải gắn
    // listener "thật" (native) với { passive: false } thì preventDefault
    // mới thực sự ngăn được cuộn trang khi đang vuốt ngang.
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      touch.current = { startX: t.clientX, startY: t.clientY, locked: null, lastX: t.clientX, lastT: performance.now(), velocity: 0 }
      setDragging(true)
    }

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      const dx = t.clientX - touch.current.startX
      const dy = t.clientY - touch.current.startY

      if (touch.current.locked === null) {
        // Cần lệch đủ vài px mới xác định hướng, tránh rung tay gây quyết định sai
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        touch.current.locked = Math.abs(dx) > Math.abs(dy)
      }
      if (!touch.current.locked) return

      e.preventDefault()

      // Vận tốc tức thời (px/ms), dùng để nhận biết "vuốt nhanh" (flick) —
      // chỉ tính trên khoảng di chuyển gần nhất để không bị pha loãng bởi
      // đoạn di chuyển chậm lúc đầu cử chỉ
      const now = performance.now()
      const dt = now - touch.current.lastT
      if (dt > 0) touch.current.velocity = (t.clientX - touch.current.lastX) / dt
      touch.current.lastX = t.clientX
      touch.current.lastT = now

      setDragPx(dx)
    }

    const onTouchEnd = () => {
      const width = el.getBoundingClientRect().width || 1
      // Vuốt xa đủ (10% bề rộng) HOẶC vuốt nhanh (flick, >0.35px/ms ~ giật nhẹ
      // ngón tay) dù quãng đường ngắn — khớp cảm giác vuốt ảnh của app gốc
      const distanceThreshold = width * 0.1
      const isFlick = Math.abs(touch.current.velocity) > 0.35 && Math.abs(dragPxRef.current) > 8
      if (touch.current.locked) {
        const movedNext = dragPxRef.current < -distanceThreshold || (isFlick && touch.current.velocity < 0)
        const movedPrev = dragPxRef.current > distanceThreshold || (isFlick && touch.current.velocity > 0)
        if (movedNext && activeRef.current < images.length - 1) goTo(activeRef.current + 1)
        else if (movedPrev && activeRef.current > 0) goTo(activeRef.current - 1)
      }
      setDragging(false)
      setDragPx(0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [images.length, goTo])

  if (images.length === 0) {
    return (
      <div className="bg-stone-100 rounded-2xl aspect-square flex items-center justify-center">
        <ImageOff size={64} className="text-stone-300" />
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-3">

      {/* ── Thumbnails: horizontal dưới (mobile) / vertical trái (desktop) ── */}
      {images.length > 1 && (
        <div
          className={`
          flex gap-2
          flex-row overflow-x-auto overflow-y-hidden touch-auto
          md:flex-col md:overflow-y-auto md:overflow-x-hidden md:touch-pan-y
          md:w-[72px] md:flex-shrink-0 md:max-h-[520px]
          order-2 md:order-1
          scrollbar-thin
        `}>
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Xem ảnh ${i + 1}`}
              className={`
                relative flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200
                w-[68px] h-[68px] md:w-full md:h-auto md:aspect-square
                ${active === i
                  ? 'border-amber-500 opacity-100 scale-[1.03] shadow-sm'
                  : 'border-transparent opacity-50 hover:opacity-80 hover:border-stone-300'
                }
              `}
            >
              <Image src={img} alt={`${productName} — ảnh ${i + 1}`} fill draggable={false} sizes="68px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* ── Main image — sliding strip ──────────────────────────────────── */}
      {/* min-w-0: flex item mặc định không co dưới min-content, mà thanh trượt bên trong
          có width tính theo % số ảnh (có thể vài trăm %) — nếu thiếu min-w-0 item này sẽ
          giữ nguyên độ rộng nội dung và đẩy tràn ngang toàn trang */}
      <div
        ref={trackRef}
        className="relative bg-stone-50 rounded-2xl aspect-square overflow-hidden flex-1 min-w-0 group order-1 md:order-2 select-none touch-pan-y"
      >

        <div
          style={{
            display:    'flex',
            width:      `${images.length * 100}%`,
            height:     '100%',
            transform:  `translateX(calc(-${active} * (100% / ${images.length}) + ${dragPx}px))`,
            transition: dragging ? 'none' : 'transform 0.48s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {images.map((img, i) => (
            <div key={i} className="relative" style={{ width: `${100 / images.length}%`, flexShrink: 0, height: '100%' }}>
              <Image
                src={img}
                alt={images.length > 1 ? `${productName} — ảnh ${i + 1}` : productName}
                fill
                draggable={false}
                sizes="(max-width: 768px) 100vw, 50vw"
                priority={i === 0}
                className="object-contain"
              />
            </div>
          ))}
        </div>

        {/* Arrows — hiện khi hover */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              aria-label="Ảnh trước"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 disabled:!opacity-0"
            >
              <ChevronLeft size={18} className="text-stone-700" />
            </button>
            <button
              onClick={() => goTo(active + 1)}
              disabled={active === images.length - 1}
              aria-label="Ảnh tiếp theo"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 disabled:!opacity-0"
            >
              <ChevronRight size={18} className="text-stone-700" />
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => goTo(i)}
                  aria-label={`Xem ảnh ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === active ? 'w-5 h-1.5 bg-white shadow-sm' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
