'use client'
import Image from 'next/image'
import Link from 'next/link'
import { X, ShoppingCart, ImageOff } from 'lucide-react'
import { useCartStore, itemKey } from '@/store/cartStore'

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, removeItem, updateQty, total } = useCartStore()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200]">
      <div onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <b className="text-base">Giỏ hàng ({items.reduce((s, i) => s + i.quantity, 0)})</b>
          <button onClick={onClose} aria-label="Đóng giỏ hàng"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-stone-500">
              <ShoppingCart size={28} className="text-stone-300" />
              Giỏ hàng trống
            </div>
          ) : (
            items.map(item => {
              const key = itemKey(item)
              const variantLabel = item.product.variant_label
              const variantImage = item.product.variant_image
              const displayImage = variantImage || item.product.cover_image
              return (
                <div key={key} className="py-3 border-b border-stone-100">
                  {/* Bấm ảnh/tên để xem lại trang chi tiết sản phẩm — chỉ bọc
                      phần này trong Link, không bọc nút số lượng/xoá bên dưới
                      để tránh vô tình điều hướng khi bấm các nút đó. */}
                  <Link href={`/products/${item.product.slug}`} onClick={onClose} className="flex gap-3">
                    <div className="relative w-14 h-14 bg-stone-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {displayImage
                        ? <Image src={displayImage} alt={item.product.name} fill sizes="56px" className="object-cover" />
                        : <ImageOff size={20} className="text-stone-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs leading-tight hover:underline">{item.product.name}</div>
                      {/* Hiển thị biến thể đã chọn */}
                      {variantLabel && (
                        <div className="text-[10px] text-stone-600 mt-0.5">{variantLabel}</div>
                      )}
                      <div className="text-amber-700 font-bold text-xs mt-0.5">
                        {fmt(item.product.sale_price ?? item.product.price)}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 mt-1 ml-[68px]">
                    <button onClick={() => updateQty(key, item.quantity - 1)}
                      className="w-6 h-6 rounded-full border border-stone-200 text-sm">−</button>
                    <span className="text-xs">{item.quantity}</span>
                    <button onClick={() => updateQty(key, item.quantity + 1)}
                      className="w-6 h-6 rounded-full border border-stone-200 text-sm">+</button>
                    <button onClick={() => removeItem(key)}
                      className="ml-auto text-red-500 text-xs">Xoá</button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="p-4 border-t border-stone-100">
            <div className="flex justify-between mb-3">
              <span className="font-semibold">Tổng:</span>
              <span className="font-black text-lg text-amber-700">{fmt(total())}</span>
            </div>
            <Link href="/checkout"
              className="block w-full bg-stone-900 text-amber-100 text-center font-bold py-3 rounded-lg text-sm">
              Đặt hàng →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}