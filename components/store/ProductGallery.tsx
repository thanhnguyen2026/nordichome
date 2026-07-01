'use client'
import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function ProductGallery({ images }: { images: string[] }) {
  const [active, setActive] = useState(0)

  if (images.length === 0) {
    return (
      <div className="bg-stone-100 rounded-2xl aspect-square flex items-center justify-center">
        <span className="text-7xl">🛋️</span>
      </div>
    )
  }

  const goTo = (i: number) => setActive(Math.max(0, Math.min(images.length - 1, i)))

  return (
    <div className="flex flex-col md:flex-row gap-3">

      {/* ── Thumbnails: horizontal dưới (mobile) / vertical trái (desktop) ── */}
      {images.length > 1 && (
        <div className={`
          flex gap-2
          flex-row overflow-x-auto
          md:flex-col md:overflow-y-auto md:overflow-x-hidden
          md:w-[72px] md:flex-shrink-0 md:max-h-[520px]
          order-2 md:order-1
          scrollbar-thin
        `}>
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`
                relative flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200
                w-[68px] h-[68px] md:w-full md:h-auto md:aspect-square
                ${active === i
                  ? 'border-amber-500 opacity-100 scale-[1.03] shadow-sm'
                  : 'border-transparent opacity-50 hover:opacity-80 hover:border-stone-300'
                }
              `}
            >
              <Image src={img} alt="" fill draggable={false} sizes="68px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* ── Main image — sliding strip ──────────────────────────────────── */}
      <div className="relative bg-stone-50 rounded-2xl aspect-square overflow-hidden flex-1 group order-1 md:order-2 select-none">

        <div
          style={{
            display:    'flex',
            width:      `${images.length * 100}%`,
            height:     '100%',
            transform:  `translateX(calc(-${active} * (100% / ${images.length})))`,
            transition: 'transform 0.48s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {images.map((img, i) => (
            <div key={i} className="relative" style={{ width: `${100 / images.length}%`, flexShrink: 0, height: '100%' }}>
              <Image
                src={img}
                alt=""
                fill
                draggable={false}
                sizes="(max-width: 768px) 100vw, 50vw"
                priority={i === 0}
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {/* Arrows — hiện khi hover */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 disabled:!opacity-0"
            >
              <ChevronLeft size={18} className="text-stone-700" />
            </button>
            <button
              onClick={() => goTo(active + 1)}
              disabled={active === images.length - 1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 disabled:!opacity-0"
            >
              <ChevronRight size={18} className="text-stone-700" />
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => goTo(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === active ? 'w-5 h-1.5 bg-white shadow-sm' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
