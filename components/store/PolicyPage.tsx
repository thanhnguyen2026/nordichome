import { supabase } from '@/lib/supabase'
import Header from '@/components/store/Header'
import Footer from '@/components/store/Footer'

// Bọc chung cho các trang chính sách tĩnh (bảo mật/điều khoản/đổi trả) — cùng
// 1 kiểu layout đơn giản, tránh lặp lại 3 lần việc fetch settings + Header/Footer.
// `htmlKey` trỏ tới key trong bảng settings (VD policy_privacy_html) — nếu admin
// đã lưu nội dung tuỳ chỉnh ở đó thì ưu tiên hiển thị, không thì dùng children
// (nội dung mặc định hardcode trong từng page.tsx) làm fallback.
export default async function PolicyPage({ title, htmlKey, children }: { title: string; htmlKey: string; children: React.ReactNode }) {
  const { data } = await supabase.from('settings').select('key,value')
  const s = Object.fromEntries(data?.map(r => [r.key, r.value]) ?? [])
  const override = s[htmlKey]?.trim()

  return (
    <>
      <Header settings={s} />
      <main className="max-w-2xl mx-auto px-4 py-14">
        <h1 className="font-serif text-3xl font-semibold text-stone-900 mb-8">{title}</h1>
        <div className="text-sm text-stone-600 leading-relaxed space-y-4 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-stone-900 [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {override ? <div dangerouslySetInnerHTML={{ __html: override }} /> : children}
        </div>
      </main>
      <Footer settings={s} />
    </>
  )
}
