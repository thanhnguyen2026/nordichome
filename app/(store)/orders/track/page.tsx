'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export default function TrackPage() {
  const [code,  setCode]  = useState('')
  const [phone, setPhone] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    const p = phone.trim()
    if (!c || !p) return
    router.push(`/orders/${c}?phone=${encodeURIComponent(p)}`)
  }

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <a href="/" className="flex items-center justify-center gap-2 mb-10">
          <span className="text-xl font-black text-stone-900">NORDIC HOME</span>
        </a>

        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-8">
          <h1 className="text-2xl font-black text-stone-900 mb-1">Theo dõi đơn hàng</h1>
          <p className="text-stone-400 text-sm mb-8">
            Nhập mã đơn và số điện thoại để xem trạng thái đơn hàng của bạn.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1.5">
                Mã đơn hàng
              </label>
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="VD: NH260629A3X7"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm font-mono uppercase outline-none focus:border-stone-400 tracking-wider"
                autoCapitalize="characters"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1.5">
                Số điện thoại đặt hàng
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="VD: 0912345678"
                type="tel"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-stone-900 text-amber-100 font-bold py-3.5 rounded-xl hover:bg-stone-800 transition flex items-center justify-center gap-2 mt-2"
            >
              <Search size={16} />
              Tra cứu đơn hàng
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-stone-400 mt-6">
          Cần hỗ trợ? <a href="/" className="underline hover:text-stone-600">Liên hệ Nordic Home</a>
        </p>
      </div>
    </main>
  )
}
