'use client'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useCartStore } from '@/store/cartStore'
import { supabase } from '@/lib/supabase'
import { soonestEndingCampaign } from '@/lib/campaignPrice'
import type { Campaign, Category } from '@/types'
import { Menu, X, ChevronDown, ShoppingCart, Search, Truck, Phone, PartyPopper } from 'lucide-react'

// Chỉ hiện khi bấm icon giỏ hàng — tải JS khi cần thay vì cộng vào bundle
// ban đầu của mọi trang (Header nằm ở mọi trang storefront).
const CartDrawer = dynamic(() => import('./CartDrawer'), { ssr: false })

interface Settings {
  logo_url?: string
  site_name?: string
  hotline?: string
  topbar_text?: string
}

interface Props {
  settings: Settings
  // Trang server-render (home, products, chi tiết SP...) đã tự fetch sẵn 2
  // thứ này — truyền xuống để Header khỏi phải tự gọi Supabase phía client,
  // đỡ phải gửi cả thư viện Supabase JS xuống trình duyệt chỉ để làm việc
  // này (Header nằm ở mọi trang nên chi phí bundle nhân lên rất nhiều lần).
  // Trang thuần client (cart, checkout) không truyền thì Header tự fetch
  // như cũ, không có gì thay đổi.
  categories?: Category[]
  campaigns?: Campaign[]
}

// Thanh thông báo trên cùng giờ tự có icon Truck/PartyPopper riêng (JSX, không
// phải ký tự) — nhưng topbar_text là text tự do admin gõ tay ở /admin/settings,
// nhiều khả năng vẫn còn emoji cũ (vd "🚚 Giao hàng...") gõ từ trước khi có icon
// này. Cắt bỏ emoji ở đầu chuỗi để không bị lặp icon, mà không đụng tới phần
// còn lại của text admin đã viết.
const stripLeadingEmoji = (text: string) => text.replace(/^\p{Extended_Pictographic}+\s*/u, '')

