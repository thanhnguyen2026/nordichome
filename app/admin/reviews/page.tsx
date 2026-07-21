'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'
import { useConfirm } from '@/components/admin/useConfirm'
import { useToast } from '@/components/admin/useToast'
import { REVIEW_STATUS_LABEL, type ReviewStatus } from '@/types'
import { Star, CheckCircle2, EyeOff, Trash2, MessageSquareReply, ExternalLink, ImagePlus, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface AdminReview {
  id: string
  product_id: string
  author_name: string
  author_phone: string | null
  rating: number
  comment: string
  images: string[]
  is_verified_purchase: boolean
  status: ReviewStatus
  admin_reply: string | null
  created_at: string
  products?: { name: string; slug: string } | null
}

const TABS: { key: ReviewStatus | 'all'; label: string }[] = [
  { key: 'pending',  label: 'Chờ duyệt' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'rejected', label: 'Đã từ chối' },
  { key: 'all',      label: 'Tất cả' },
]

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} sao`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={14} className={i <= value ? 'text-amber-500' : 'text-stone-300'}
          fill={i <= value ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

export default function AdminReviews() {
  const [tab, setTab] = useState<ReviewStatus | 'all'>('pending')
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({})
  const [imgDraft, setImgDraft] = useState<Record<string, string[]>>({})
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirm()
  const { showToast, Toast } = useToast()

  const load = async (status: ReviewStatus | 'all') => {
    setLoading(true)
    setLoadError('')
    try {
      const qs = status === 'all' ? '' : `?status=${status}`
      const res = await fetch(`/api/admin/reviews${qs}`)
      const data = await res.json()
      if (!res.ok) { setLoadError(data.error || 'Không tải được'); setReviews([]); setLoading(false); return }
      setReviews(data.reviews || [])
    } catch {
      setLoadError('Không tải được — kiểm tra kết nối')
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(tab) }, [tab])

  const patch = async (id: string, body: Record<string, unknown>, okMsg: string) => {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { showToast('Lỗi: ' + (data.error || 'Không cập nhật được')); return }
    showToast(okMsg)
    load(tab)
  }

  const remove = async (id: string) => {
    if (!(await confirm('Xoá hẳn đánh giá này?', { danger: true }))) return
    const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' })
    if (!res.ok) { showToast('Không xoá được'); return }
    showToast('Đã xoá')
    load(tab)
  }

  // Ảnh do admin đính hộ khách (khách gửi qua Zalo/Messenger) — tái dùng /api/upload
  // đã có sẵn auth admin + nén sharp. Ảnh vẫn nằm trong review đã kiểm duyệt nên
  // không mở thêm bề mặt tấn công công khai.
  const uploadImage = async (file: File): Promise<string | null> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    return data.url || null
  }

  const imagesOf = (r: AdminReview): string[] => imgDraft[r.id] ?? r.images ?? []

  const addImages = async (r: AdminReview, files: FileList) => {
    setUploadingId(r.id)
    const urls: string[] = []
    for (const f of Array.from(files)) {
      const url = await uploadImage(f)
      if (url) urls.push(url)
    }
    setUploadingId(null)
    if (!urls.length) { showToast('Tải ảnh thất bại'); return }
    const next = [...imagesOf(r), ...urls].slice(0, 8)
    setImgDraft(d => ({ ...d, [r.id]: next }))
    patch(r.id, { images: next }, `Đã thêm ${urls.length} ảnh`)
  }

  const removeImage = (r: AdminReview, idx: number) => {
    const next = imagesOf(r).filter((_, i) => i !== idx)
    setImgDraft(d => ({ ...d, [r.id]: next }))
    patch(r.id, { images: next }, 'Đã xoá ảnh')
  }

  const statusChip = (s: ReviewStatus) => {
    const cls = s === 'approved' ? 'bg-green-50 text-green-700'
      : s === 'rejected' ? 'bg-stone-100 text-stone-500'
      : 'bg-amber-50 text-amber-700'
    return <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>{REVIEW_STATUS_LABEL[s]}</span>
  }

  return (
    <AdminLayout>
      {ConfirmDialog}
      {Toast}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center flex-shrink-0">
          <Star size={18} className="text-amber-100" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black leading-tight">Đánh giá sản phẩm</h1>
      </div>
      <p className="text-stone-400 text-sm mb-6 ml-[52px]">
        Duyệt đánh giá của khách trước khi hiển thị. Bật hiển thị ở Cài đặt (reviews_is_active).
      </p>

      {/* Tabs lọc trạng thái — cuộn ngang trên mobile thay vì wrap (4 tab đủ dài
          để "Tất cả" bị đẩy xuống dòng lẻ loi nếu dùng flex-wrap). */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-sm px-4 py-2 rounded-full font-semibold transition cursor-pointer whitespace-nowrap flex-shrink-0 ${
              tab === t.key ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-400 text-sm">Đang tải...</div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl p-5">
          {loadError}
          <div className="text-stone-500 mt-2 text-xs">
            Nếu bảng chưa tồn tại: chạy <code className="font-mono">reviews-migration.sql</code> trên Supabase trước.
          </div>
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm bg-white rounded-2xl border border-stone-100">
          Không có đánh giá nào.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-stone-800">{r.author_name}</span>
                    {r.is_verified_purchase && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5 font-semibold">
                        <CheckCircle2 size={11} />Đã mua
                      </span>
                    )}
                    {statusChip(r.status)}
                  </div>
                  <div className="text-xs text-stone-400 mt-1">
                    {r.author_phone || 'Không có SĐT'} · {new Date(r.created_at).toLocaleString('vi-VN')}
                  </div>
                </div>
                {r.products && (
                  <Link href={`/products/${r.products.slug}`} target="_blank"
                    className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-amber-700 transition shrink-0">
                    <ExternalLink size={12} />{r.products.name}
                  </Link>
                )}
              </div>

              <Stars value={r.rating} />
              {r.comment && <p className="text-sm text-stone-600 leading-relaxed mt-2 whitespace-pre-line">{r.comment}</p>}

              {/* Ảnh đính kèm — admin thêm hộ khách (khách gửi qua chat). Hiển thị công khai cùng review sau khi duyệt. */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {imagesOf(r).map((src, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-stone-100">
                    <Image src={src} alt={`Ảnh ${i + 1}`} fill sizes="64px" className="object-cover" />
                    <button
                      onClick={() => removeImage(r, i)}
                      aria-label="Xoá ảnh"
                      className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-black/80 cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <label className={`inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 border border-dashed border-stone-300 rounded-lg px-3 h-16 cursor-pointer hover:bg-stone-50 transition ${uploadingId === r.id ? 'opacity-60 pointer-events-none' : ''}`}>
                  {uploadingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                  {uploadingId === r.id ? 'Đang tải…' : 'Thêm ảnh'}
                  <input
                    type="file" accept="image/*" multiple className="hidden"
                    onChange={e => { if (e.target.files?.length) addImages(r, e.target.files); e.target.value = '' }}
                  />
                </label>
              </div>

              {/* Phản hồi của shop */}
              <div className="mt-3 flex gap-2 items-start">
                <input
                  value={replyDraft[r.id] ?? r.admin_reply ?? ''}
                  onChange={e => setReplyDraft(d => ({ ...d, [r.id]: e.target.value }))}
                  placeholder="Phản hồi của shop (không bắt buộc)…"
                  className="flex-1 border border-stone-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-stone-400"
                />
                <button onClick={() => patch(r.id, { admin_reply: replyDraft[r.id] ?? r.admin_reply ?? '' }, 'Đã lưu phản hồi')}
                  className="inline-flex items-center gap-1 text-xs bg-stone-100 rounded-lg px-3 py-2 hover:bg-stone-200 cursor-pointer shrink-0">
                  <MessageSquareReply size={13} />Lưu
                </button>
              </div>

              {/* Hành động duyệt */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {r.status !== 'approved' && (
                  <button onClick={() => patch(r.id, { status: 'approved' }, 'Đã duyệt')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-green-600 text-white rounded-lg px-3 py-2 hover:bg-green-700 transition cursor-pointer">
                    <CheckCircle2 size={14} />Duyệt
                  </button>
                )}
                {r.status !== 'rejected' && (
                  <button onClick={() => patch(r.id, { status: 'rejected' }, 'Đã ẩn')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-stone-100 text-stone-700 rounded-lg px-3 py-2 hover:bg-stone-200 transition cursor-pointer">
                    <EyeOff size={14} />Ẩn
                  </button>
                )}
                <button onClick={() => remove(r.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-red-50 text-red-600 rounded-lg px-3 py-2 hover:bg-red-100 transition cursor-pointer ml-auto">
                  <Trash2 size={14} />Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
