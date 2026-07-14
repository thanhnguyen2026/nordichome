import { Loader2 } from 'lucide-react'

export default function StoreLoading() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-3 px-4">
      <Loader2 size={28} className="text-amber-600 animate-spin" />
      <p className="text-sm text-stone-400">Đang tải...</p>
    </main>
  )
}
