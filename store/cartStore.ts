import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CartItem, Product } from '@/types'

// Key duy nhất cho mỗi dòng giỏ hàng: productId + variantId
export const itemKey = (item: CartItem) => {
  const vid = (item.product as any).variant_id ?? null
  return vid ? `${item.product.id}__${vid}` : item.product.id
}

interface CartStore {
  items: CartItem[]
  hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
  addItem: (item: CartItem) => void
  removeItem: (key: string) => void
  updateQty: (key: string, qty: number) => void
  clearCart: () => void
  total: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,
      setHasHydrated: (state) => set({ hasHydrated: state }),

      addItem: (item) => set(s => {
        const key = itemKey(item)
        const ex = s.items.find(i => itemKey(i) === key)
        return ex
          ? { items: s.items.map(i => itemKey(i) === key ? { ...i, quantity: i.quantity + item.quantity } : i) }
          : { items: [...s.items, item] }
      }),

      removeItem: (key) => set(s => ({
        items: s.items.filter(i => itemKey(i) !== key),
      })),

      updateQty: (key, qty) => set(s => ({
        items: qty <= 0
          ? s.items.filter(i => itemKey(i) !== key)
          : s.items.map(i => itemKey(i) === key ? { ...i, quantity: qty } : i),
      })),

      clearCart: () => set({ items: [] }),

      total: () => get().items.reduce(
        (s, i) => s + (i.product.sale_price ?? i.product.price) * i.quantity, 0
      ),
    }),
    {
      name: 'nordic-cart',
      skipHydration: true,
    }
  )
)