export default function Header({ settings, categories: categoriesProp, campaigns: campaignsProp }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [showCart, setShowCart] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [openDesktopId, setOpenDesktopId] = useState<string | null>(null)
  const desktopNavRef = useRef<HTMLElement>(null)
  const [categories, setCategories] = useState<Category[]>(categoriesProp ?? [])
  const [campaigns, setCampaigns] = useState<Campaign[]>(campaignsProp ?? [])
  const [nowRef] = useState(() => new Date())

  // Header trong suốt đè lên hero CHỈ ở trang chủ lúc chưa cuộn — mọi trang
  // khác (không có hero tối màu bên dưới) luôn hiện solid như trước, tránh
  // chữ/nút trắng biến mất trên nền trắng.
  const isHome = pathname === '/'
  const [scrolled, setScrolled] = useState(!isHome)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isHome) { setScrolled(true); return }
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome])
  /* eslint-enable react-hooks/set-state-in-effect */
  const transparent = isHome && !scrolled

  // Đóng dropdown danh mục desktop khi bấm ra ngoài — cần cho việc mở dropdown
  // bằng click (tablet không có hover thật), giữ nguyên hiệu ứng hover cho chuột.
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (desktopNavRef.current && !desktopNavRef.current.contains(e.target as Node)) {
        setOpenDesktopId(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const activeCampaign = soonestEndingCampaign(campaigns, nowRef)
  const campaignDaysLeft = activeCampaign?.ends_at
    ? Math.max(0, Math.ceil((new Date(activeCampaign.ends_at).getTime() - nowRef.getTime()) / 86_400_000))
    : null

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
    if (categoriesProp) return // đã có sẵn từ server, khỏi fetch lại phía client
    supabase.from('categories').select('*').eq('is_visible', true).order('sort_order').then(({ data }) => {
      if (!data) return
      const map = new Map<string, Category>()
      data.forEach(c => map.set(c.id, { ...c, children: [] }))
      const roots: Category[] = []
      data.forEach(c => {
        if (c.parent_id && map.has(c.parent_id)) {
          map.get(c.parent_id)!.children!.push(map.get(c.id)!)
        } else if (!c.parent_id) {
          roots.push(map.get(c.id)!)
        }
      })
      // sort_order của danh mục con đánh số lại từ 0 riêng theo từng cha nên
      // bị trùng giá trị giữa các nhóm — sắp xếp tường minh để không phụ
      // thuộc vào thứ tự không ổn định khi ORDER BY có nhiều dòng trùng.
      roots.sort((a, b) => a.sort_order - b.sort_order)
      roots.forEach(r => r.children!.sort((a, b) => a.sort_order - b.sort_order))
      setCategories(roots)
    })
  }, [categoriesProp])

  useEffect(() => {
    if (campaignsProp) return // đã có sẵn từ server, khỏi fetch lại phía client
    supabase.from('campaigns').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setCampaigns(data as unknown as Campaign[])
    })
  }, [campaignsProp])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    router.push(`/products?q=${encodeURIComponent(q)}`)
    setShowSearch(false)
  }

  return (
    <>
      {/* Top bar — ưu tiên hiện chiến dịch khuyến mãi đang chạy nếu có */}
      <div className={`text-xs text-center py-2 px-4 tracking-wide flex items-center justify-center gap-1.5 flex-wrap ${activeCampaign ? 'bg-amber-500 text-stone-900 font-semibold' : 'bg-stone-800 text-amber-100'}`}>
        <span className="inline-flex items-center gap-1.5">
          {activeCampaign
            ? <PartyPopper size={14} className="shrink-0" />
            : <Truck size={14} className="shrink-0" />}
          {activeCampaign
            ? <>{stripLeadingEmoji(activeCampaign.name)}{campaignDaysLeft != null && ` — còn ${campaignDaysLeft} ngày`}</>
            : stripLeadingEmoji(settings.topbar_text || 'Miễn phí vận chuyển HCM cho đơn trên 2.000.000₫')}
        </span>
        {settings.hotline && (
          <span className="inline-flex items-center gap-1.5 opacity-90">
            <span aria-hidden="true">|</span>
            <Phone size={12} className="shrink-0" />
            {settings.hotline}
          </span>
        )}
      </div>

      {/* Main header — trong suốt đè lên hero ở trang chủ lúc chưa cuộn, chuyển
          nền trắng mờ (backdrop-blur) khi đã cuộn hoặc ở mọi trang khác. */}
      <header className={`sticky top-0 z-50 transition-colors duration-300 ${
        transparent ? 'bg-transparent' : 'bg-white/95 backdrop-blur-md border-b border-stone-100 shadow-sm'
      }`}>
        <div className="max-w-6xl mx-auto px-4 h-16 md:h-20 flex items-center">

          {/* Logo — về trang chủ */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0"
            onClick={() => {
              // Link tới cùng route ("/" → "/") không kích hoạt điều hướng nên
              // Next.js bỏ qua luôn việc cuộn lên đầu — tự cuộn tay cho trường
              // hợp này (đang đứng sẵn ở trang chủ mà bấm lại logo).
              if (pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            {settings.logo_url && (
              <Image src={settings.logo_url} alt="Logo" width={48} height={48} className="h-12 w-12 object-contain rounded-lg" />
            )}
            <div>
              <div className={`text-base md:text-lg font-black tracking-wide leading-tight transition-colors duration-300 ${transparent ? 'text-white' : 'text-stone-900'}`}>
                {settings.site_name || 'NORDIC HOME'}
              </div>
              <div className={`font-serif italic font-semibold text-[10px] tracking-[2px] transition-colors duration-300 ${transparent ? 'text-amber-200' : 'text-amber-700'}`}>
                Simplify & Enjoy
              </div>
            </div>
          </Link>

          {/* Desktop nav — categories */}
          <nav ref={desktopNavRef} className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {categories.map(cat => {
              const hasChildren = !!cat.children?.length
              const isOpen = openDesktopId === cat.id
              return (
                <div key={cat.id} className="relative group">
                  {/* Tên danh mục LUÔN điều hướng thẳng (mouse lẫn tap) — nút mở
                      danh mục con tách riêng ra mũi tên bên cạnh, không còn phải
                      hy sinh việc bấm-để-đi-tới-trang-cha để đổi lấy dropdown mở
                      được trên tablet (không có hover thật). */}
                  <div className={`flex items-center rounded-lg transition-colors ${
                    transparent ? 'hover:bg-white/10' : 'hover:bg-stone-50'
                  }`}>
                    <Link
                      href={`/products?category=${cat.slug}`}
                      className={`px-3 py-2 text-sm font-semibold transition-colors ${
                        transparent ? 'text-white/90 hover:text-white' : 'text-stone-600 hover:text-stone-900'
                      } ${hasChildren ? 'pr-1' : ''}`}
                    >
                      {cat.name}
                    </Link>
                    {hasChildren && (
                      <button
                        type="button"
                        onClick={() => setOpenDesktopId(id => id === cat.id ? null : cat.id)}
                        aria-label={`Xem danh mục con của ${cat.name}`}
                        aria-expanded={isOpen}
                        className="pl-0.5 pr-2.5 py-2 cursor-pointer"
                      >
                        <ChevronDown
                          size={13}
                          className={`transition-transform duration-200 group-hover:rotate-180 ${isOpen ? 'rotate-180' : ''} ${transparent ? 'text-white/70' : 'text-stone-400'}`}
                        />
                      </button>
                    )}
                  </div>

                  {/* Dropdown — mở bằng hover (chuột) HOẶC click/tap vào mũi tên (touch, không có hover thật) */}
                  {hasChildren && (
                    <div className={`absolute top-full left-0 pt-2 transition-all duration-200 ease-out ${
                      isOpen
                        ? 'opacity-100 visible translate-y-0'
                        : 'opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0'
                    }`}>
                      <div className="bg-white rounded-xl shadow-lg border border-stone-100 py-2 min-w-[168px]">
                        {cat.children?.map(child => (
                          <Link
                            key={child.id}
                            href={`/products?category=${child.slug}`}
                            onClick={() => setOpenDesktopId(null)}
                            className="flex items-center px-4 py-2.5 text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Right: search + cart + hamburger */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowSearch(v => !v)}
              className={`transition rounded-full w-11 h-11 flex items-center justify-center ${
                transparent ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
              aria-label="Tìm kiếm"
            >
              <Search size={18} />
            </button>

            <button
              onClick={() => setShowCart(true)}
              className={`relative transition rounded-full w-11 h-11 flex items-center justify-center ${
                transparent ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              } ${bounce ? 'animate-cart-bounce' : ''}`}
              aria-label="Giỏ hàng"
            >
              <ShoppingCart size={18} />
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
              className={`md:hidden w-11 h-11 flex items-center justify-center rounded-full transition ${
                transparent ? 'text-white hover:bg-white/15' : 'text-stone-900 hover:bg-stone-100'
              }`}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Thanh tìm kiếm — bung ra khi bấm icon kính lúp, dùng chung cho desktop/mobile */}
        <div className={`overflow-hidden transition-all duration-200 ease-in-out border-t border-stone-100 ${showSearch ? 'max-h-20' : 'max-h-0 border-t-0'}`}>
          <form onSubmit={submitSearch} className="max-w-6xl mx-auto px-4 py-3 flex gap-2">
            <input
              autoFocus={showSearch}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm sản phẩm... (VD: ghe sofa)"
              className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400"
            />
            <button type="submit" className="bg-stone-900 text-amber-100 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-stone-800 transition">
              Tìm
            </button>
          </form>
        </div>

        {/* Mobile menu — accordion */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileOpen ? 'max-h-[80vh] border-t border-stone-100' : 'max-h-0'}`}>
          <div className="bg-white px-4 py-3 space-y-0.5 overflow-y-auto max-h-[75vh]">
            {categories.map(cat => (
              <div key={cat.id}>
                {!!cat.children?.length ? (
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
                        <Link
                          href={`/products?category=${cat.slug}`}
                          onClick={() => setMobileOpen(false)}
                          className="block px-2 py-2 text-sm text-stone-500 hover:text-stone-900 transition"
                        >
                          Tất cả {cat.name}
                        </Link>
                        {cat.children?.map(child => (
                          <Link
                            key={child.id}
                            href={`/products?category=${child.slug}`}
                            onClick={() => setMobileOpen(false)}
                            className="block px-2 py-2 text-sm text-stone-600 hover:text-stone-900 transition"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <Link
                    href={`/products?category=${cat.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-3 text-sm font-semibold text-stone-700 rounded-lg hover:bg-stone-50 transition"
                  >
                    {cat.name}
                  </Link>
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
