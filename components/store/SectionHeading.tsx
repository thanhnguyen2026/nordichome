import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface Action { href: string; label: string }

interface Props {
  number: string
  eyebrow: string
  title: string
  align?: 'left' | 'center'
  // Vị trí số thứ tự khổng lồ mờ phía sau khi align="left" — đổi bên xen kẽ
  // giữa các section liên tiếp để tạo nhịp điệu khác nhau, tránh 4 section
  // liền nhau lặp y hệt 1 công thức bố cục.
  numberSide?: 'left' | 'right'
  italic?: boolean
  action?: Action
}

// Tiêu đề section kiểu editorial: số thứ tự serif khổng lồ mờ phía sau +
// đường kẻ mảnh, thay cho công thức "eyebrow chữ nghiêng + tiêu đề căn giữa"
// lặp lại y hệt ở mọi section trước đây.
export default function SectionHeading({ number, eyebrow, title, align = 'center', numberSide = 'left', italic, action }: Props) {
  if (align === 'center') {
    return (
      <div className="relative text-center mb-10">
        <span aria-hidden="true" className="pointer-events-none select-none absolute -top-9 left-1/2 -translate-x-1/2 font-serif font-black text-stone-900/[0.05] text-[7rem] md:text-[9rem] leading-none">
          {number}
        </span>
        <p className="relative font-serif italic font-semibold text-sm tracking-[4px] uppercase text-amber-700 mb-2">{eyebrow}</p>
        <h2 className={`relative font-serif text-3xl md:text-4xl font-semibold text-stone-900 ${italic ? 'italic font-normal' : ''}`}>
          {title}
        </h2>
        <span className="relative block h-px w-16 bg-stone-300 mx-auto mt-5" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="relative mb-8">
      <span
        aria-hidden="true"
        className={`pointer-events-none select-none absolute -top-8 font-serif font-black text-stone-900/[0.05] text-[6rem] md:text-[8rem] leading-none ${
          numberSide === 'left' ? '-left-1 md:-left-2' : 'right-0'
        }`}
      >
        {number}
      </span>
      <div className="relative flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="font-serif italic font-semibold text-sm tracking-[3px] uppercase text-amber-700 mb-1">{eyebrow}</p>
          <h2 className="font-serif text-3xl font-semibold text-stone-900">{title}</h2>
        </div>
        {action && (
          <Link
            href={action.href}
            className="link-underline group inline-flex items-center gap-1.5 text-sm font-semibold text-stone-700 hover:text-amber-700 transition-colors"
          >
            {action.label}
            <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        )}
      </div>
    </div>
  )
}
