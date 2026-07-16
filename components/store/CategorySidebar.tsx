'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
  sort_order: number
}

interface Props {
  categories: Category[]
  activeSlug?: string
  countMap: Record<string, number>
}

export default function CategorySidebar({ categories, activeSlug, countMap }: Props) {
  const parents = categories.filter(c => !c.parent_id)

  const getDefaultOpen = () => {
    const active = categories.find(c => c.slug === activeSlug)
    if (!active) return null
    return active.parent_id ? active.parent_id : active.id
  }

  const [openParent, setOpenParent] = useState<string | null>(getDefaultOpen)

  return (
    <aside className="w-52 flex-shrink-0 hidden md:block">
      <div className="bg-white rounded-2xl p-4 border border-stone-100 sticky top-24">
        <div className="font-bold text-xs uppercase tracking-widest text-stone-500 mb-3 px-1">Danh mục</div>

        <Link href="/products"
          className={`flex items-center px-3 py-2 rounded-lg text-sm mb-1 transition font-medium ${!activeSlug ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-50'}`}>
          Tất cả sản phẩm
        </Link>

        {parents.map(cat => {
          const children = categories.filter(c => c.parent_id === cat.id)
          const isOpen = openParent === cat.id
          const isActive = activeSlug === cat.slug
          const isChildActive = children.some(c => c.slug === activeSlug)
          const count = countMap[cat.id] || 0

          return (
            <div key={cat.id} className="mb-1">
              <div className="flex items-center gap-1">
                <Link href={`/products?category=${cat.slug}`}
                  className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition ${isActive || isChildActive ? 'bg-stone-100 text-stone-900' : 'text-stone-700 hover:bg-stone-50'}`}>
                  <span>{cat.name}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>
                      {count}
                    </span>
                  )}
                </Link>
                {children.length > 0 && (
                  <button
                    onClick={() => setOpenParent(prev => prev === cat.id ? null : cat.id)}
                    className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition flex-shrink-0"
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                )}
              </div>

              {children.length > 0 && isOpen && (
                <div className="ml-3 mt-1 border-l-2 border-stone-100 pl-2 space-y-0.5">
                  {children.map(child => (
                    <Link key={child.id} href={`/products?category=${child.slug}`}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition ${activeSlug === child.slug ? 'bg-stone-100 font-bold text-stone-900' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'}`}>
                      <span>{child.name}</span>
                      {(countMap[child.id] || 0) > 0 && (
                        <span className="text-[10px] text-stone-600">{countMap[child.id]}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}