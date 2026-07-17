'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// app/(store)/loading.tsx bắn event này lúc nó UNMOUNT (không phải mount) —
// tức đúng lúc Suspense boundary thay fallback bằng nội dung thật, đây mới là
// tín hiệu "đã tải xong" chính xác. Export ra để loading.tsx dùng chung tên.
export const ROUTE_CONTENT_READY_EVENT = 'route-content-ready'

// Vệt màu mỏng trên cùng khi chuyển trang (kiểu YouTube/GitHub) — thay cho
// spinner to giữa màn hình trước đây, vốn chặn hết nội dung và tạo cảm giác
// "trang chết" ngay cả khi chuyển trang qua next/link chỉ mất một khoảnh khắc.
// App Router không có event "route change start" như Pages Router cũ, nên
// phải tự bắt bằng nhiều cách: (1) nghe click vào <a> nội bộ / popstate để
// biết lúc BẮT ĐẦU, (2) coi pathname/searchParams đổi là lúc route đã commit
// xong để KẾT THÚC — NHƯNG chỉ áp dụng cho route không có Suspense boundary
// (vd /admin/**, không có loading.tsx). Route trong (store) có loading.tsx,
// nên pathname đổi chỉ là lúc bắt đầu hiện fallback — phải đợi
// ROUTE_CONTENT_READY_EVENT (fallback unmount) mới thực sự hoàn tất thanh,
// nếu không thanh sẽ biến mất trước khi nội dung thật kịp hiện ra (để lại
// một khoảng trắng chết cho tới khi nội dung tự trồi lên).
function TopProgressBarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // true khi đang đợi ROUTE_CONTENT_READY_EVENT cho route đích (route trong
  // (store), có loading.tsx) — trong lúc này, pathname đổi KHÔNG được coi là
  // đã xong.
  const awaitingContentRef = useRef(false)

  const clearTimers = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    if (hideRef.current) { clearTimeout(hideRef.current); hideRef.current = null }
    if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null }
  }

  const start = (expectContentReadyEvent: boolean) => {
    awaitingContentRef.current = expectContentReadyEvent
    if (tickRef.current) return // đã đang chạy, không start chồng
    clearTimers()
    setVisible(true)
    setProgress(15)
    // Tiến dần về 85% rồi dừng lại chờ — không bao giờ tự chạm 100% một mình,
    // tránh cảm giác "xong" giả trong khi trang đích còn đang tải dữ liệu.
    tickRef.current = setInterval(() => {
      setProgress(p => (p < 85 ? p + (85 - p) * 0.15 : p))
    }, 200)
    // Lưới an toàn: nếu vì lý do gì đó (route đã cache sẵn nên Suspense
    // fallback không bao giờ mount, lỗi khiến loading.tsx không unmount
    // đúng cách...) mà không tín hiệu nào tới, đừng để thanh kẹt mãi ở 85%.
    safetyRef.current = setTimeout(finish, 8000)
  }

  const finish = () => {
    awaitingContentRef.current = false
    clearTimers()
    setProgress(100)
    hideRef.current = setTimeout(() => { setVisible(false); setProgress(0) }, 200)
  }

  // Route đã commit xong (pathname/query đổi). Với route có loading.tsx
  // (đang awaitingContentRef), đây mới chỉ là lúc BẮT ĐẦU hiện fallback —
  // bỏ qua, đợi event thật. Với route không có boundary (vd /admin/**),
  // pathname đổi nghĩa là nội dung mới đã thay xong (Next.js chặn điều
  // hướng tới khi trang đích sẵn sàng nếu không có loading.tsx) → hoàn tất.
  // finish không cần liệt kê trong deps: nó không phụ thuộc props/state nào
  // ngoài các ref ổn định qua các lần render.
  useEffect(() => {
    if (!awaitingContentRef.current) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // Chỉ subscribe 1 lần lúc mount — finish đọc qua closure ổn định nên không
  // cần liệt kê trong deps.
  useEffect(() => {
    const onContentReady = () => finish()
    window.addEventListener(ROUTE_CONTENT_READY_EVENT, onContentReady)
    return () => window.removeEventListener(ROUTE_CONTENT_READY_EVENT, onContentReady)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Gắn listener 1 lần lúc mount — cố tình bỏ start()/pathname khỏi deps vì
  // start là hàm ổn định (chỉ đọc ref) và ta chỉ cần biết pathname HIỆN TẠI
  // tại thời điểm click, không cần re-subscribe mỗi khi nó đổi.
  useEffect(() => {
    // Chỉ route ngoài /admin mới có app/(store)/loading.tsx, tức mới bắn
    // ROUTE_CONTENT_READY_EVENT. /admin/** không có Suspense boundary nào
    // nên phải hoàn tất theo pathname đổi như cũ.
    const startForPathname = (pathname: string) => start(!pathname.startsWith('/admin'))

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
      startForPathname(url.pathname)
    }
    // Nút back/forward của trình duyệt không đi qua click <a> — bắt riêng
    // qua popstate để route trong (store) vẫn có thanh tiến trình thay vì
    // màn trắng trong lúc chờ ROUTE_CONTENT_READY_EVENT. Lúc event này bắn,
    // window.location ĐÃ đổi sang URL đích rồi (khác click, nơi ta còn so
    // được với URL hiện tại) nên không cần/không thể check "có đổi URL không".
    const onPopState = () => startForPathname(window.location.pathname)

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
    <div className="fixed top-0 left-0 right-0 z-[200] h-[3px] pointer-events-none" aria-hidden="true">
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
