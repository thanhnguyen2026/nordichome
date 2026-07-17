'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Vệt màu mỏng trên cùng khi chuyển trang (kiểu YouTube/GitHub) — thay cho
// spinner to giữa màn hình trước đây, vốn chặn hết nội dung và tạo cảm giác
// "trang chết" ngay cả khi chuyển trang qua next/link chỉ mất một khoảnh khắc.
//
// QUAN TRỌNG: không được thêm loading.tsx cho bất kỳ route nào — chỉ cần
// FILE ĐÓ TỒN TẠI (bất kể render gì, kể cả return null) là Next.js đã tự tạo
// một Suspense boundary và GỠ trang cũ khỏi màn hình ngay khi bắt đầu điều
// hướng, để hiện fallback thay vào — mở màn trắng trong lúc chờ dữ liệu.
// Không có loading.tsx, Next.js giữ nguyên trang cũ (vẫn tương tác được) cho
// tới khi trang mới sẵn sàng rồi mới thay tức thì, nên pathname/searchParams
// đổi ĐÚNG LÀ lúc nội dung mới đã có — dùng thẳng làm tín hiệu "xong" được,
// không cần signal riêng gì thêm.
//
// App Router không có event "route change start" như Pages Router cũ, nên
// phải tự bắt bằng 2 cách: (1) nghe click vào <a> nội bộ / popstate để biết
// lúc BẮT ĐẦU, (2) coi pathname/searchParams đổi là lúc route đã commit xong
// để KẾT THÚC.
function TopProgressBarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    if (hideRef.current) { clearTimeout(hideRef.current); hideRef.current = null }
    if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null }
  }

  const start = () => {
    if (tickRef.current) return // đã đang chạy, không start chồng
    clearTimers()
    setVisible(true)
    setProgress(15)
    // Tiến dần về 85% rồi dừng lại chờ — không bao giờ tự chạm 100% một mình,
    // tránh cảm giác "xong" giả trong khi trang đích còn đang tải dữ liệu.
    tickRef.current = setInterval(() => {
      setProgress(p => (p < 85 ? p + (85 - p) * 0.15 : p))
    }, 200)
    // Lưới an toàn: phòng trường hợp click bắt được nhưng router vì lý do gì
    // đó không thực sự điều hướng (vd lỗi giữa chừng) — đừng để thanh kẹt mãi.
    safetyRef.current = setTimeout(finish, 8000)
  }

  const finish = () => {
    clearTimers()
    setProgress(100)
    hideRef.current = setTimeout(() => { setVisible(false); setProgress(0) }, 200)
  }

  // Route đã commit xong (pathname/query đổi) → coi như tải xong, hoàn tất thanh.
  // Chỉ cố tình chạy theo pathname/searchParams — finish() không cần liệt kê vì
  // nó không phụ thuộc props/state nào ngoài các ref ổn định qua các lần render.
  useEffect(() => {
    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // Gắn listener 1 lần lúc mount — cố tình bỏ start() khỏi deps vì lý do tương tự trên.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // KHÔNG được check e.defaultPrevented ở đây — next/link luôn tự gọi
      // preventDefault() để chặn native navigation trước khi tự điều hướng
      // bằng router, nên lúc bubble tới listener này defaultPrevented luôn
      // đã là true cho MỌI click Link hợp lệ. Bỏ điều kiện này mới bắt được click.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement)?.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      let url: URL
      try { url = new URL(href, window.location.href) } catch { return }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      start()
    }
    // Nút back/forward của trình duyệt không đi qua click <a> — bắt riêng qua
    // popstate để vẫn có thanh tiến trình lúc đó thay vì im lặng không phản hồi.
    const onPopState = () => start()

    document.addEventListener('click', onClick)
    window.addEventListener('popstate', onPopState)
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('popstate', onPopState)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => clearTimers, [])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-[1.5px] pointer-events-none" aria-hidden="true">
      <div
        className="h-full bg-amber-600"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: 'width 200ms ease-out, opacity 200ms ease-out',
        }}
      />
    </div>
  )
}

export default function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <TopProgressBarInner />
    </Suspense>
  )
}
