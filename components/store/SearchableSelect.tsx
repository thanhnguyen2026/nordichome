'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { stripDiacritics } from '@/lib/text'

interface Option { code: number; name: string }

interface Props {
  value: string
  onChange: (name: string) => void
  options: Option[]
  placeholder: string
  loadingText?: string
  disabled?: boolean
  loading?: boolean
  required?: boolean
}

// Danh sách tỉnh/quận/phường quá dài để cuộn tay tìm — cho gõ lọc theo tên
// (bỏ dấu, vd gõ "ha" ra cả "Hà Nội"/"Hà Giang") thay vì <select> thường.
export default function SearchableSelect({
  value, onChange, options, placeholder, loadingText, disabled, loading, required,
}: Props) {
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

  const filtered = query.trim()
    ? options.filter(o => stripDiacritics(o.name).includes(stripDiacritics(query.trim())))
    : options

  const isDisabled = disabled || loading

  return (
    <div className="relative" ref={containerRef}>
      <input
        value={open ? query : value}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => { if (!isDisabled) { setOpen(true); setQuery('') } }}
        placeholder={loading ? (loadingText || 'Đang tải...') : placeholder}
        disabled={isDisabled}
        required={required}
        autoComplete="off"
        className="w-full border border-stone-200 rounded-lg pl-3 pr-8 py-2.5 text-sm outline-none
          focus:border-stone-400 bg-white disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed"
      />
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />

      {open && !isDisabled && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-stone-200 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-stone-400">Không tìm thấy</div>
          ) : (
            filtered.map(o => (
              <button
                key={o.code}
                type="button"
                onClick={() => { onChange(o.name); setOpen(false); setQuery('') }}
                className={`block w-full text-left px-3 py-2 text-sm hover:bg-stone-50 transition ${
                  o.name === value ? 'bg-stone-100 font-semibold' : ''
                }`}
              >
                {o.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
