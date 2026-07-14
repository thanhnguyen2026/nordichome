import Link from 'next/link'
import { PackageOpen } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <PackageOpen size={44} className="text-stone-300" strokeWidth={1} />
      <div>
        <h1 className="text-xl font-black text-stone-900 mb-1">Không tìm thấy trang</h1>
        <p className="text-stone-400 text-sm max-w-xs mx-auto">
          Trang bạn tìm không tồn tại hoặc đã được di chuyển.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/products" className="bg-stone-900 text-amber-100 px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-stone-800 transition">
          Xem sản phẩm
        </Link>
        <Link href="/" className="border border-stone-300 text-stone-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-stone-50 transition">
          Về trang chủ
        </Link>
      </div>
    </main>
  )
}
