'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import { FileText, Save, CheckCircle2, RotateCcw, Eye } from 'lucide-react'

// Nội dung mặc định — khớp với JSX hardcode trong từng page.tsx tương ứng.
// Dùng làm giá trị điền sẵn lần đầu mở trang, và để "Khôi phục mặc định" quay
// lại đúng nội dung gốc (không phải xoá trắng).
const DEFAULTS: Record<string, string> = {
  policy_privacy_html: `<p>Nordic Home tôn trọng và cam kết bảo vệ thông tin cá nhân của khách hàng. Chính sách này giải thích chúng tôi thu thập, sử dụng và bảo vệ thông tin đó như thế nào.</p>
<h2>Thông tin thu thập</h2>
<p>Khi đặt hàng, chúng tôi chỉ thu thập những thông tin cần thiết để xử lý đơn: họ tên, số điện thoại, địa chỉ giao hàng và ghi chú (nếu có).</p>
<h2>Mục đích sử dụng</h2>
<ul>
<li>Xác nhận và giao đơn hàng đến đúng khách hàng.</li>
<li>Liên hệ hỗ trợ khi cần thiết (xác nhận đơn, tư vấn, đổi trả).</li>
<li>Không sử dụng cho mục đích quảng cáo nếu chưa được khách hàng đồng ý.</li>
</ul>
<h2>Bảo mật thông tin</h2>
<p>Thông tin khách hàng được lưu trữ trên hệ thống có kiểm soát truy cập, không chia sẻ cho bên thứ ba ngoài các đơn vị vận chuyển cần thiết để giao hàng.</p>`,
  policy_terms_html: `<p>Khi truy cập và sử dụng website Nordic Home, bạn đồng ý với các điều khoản dưới đây.</p>
<h2>Thông tin sản phẩm</h2>
<p>Chúng tôi cố gắng mô tả và hiển thị hình ảnh sản phẩm chính xác nhất có thể. Màu sắc thực tế có thể chênh lệch nhẹ so với hình ảnh do điều kiện ánh sáng và màn hình hiển thị khác nhau.</p>
<h2>Đặt hàng &amp; thanh toán</h2>
<ul>
<li>Đơn hàng được xác nhận sau khi khách hàng hoàn tất đặt hàng trên website.</li>
<li>Hỗ trợ thanh toán khi nhận hàng (COD) hoặc chuyển khoản ngân hàng.</li>
<li>Sản phẩm đặt trước (Pre-order) có thời gian giao hàng dự kiến 7-10 ngày, sẽ được ghi rõ tại trang sản phẩm.</li>
</ul>
<h2>Thay đổi điều khoản</h2>
<p>Nordic Home có thể cập nhật điều khoản sử dụng khi cần thiết. Phiên bản mới nhất luôn được đăng tải tại trang này.</p>`,
  policy_return_html: `<p>Nordic Home mong muốn mỗi sản phẩm đến tay bạn đều nguyên vẹn và đúng như mô tả. Nếu có sự cố, chúng tôi hỗ trợ đổi/trả theo các điều kiện sau.</p>
<h2>Điều kiện đổi trả</h2>
<ul>
<li>Trong vòng 7 ngày kể từ ngày nhận hàng.</li>
<li>Sản phẩm bị lỗi sản xuất, hư hỏng do vận chuyển, hoặc giao sai mẫu/sai màu so với đơn đặt.</li>
<li>Sản phẩm còn nguyên vẹn, chưa qua sử dụng, còn đầy đủ tem/nhãn (nếu có).</li>
</ul>
<h2>Trường hợp không áp dụng</h2>
<ul>
<li>Sản phẩm đã qua sử dụng hoặc hư hỏng do lỗi từ phía khách hàng.</li>
<li>Khách đổi ý không còn muốn mua sau khi đã nhận hàng (không do lỗi sản phẩm).</li>
</ul>
<h2>Cách thức thực hiện</h2>
<p>Liên hệ trực tiếp qua Messenger/Zalo kèm mã đơn hàng và hình ảnh sản phẩm lỗi — chúng tôi sẽ phản hồi và hướng dẫn quy trình đổi trả trong thời gian sớm nhất.</p>`,
}

