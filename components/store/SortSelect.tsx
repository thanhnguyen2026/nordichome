'use client'

interface Props {
  defaultValue?: string
}

export default function SortSelect({ defaultValue = 'newest' }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const url = new URL(window.location.href)
    url.searchParams.set('sort', e.target.value)
    window.location.href = url.toString()
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-stone-400 whitespace-nowrap">Sắp xếp:</span>
      <select
        defaultValue={defaultValue}
        onChange={handleChange}
        className="border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 bg-white outline-none focus:border-stone-400 cursor-pointer"
      >
        <option value="newest">Mới nhất</option>
        <option value="price_asc">Giá: Thấp → Cao</option>
        <option value="price_desc">Giá: Cao → Thấp</option>
      </select>
    </div>
  )
}