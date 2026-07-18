'use client'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { ChevronDown, ImageOff } from 'lucide-react'
import { stripDiacritics } from '@/lib/text'
import { Product } from '@/types'

interface Props {
  value: string
  onChange: (productId: string) => void
  products: Product[]
  placeholder?: string
}

// Danh mục càng nhiều sản phẩm, cuộn tay tìm trong <select> gốc càng dễ chọn
// nhầm (không thấy ảnh, không lọc được theo tên). Cho gõ lọc theo tên (bỏ
// dấu) + hiện ảnh thumbnail từng sản phẩm trong danh sách, giống cách chọn
// tỉnh/quận/phường (SearchableSelect) nhưng thêm ảnh để nhận diện nhanh hơn.
export default function ProductSearchSelect({ value, onChange, products, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const selected = products.find(p => p.id === value)
  const filtered = query.trim()
    ? products.filter(p => stripDiacritics(p.name).includes(stripDiacritics(query.trim())))
    : products

  return (
    <div className="relative flex-1" ref={containerRef}>
      <input
        value={open ? query : (selected?.name || '')}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => { setOpen(true); setQuery('') }}
        placeholder={placeholder || '-- Chọn sản phẩm --'}
        autoComplete="off"
        className="w-full border rounded-lg pl-2 pr-6 py-1.5 text-xs outline-none focus:border-stone-400 bg-white"
      />
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-stone-400" />

      {open && (
        <div className="absolute z-20 mt-1 w-72 max-h-72 overflow-y-auto bg-white border border-stone-200 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-stone-500">Không tìm thấy sản phẩm</div>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id); setOpen(false); setQuery('') }}
                className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs hover:bg-stone-50 transition ${
                  p.id === value ? 'bg-stone-100 font-semibold' : ''
                }`}
              >
                <div className="relative w-9 h-9 rounded-md overflow-hidden bg-stone-100 flex-shrink-0">
                  {p.cover_image ? (
                    <Image src={p.cover_image} alt={p.name} fill sizes="36px" className="object-cover" />
                  ) : (
                    <ImageOff size={14} className="absolute inset-0 m-auto text-stone-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{p.name}</div>
                  <div className="text-stone-400 tabular-nums">
                    {(p.sale_price ?? p.price).toLocaleString('vi-VN')}₫
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
