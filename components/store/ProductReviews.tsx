'use client'
import { useState } from 'react'
import Image from 'next/image'
import { Star, CheckCircle2, PencilLine, X } from 'lucide-react'

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
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-stone-100">
                      <Image src={src} alt={`Ảnh đánh giá ${i + 1}`} fill sizes="80px" className="object-cover" />
                    </div>
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
    </section>
  )
}
