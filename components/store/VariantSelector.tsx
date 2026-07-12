'use client'
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import Image from 'next/image'
import { supabase, PUBLIC_VARIANT_COLUMNS } from '@/lib/supabase'

interface Variant {
  id: string
  group_name: string
  option_name: string
  price: number | null
  weight: number
  stock: number
  sku: string | null
  image_url: string | null  // ← THÊM
}

interface Props {
  productId: string
  basePrice: number
  isPreorder?: boolean
  onVariantChange: (variant: Variant | null) => void
}

export default function VariantSelector({ productId, basePrice, isPreorder, onVariantChange }: Props) {
  const [variants, setVariants] = useState<Variant[]>([])
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // basePrice/onVariantChange đến từ component cha và bị tạo lại mỗi lần
  // render (onVariantChange không được useCallback ở nơi gọi) — nếu đưa
  // thẳng vào dependency array bên dưới, effect sẽ chạy lại (và tự ý reset
  // mẫu đã chọn) mỗi khi cha re-render vì lý do khác (VD: đổi số lượng).
  // Đọc qua ref để luôn lấy giá trị mới nhất mà không cần liệt kê vào deps.
  const basePriceRef = useRef(basePrice)
  const onVariantChangeRef = useRef(onVariantChange)
  const isPreorderRef = useRef(isPreorder)
  useLayoutEffect(() => {
    basePriceRef.current = basePrice
    onVariantChangeRef.current = onVariantChange
    isPreorderRef.current = isPreorder
  })

  useEffect(() => {
    supabase.from('product_variants')
      .select(PUBLIC_VARIANT_COLUMNS)
      .eq('product_id', productId)
      .order('sort_order')
      .then(({ data }) => {
        const list = data || []
        setVariants(list)
        setLoading(false)

        // Auto-select variant có giá thấp nhất (trong các variant còn hàng —
        // hàng đặt trước thì coi mọi mẫu đều "còn hàng", không cần tồn kho thật)
        const inStock = isPreorderRef.current ? list : list.filter(v => v.stock > 0)
        const pool = inStock.length > 0 ? inStock : list
        const cheapest = pool.reduce((min, v) => {
          const vPrice = v.price ?? basePriceRef.current
          const minPrice = min.price ?? basePriceRef.current
          return vPrice < minPrice ? v : min
        }, pool[0])

        if (cheapest) {
          setSelected({ [cheapest.group_name]: cheapest.option_name })
          onVariantChangeRef.current(cheapest)
        }
      })
  }, [productId])

  if (loading || variants.length === 0) return null

  const groups = Array.from(new Set(variants.map(v => v.group_name)))

  const handleSelect = (group: string, option: string) => {
    const newSelected = { ...selected, [group]: option }
    setSelected(newSelected)

    const matched = variants.find(v =>
      groups.every(g =>
        newSelected[g] === undefined || v.group_name === g
          ? v.option_name === newSelected[g]
          : true
      ) && v.group_name === groups[groups.length - 1]
        && v.option_name === newSelected[groups[groups.length - 1]]
    ) || variants.find(v =>
      Object.entries(newSelected).some(([g, o]) => v.group_name === g && v.option_name === o)
    ) || null

    onVariantChange(matched || null)
  }

  return (
    <div className="space-y-4 mb-5">
      {groups.map(group => {
        const options = variants.filter(v => v.group_name === group)
        return (
          <div key={group}>
            <div className="text-xs font-semibold text-stone-500 mb-2 uppercase tracking-wide">
              {group}
              {selected[group] && (
                <span className="ml-2 text-stone-700 normal-case font-normal">
                  : {selected[group]}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {options.map(v => {
                const isActive = selected[group] === v.option_name
                const isOutOfStock = v.stock === 0 && !isPreorder
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => handleSelect(group, v.option_name)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-150
                      ${isOutOfStock
                        ? 'border-stone-100 text-stone-300 bg-stone-50 cursor-not-allowed line-through'
                        : isActive
                          ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                          : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50'
                      }`}
                  >
                    {/* Thumbnail ảnh biến thể nếu có */}
                    {v.image_url && (
                      <Image
                        src={v.image_url}
                        alt={v.option_name}
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded object-cover shrink-0"
                      />
                    )}
                    {v.option_name}
                    {v.price && v.price !== basePrice && (
                      <span className={`ml-1 ${isActive ? 'text-amber-300' : 'text-amber-600'}`}>
                        {v.price.toLocaleString('vi-VN')}₫
                      </span>
                    )}
                    {isOutOfStock && <span className="ml-1 text-[10px]">(hết)</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}