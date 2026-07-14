'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle size={40} className="text-amber-600" />
      <div>
        <h1 className="text-xl font-black text-stone-900 mb-1">Đã có lỗi xảy ra</h1>
        <p className="text-stone-400 text-sm max-w-xs mx-auto">
          Rất tiếc, trang này gặp sự cố. Vui lòng thử lại hoặc quay về trang chủ.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="bg-stone-900 text-amber-100 px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-stone-800 transition"
        >
          Thử lại
        </button>
        <Link href="/" className="border border-stone-300 text-stone-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-stone-50 transition">
          Về trang chủ
        </Link>
      </div>
    </main>
  )
}
