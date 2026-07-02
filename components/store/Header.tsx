'use client'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCartStore } from '@/store/cartStore'
import { supabase } from '@/lib/supabase'
import { Menu, X, ChevronDown, ShoppingCart } from 'lucide-react'

// Chỉ hiện khi bấm icon giỏ hàng — tải JS khi cần thay vì cộng vào bundle
// ban đầu của mọi trang (Header nằm ở mọi trang storefront).
const CartDrawer = dynamic(() => import('./CartDrawer'), { ssr: false })

interface Settings {
  logo_url?: string
  site_name?: string
  hotline?: string
  topbar_text?: string
}

interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
  sort_order: number
  children: Category[]
}

export default function Header({ settings }: { settings: Settings }) {
  const [showCart, setShowCart] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  const items = useCartStore(s => s.items)
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0)

  // Bounce icon giỏ hàng mỗi khi số lượng tăng
  const [bounce, setBounce] = useState(false)
  const prevCount = useRef(cartCount)
  useEffect(() => {
    if (cartCount > prevCount.current) {
      setBounce(true)
      const t = setTimeout(() => setBounce(false), 400)
      prevCount.current = cartCount
      return () => clearTimeout(t)
    }
    prevCount.current = cartCount
  }, [cartCount])

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_visible', true).order('sort_order').then(({ data }) => {
      if (!data) return
      const map = new Map<string, Category>()
      data.forEach(c => map.set(c.id, { ...c, children: [] }))
      const roots: Category[] = []
      data.forEach(c => {
        if (c.parent_id && map.has(c.parent_id)) {
          map.get(c.parent_id)!.children.push(map.get(c.id)!)
        } else if (!c.parent_id) {
          roots.push(map.get(c.id)!)
        }
      })
      // sort_order của danh mục con đánh số lại từ 0 riêng theo từng cha nên
      // bị trùng giá trị giữa các nhóm — sắp xếp tường minh để không phụ
      // thuộc vào thứ tự không ổn định khi ORDER BY có nhiều dòng trùng.
      roots.sort((a, b) => a.sort_order - b.sort_order)
      roots.forEach(r => r.children.sort((a, b) => a.sort_order - b.sort_order))
      setCategories(roots)
    })
  }, [])

  return (
    <>
      {/* Top bar */}
      <div className="bg-stone-800 text-amber-100 text-xs text-center py-2 px-4 tracking-wide">
        {settings.topbar_text || '🚚 Miễn phí vận chuyển HCM cho đơn trên 2.000.000₫'}
        {settings.hotline && <> &nbsp;|&nbsp; 📞 {settings.hotline}</>}
      </div>

      {/* Main header */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 md:h-20 flex items-center">

          {/* Logo — về trang chủ */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            {settings.logo_url && (
              <Image src={settings.logo_url} alt="Logo" width={48} height={48} className="h-12 w-12 object-contain rounded-lg" />
            )}
            <div>
              <div className="text-base md:text-lg font-black text-stone-900 tracking-wide leading-tight">
                {settings.site_name || 'NORDIC HOME'}
              </div>
              <div className="font-serif italic font-semibold text-[10px] text-amber-700 tracking-[2px]">
                Simplify & Enjoy
              </div>
            </div>
          </Link>

          {/* Desktop nav — categories */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {categories.map(cat => (
              <div key={cat.id} className="relative group">
                <a
                  href={`/products?category=${cat.slug}`}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  {cat.name}
                  {cat.children.length > 0 && (
                    <ChevronDown
                      size={13}
                      className="text-stone-400 transition-transform duration-200 group-hover:rotate-180"
                    />
                  )}
                </a>

                {/* Dropdown */}
                {cat.children.length > 0 && (
                  <div className="absolute top-full left-0 pt-2 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 ease-out">
                    <div className="bg-white rounded-xl shadow-lg border border-stone-100 py-2 min-w-[168px]">
                      {cat.children.map(child => (
                        <a
                          key={child.id}
                          href={`/products?category=${child.slug}`}
                          className="flex items-center px-4 py-2.5 text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
                        >
                          {child.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Right: cart + hamburger */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowCart(true)}
              className={`relative bg-stone-100 hover:bg-stone-200 transition rounded-full w-10 h-10 flex items-center justify-center ${
                bounce ? 'animate-cart-bounce' : ''
              }`}
              aria-label="Giỏ hàng"
            >
              <ShoppingCart size={18} className="text-stone-700" />
              {cartCount > 0 && (
                <span className={`absolute -top-1 -right-1 bg-stone-900 text-amber-100 rounded-full w-5 h-5 text-[10px] font-bold flex items-center justify-center ${
                  bounce ? 'animate-cart-pop' : ''
                }`}>
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { setMobileOpen(v => !v); setExpandedId(null) }}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-stone-100 transition"
              aria-label="Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu — accordion */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileOpen ? 'max-h-[80vh] border-t border-stone-100' : 'max-h-0'}`}>
          <div className="bg-white px-4 py-3 space-y-0.5 overflow-y-auto max-h-[75vh]">
            {categories.map(cat => (
              <div key={cat.id}>
                {cat.children.length > 0 ? (
                  <>
                    <button
                      onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
                      className="w-full flex items-center justify-between px-3 py-3 text-sm font-semibold text-stone-700 rounded-lg hover:bg-stone-50 transition"
                    >
                      {cat.name}
                      <ChevronDown
                        size={16}
                        className={`text-stone-400 transition-transform duration-200 ${expandedId === cat.id ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <div className={`overflow-hidden transition-all duration-200 ${expandedId === cat.id ? 'max-h-96' : 'max-h-0'}`}>
                      <div className="ml-3 pl-3 border-l-2 border-stone-100 pb-1 space-y-0.5">
                        <a
                          href={`/products?category=${cat.slug}`}
                          onClick={() => setMobileOpen(false)}
                          className="block px-2 py-2 text-sm text-stone-500 hover:text-stone-900 transition"
                        >
                          Tất cả {cat.name}
                        </a>
                        {cat.children.map(child => (
                          <a
                            key={child.id}
                            href={`/products?category=${child.slug}`}
                            onClick={() => setMobileOpen(false)}
                            className="block px-2 py-2 text-sm text-stone-600 hover:text-stone-900 transition"
                          >
                            {child.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <a
                    href={`/products?category=${cat.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-3 text-sm font-semibold text-stone-700 rounded-lg hover:bg-stone-50 transition"
                  >
                    {cat.name}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      <CartDrawer open={showCart} onClose={() => setShowCart(false)} />
    </>
  )
}