const POLICIES = [
  { key: 'policy_privacy_html', label: 'Chính sách bảo mật', path: '/chinh-sach-bao-mat' },
  { key: 'policy_terms_html', label: 'Điều khoản sử dụng', path: '/dieu-khoan-su-dung' },
  { key: 'policy_return_html', label: 'Chính sách đổi trả', path: '/chinh-sach-doi-tra' },
] as const

export default function AdminPolicies() {
  const [content, setContent] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('settings').select('key,value').then(({ data }) => {
      const s = Object.fromEntries(data?.map(r => [r.key, r.value || '']) ?? [])
      setContent({
        policy_privacy_html: s.policy_privacy_html?.trim() || DEFAULTS.policy_privacy_html,
        policy_terms_html: s.policy_terms_html?.trim() || DEFAULTS.policy_terms_html,
        policy_return_html: s.policy_return_html?.trim() || DEFAULTS.policy_return_html,
      })
      setLoading(false)
    })
  }, [])

  const handleSave = async (key: string) => {
    setSaving(key)
    await supabase.from('settings').upsert(
      { key, value: content[key] || '', updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    setSaving(null)
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  const handleReset = (key: string) => {
    setContent(prev => ({ ...prev, [key]: DEFAULTS[key] }))
  }

  if (loading) return <AdminLayout><div className="text-stone-400 text-sm">Đang tải...</div></AdminLayout>

  return (
    <AdminLayout>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center flex-shrink-0">
          <FileText size={18} className="text-amber-100" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black leading-tight">Trang chính sách</h1>
      </div>
      <p className="text-stone-400 text-sm mb-6 ml-[52px]">
        Sửa nội dung Chính sách bảo mật, Điều khoản sử dụng, Chính sách đổi trả — không cần đụng code.
      </p>

      <div className="space-y-6 max-w-3xl">
        {POLICIES.map(({ key, label, path }) => (
          <div key={key} className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-sm">{label}</h2>
              <a href={path} target="_blank" rel="noopener noreferrer"
                className="text-xs text-stone-400 hover:text-stone-700 underline">
                Xem trang thật ↗
              </a>
            </div>
            <p className="text-[11px] text-stone-400 mb-3">
              Hỗ trợ thẻ HTML cơ bản: <code className="bg-stone-100 px-1 rounded">&lt;h2&gt;</code>, <code className="bg-stone-100 px-1 rounded">&lt;p&gt;</code>, <code className="bg-stone-100 px-1 rounded">&lt;ul&gt;&lt;li&gt;</code>.
            </p>
            <textarea
              value={content[key] || ''}
              onChange={e => setContent(prev => ({ ...prev, [key]: e.target.value }))}
              rows={10}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-stone-400 resize-y"
            />
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => handleSave(key)} disabled={saving === key}
                className="flex items-center gap-1.5 bg-stone-900 text-amber-100 rounded-lg px-4 py-2 text-xs font-bold hover:bg-stone-800 transition disabled:opacity-50 cursor-pointer">
                {saving === key ? 'Đang lưu...' : saved === key ? <><CheckCircle2 size={13} /> Đã lưu!</> : <><Save size={13} /> Lưu</>}
              </button>
              <button onClick={() => setPreview(preview === key ? null : key)}
                className="flex items-center gap-1.5 bg-stone-100 rounded-lg px-4 py-2 text-xs font-semibold hover:bg-stone-200 transition cursor-pointer">
                <Eye size={13} /> {preview === key ? 'Ẩn xem trước' : 'Xem trước'}
              </button>
              <button onClick={() => handleReset(key)}
                className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-red-500 transition cursor-pointer ml-auto">
                <RotateCcw size={13} /> Khôi phục mặc định
              </button>
            </div>
            {preview === key && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <div
                  className="text-sm text-stone-600 leading-relaxed space-y-4 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-stone-900 [&_h2]:mt-6 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1"
                  dangerouslySetInnerHTML={{ __html: content[key] || '' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}
