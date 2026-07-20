'use client'
import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

interface Props {
  settings: Record<string, string>
}

// Hero "điện ảnh": ảnh Ken Burns (zoom chậm thuần CSS), tiêu đề hiện theo
// từng dòng (clip-reveal), toàn khối trôi chậm hơn + mờ dần khi cuộn
// (parallax) -- tất cả chỉ đụng transform/opacity nên không gây giật layout.
export default function Hero({ settings: s }: Props) {
  const imgWrapRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frameId = 0
    const paint = () => {
      frameId = 0
      const scrollY = window.scrollY
      if (imgWrapRef.current) {
        imgWrapRef.current.style.transform = `translateY(${scrollY * 0.35}px)`
      }
      if (textRef.current) {
        const heroHeight = textRef.current.closest('section')?.offsetHeight || 1
        const progress = Math.min(1, scrollY / heroHeight)
        textRef.current.style.opacity = String(Math.max(0, 1 - progress * 1.4))
        textRef.current.style.transform = `translateY(${scrollY * 0.15}px)`
      }
    }
    const schedule = () => { if (!frameId) frameId = requestAnimationFrame(paint) }
    paint()
    window.addEventListener('scroll', schedule, { passive: true })
    return () => {
      window.removeEventListener('scroll', schedule)
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    // -mt-16 md:-mt-20: header dùng sticky (vẫn chiếm chỗ trong luồng bố cục
    // bình thường, không phải overlay) nên khi header trong suốt, nó chỉ lộ
    // nền trắng của trang phía sau chứ không phải ảnh hero -- kéo Hero lên
    // đúng bằng chiều cao header (h-16 mobile/h-20 desktop) để phần đầu ảnh
    // hero nằm khớp phía sau vùng header, ảnh hero mới thực sự hiện ra xuyên
    // qua header trong suốt.
    <section className="relative -mt-16 md:-mt-20 min-h-[100svh] md:min-h-0 md:h-[560px] flex flex-col justify-end md:justify-center md:items-center overflow-hidden bg-stone-100">
      {s.banner_url && (
        // Ảnh phóng theo chiều cao trên mobile (100svh) nên cần độ phân giải lớn
        // hơn nhiều so với chỉ tính theo chiều rộng viewport, nếu không sẽ mờ.
        <div ref={imgWrapRef} className="absolute inset-0 will-change-transform">
          <Image
            src={s.banner_url}
            alt="Banner"
            fill
            priority
            sizes="(max-width: 768px) 250vw, 100vw"
            className="object-cover animate-ken-burns"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10 md:bg-black/30 md:bg-none" />

      <div ref={textRef} className="relative text-left md:text-center text-white px-6 md:px-4 pb-14 md:pb-0 will-change-transform">
        {s.hero_label && (
          <p className="hero-fade-rise font-serif italic text-sm tracking-[4px] uppercase mb-4 text-amber-200/90">
            {s.hero_label}
          </p>
        )}
        <h1 className="text-[2.75rem] leading-[1.05] md:text-5xl md:leading-tight font-black mb-4">
          <span className="line-reveal-mask">
            <span style={{ animationDelay: '0.1s' }}>{s.hero_title_1 || 'Không gian sống'}</span>
          </span>
          <br />
          <span className="line-reveal-mask text-amber-300">
            <span style={{ animationDelay: '0.28s' }}>{s.hero_title_2 || 'tối giản & sang trọng'}</span>
          </span>
        </h1>
        <p
          className="hero-fade-rise text-stone-200 mb-8 md:mb-7 text-base md:text-sm leading-relaxed max-w-sm md:max-w-none"
          style={{ animationDelay: '0.5s' }}
        >
          {s.hero_subtitle || 'Nội thất phong cách Bắc Âu — thiết kế tinh tế, chất liệu tự nhiên bền vững'}
        </p>
        <Link
          href="/products"
          className="hero-fade-rise btn-sweep block md:inline-block text-center bg-stone-900 text-amber-100 px-8 py-4 md:py-3 rounded-full font-bold text-sm border border-stone-700"
          style={{ ['--sweep-color' as string]: 'rgba(217, 119, 6, 0.35)', animationDelay: '0.65s' }}
        >
          <span className="btn-sweep-label">{s.hero_button_text || 'Khám phá ngay'} →</span>
        </Link>
        {(s.hero_trust_1 || s.hero_trust_2 || s.hero_trust_3) && (
          <div
            className="hero-fade-rise flex flex-wrap items-center justify-start md:justify-center gap-x-5 gap-y-1.5 mt-7 text-white/50 text-xs tracking-wide"
            style={{ animationDelay: '0.8s' }}
          >
            {[s.hero_trust_1, s.hero_trust_2, s.hero_trust_3].filter(Boolean).map((t, i, arr) => (
              <>
                <span key={t}>{t}</span>
                {i < arr.length - 1 && <span key={`sep-${i}`} className="text-white/20">·</span>}
              </>
            ))}
          </div>
        )}
      </div>

      {/* Gợi ý cuộn xuống — chỉ desktop, mobile đã đủ chật với nội dung neo đáy */}
      <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 bottom-6 flex-col items-center gap-1 text-white/70 animate-scroll-cue">
        <span className="text-[10px] tracking-[3px] uppercase">Cuộn xuống</span>
        <ChevronDown size={16} />
      </div>
    </section>
  )
}
