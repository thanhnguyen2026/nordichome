'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Loader2 } from 'lucide-react'
import { ORDER_STATUS_LABEL, OrderStatus } from '@/types'

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

interface FoundOrder {
  order_code: string
  created_at: string
  status: OrderStatus
  total: number
}

export default function TrackPage() {
  const [mode, setMode] = useState<'code' | 'phone'>('code')

  const [code,  setCode]  = useState('')
  const [phone, setPhone] = useState('')
  const router = useRouter()

  const [lookupPhone, setLookupPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<FoundOrder[] | null>(null)
  const [searched, setSearched] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    const p = phone.trim()
    if (!c || !p) return
    router.push(`/orders/${c}?phone=${encodeURIComponent(p)}`)
  }

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = lookupPhone.trim()
    if (!p) return
    setLoading(true)
    setSearched(false)
    try {
      const res = await fetch('/api/orders/lookup-by-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: p }),
      })
      const data = await res.json()
      setResults(data.orders ?? [])
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-10">
          <span className="text-xl font-black text-stone-900">NORDIC HOME</span>
        </Link>

        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-8">
          {mode === 'code' ? (
            <>
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

              <button
                type="button"
                onClick={() => { setMode('phone'); setResults(null); setSearched(false) }}
                className="w-full text-center text-xs text-stone-400 hover:text-stone-600 underline mt-5 transition"
              >
                Quên mã đơn hàng?
              </button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black text-stone-900 mb-1">Tìm đơn theo số điện thoại</h1>
              <p className="text-stone-400 text-sm mb-8">
                Nhập số điện thoại đã dùng khi đặt hàng, chúng tôi sẽ hiện các đơn gần đây.
              </p>

              <form onSubmit={handleLookup} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-stone-500 block mb-1.5">
                    Số điện thoại đặt hàng
                  </label>
                  <input
                    value={lookupPhone}
                    onChange={e => setLookupPhone(e.target.value)}
                    placeholder="VD: 0912345678"
                    type="tel"
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-stone-900 text-amber-100 font-bold py-3.5 rounded-xl hover:bg-stone-800 transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Tìm đơn hàng
                </button>
              </form>

              {searched && (
                <div className="mt-5">
                  {results && results.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-stone-400 mb-2">
                        Tìm thấy {results.length} đơn hàng:
                      </p>
                      {results.map(o => (
                        <a
                          key={o.order_code}
                          href={`/orders/${o.order_code}?phone=${encodeURIComponent(lookupPhone.trim())}`}
                          className="flex items-center justify-between gap-3 bg-stone-50 hover:bg-stone-100 rounded-xl px-4 py-3 transition"
                        >
                          <div className="min-w-0">
                            <p className="font-mono font-bold text-sm text-stone-900">{o.order_code}</p>
                            <p className="text-xs text-stone-400">
                              {new Date(o.created_at).toLocaleDateString('vi-VN')} · {ORDER_STATUS_LABEL[o.status]}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-amber-700 flex-shrink-0">{fmt(o.total)}</p>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-400 text-center py-2">
                      Không tìm thấy đơn hàng nào với số điện thoại này.
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => { setMode('code'); setResults(null); setSearched(false) }}
                className="w-full text-center text-xs text-stone-400 hover:text-stone-600 underline mt-5 transition"
              >
                ← Tôi có mã đơn hàng
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-stone-400 mt-6">
          Cần hỗ trợ? <Link href="/" className="underline hover:text-stone-600">Liên hệ Nordic Home</Link>
        </p>
      </div>
    </main>
  )
}
