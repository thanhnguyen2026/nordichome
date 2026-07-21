'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { Star, CheckCircle2, PencilLine, X, ChevronLeft, ChevronRight } from 'lucide-react'

// Cột review an toàn phía khách (khớp PUBLIC_REVIEW_COLUMNS trong lib/supabase.ts)
// — KHÔNG có author_phone/status.
export interface PublicReview {
  id: string
  author_name: string
  rating: number
  comment: string
  images: string[]
  is_verified_purchase: boolean
  admin_reply?: string | null
  created_at: string
}

interface Props {
  productId: string
  reviews: PublicReview[]
  avg: number
  count: number
}

// Dãy sao — size tuỳ chỗ dùng. Sao đặc (amber) tới `value`, còn lại rỗng (stone).
function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-hidden="true">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(value) ? 'text-amber-500' : 'text-stone-300'}
          fill={i <= Math.round(value) ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  )
}

const fmtDate = (iso: string) => {
  // new Date(iso) có tham số nên là hàm thuần (khác new Date() rỗng) — dùng được trong render.
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN')
}

export default function ProductReviews({ productId, reviews, avg, count }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  // Ảnh đang xem phóng to (lightbox) — theo từng review, có prev/next trong cùng review.
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null)

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      else if (e.key === 'ArrowRight') setLightbox(l => l ? { ...l, index: (l.index + 1) % l.images.length } : l)
      else if (e.key === 'ArrowLeft') setLightbox(l => l ? { ...l, index: (l.index - 1 + l.images.length) % l.images.length } : l)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  // Khoá cuộn nền khi lightbox mở. KHÔNG dùng overflow:hidden vì iOS Safari bỏ
  // qua nó (nền vẫn cuộn được, và khi nền cuộn thì phần tử fixed trên iOS bị
  // lệch vùng chạm → nút đóng mất tác dụng). Cách chắc ăn: ghim body bằng
  // position:fixed và bù lại đúng vị trí cuộn, khôi phục khi đóng.
  useEffect(() => {
    if (!lightbox) return
    const scrollY = window.scrollY
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [lightbox])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (rating < 1) { setError('Vui lòng chọn số sao'); return }
    if (!name.trim()) { setError('Vui lòng nhập tên của bạn'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, author_name: name, phone, rating, comment }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Có lỗi xảy ra, vui lòng thử lại'); setSubmitting(false); return }
      setDone(true)
    } catch {
      setError('Không gửi được, vui lòng kiểm tra kết nối')
      setSubmitting(false)
    }
  }

  return (
    <section id="reviews" className="max-w-3xl mx-auto mb-16">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-serif text-2xl font-semibold text-stone-900">Đánh giá từ khách hàng</h2>
        <div className="flex-1 border-t border-stone-100" />
      </div>

      {/* Tổng quan điểm — chỉ hiện khi đã có review duyệt (Cách B: sản phẩm chưa
          có đánh giá không phô "0.0 sao" trống trải). */}
      {count > 0 && (
        <div className="flex items-center gap-4 mb-8 bg-stone-50 rounded-2xl p-5">
          <div className="text-center">
            <div className="text-4xl font-black text-stone-900 leading-none tabular-nums">{avg.toFixed(1)}</div>
            <div className="mt-1.5"><Stars value={avg} size={15} /></div>
            <div className="text-xs text-stone-500 mt-1">{count} đánh giá</div>
          </div>
        </div>
      )}

      {/* Danh sách review */}
      {count > 0 ? (
        <ul className="space-y-6 mb-8">
          {reviews.map(r => (
            <li key={r.id} className="border-b border-stone-100 pb-6 last:border-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="font-bold text-sm text-stone-800">{r.author_name}</span>
                {r.is_verified_purchase && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5 font-semibold">
                    <CheckCircle2 size={11} />Đã mua hàng
                  </span>
                )}
                <span className="text-xs text-stone-400 ml-auto">{fmtDate(r.created_at)}</span>
              </div>
              <Stars value={r.rating} />
              {r.comment && (
                <p className="text-sm text-stone-600 leading-relaxed mt-2 whitespace-pre-line">{r.comment}</p>
              )}
              {r.images?.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {r.images.map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightbox({ images: r.images, index: i })}
                      aria-label={`Xem to ảnh đánh giá ${i + 1}`}
                      className="relative w-20 h-20 rounded-lg overflow-hidden bg-stone-100 cursor-zoom-in group/img"
                    >
                      <Image src={src} alt={`Ảnh đánh giá ${i + 1}`} fill sizes="80px" className="object-cover transition-transform duration-300 group-hover/img:scale-105" />
                    </button>
                  ))}
                </div>
              )}
              {r.admin_reply && (
                <div className="mt-3 ml-3 pl-3 border-l-2 border-amber-200 text-sm text-stone-600">
                  <span className="font-semibold text-amber-700">Phản hồi từ shop:</span> {r.admin_reply}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-500 mb-6">Chưa có đánh giá nào — hãy là người đầu tiên chia sẻ cảm nhận của bạn!</p>
      )}

      {/* Nút mở form + form accordion */}
      {done ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <CheckCircle2 size={16} />
          Cảm ơn bạn! Đánh giá đang chờ duyệt và sẽ hiển thị sau khi được xác nhận.
        </div>
      ) : (
        <>
          <button
            onClick={() => setFormOpen(o => !o)}
            className="inline-flex items-center gap-2 text-sm font-bold tracking-wide border border-stone-900 rounded-full px-5 py-2.5 hover:bg-stone-900 hover:text-white transition"
          >
            {formOpen ? <><X size={15} />Đóng</> : <><PencilLine size={15} />Viết đánh giá</>}
          </button>

          <div className={`overflow-hidden transition-all duration-300 ${formOpen ? 'max-h-[720px] mt-5' : 'max-h-0'}`}>
            <form onSubmit={submit} className="bg-stone-50 rounded-2xl p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1.5">Đánh giá của bạn *</label>
                <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRating(i)}
                      onMouseEnter={() => setHover(i)}
                      aria-label={`${i} sao`}
                      className="p-0.5 cursor-pointer"
                    >
                      <Star
                        size={28}
                        className={i <= (hover || rating) ? 'text-amber-500' : 'text-stone-300'}
                        fill={i <= (hover || rating) ? 'currentColor' : 'none'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-500 block mb-1">Họ tên *</label>
                  <input
                    value={name} onChange={e => setName(e.target.value)}
                    autoComplete="name" maxLength={60}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 block mb-1">Số điện thoại</label>
                  <input
                    value={phone} onChange={e => setPhone(e.target.value)}
                    type="tel" inputMode="tel" autoComplete="tel"
                    placeholder="Để nhận huy hiệu “Đã mua hàng”"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
                  />
                  <p className="text-[11px] text-stone-500 mt-1">Chỉ dùng để đối chiếu đơn — không hiển thị công khai.</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">Cảm nhận của bạn</label>
                <textarea
                  value={comment} onChange={e => setComment(e.target.value)}
                  rows={4} maxLength={2000}
                  placeholder="Sản phẩm dùng thế nào, chất lượng, giao hàng…"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 resize-none"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="bg-stone-900 text-amber-100 rounded-full px-6 py-2.5 text-sm font-bold hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? 'Đang gửi…' : 'Gửi đánh giá'}
              </button>
            </form>
          </div>
        </>
      )}
      {/* Lightbox — bấm ảnh review để xem to; đóng bằng nền/×/Esc, chuyển bằng ←/→.
          Render qua Portal thẳng vào <body>: nếu để lồng trong cây trang, một số
          trình duyệt (đặc biệt Safari iOS với Header dùng backdrop-blur) có bug
          khiến phần tử fixed/z-index cao vẫn bị phần tử "sticky + backdrop-filter"
          phía trên nuốt mất sự kiện chạm dù nằm dưới về mặt DOM — thoát hẳn ra
          ngoài mọi ancestor là cách khắc phục chắc chắn, không phụ thuộc trình
          duyệt/thiết bị cụ thể. */}
      {lightbox && createPortal(
        <div
          className="fixed inset-0 z-[300] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Đóng"
            className="absolute top-4 right-4 text-white/80 hover:text-white cursor-pointer p-2"
          >
            <X size={28} />
          </button>
          {/* Không chặn propagation ở khung ảnh: bấm BẤT KỲ đâu (kể cả trên ảnh
              hay vùng letterbox tối quanh ảnh) đều đóng lightbox — chỉ 2 mũi tên
              prev/next bên dưới mới chặn để không đóng khi chuyển ảnh. pointer-events-none
              để cú chạm xuyên thẳng xuống overlay xử lý đóng. */}
          <div className="relative w-[92vw] h-[85vh] pointer-events-none">
            <Image
              src={lightbox.images[lightbox.index]}
              alt="Ảnh đánh giá phóng to"
              fill
              sizes="92vw"
              className="object-contain"
            />
          </div>
          {lightbox.images.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, index: (l.index - 1 + l.images.length) % l.images.length } : l) }}
                aria-label="Ảnh trước"
                className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 cursor-pointer"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, index: (l.index + 1) % l.images.length } : l) }}
                aria-label="Ảnh sau"
                className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 cursor-pointer"
              >
                <ChevronRight size={24} />
              </button>
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-sm tabular-nums">
                {lightbox.index + 1} / {lightbox.images.length}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </section>
  )
}
