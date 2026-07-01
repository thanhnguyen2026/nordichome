'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  children: React.ReactNode
  index?: number
  className?: string
}

/** Fade-in + slide-up khi phần tử cuộn vào viewport, có stagger theo index. */
export default function RevealOnScroll({ children, index = 0, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`${visible ? 'reveal' : 'opacity-0'} ${className}`}
      style={visible ? { animationDelay: `${Math.min(index, 10) * 70}ms` } : undefined}
    >
      {children}
    </div>
  )
}
