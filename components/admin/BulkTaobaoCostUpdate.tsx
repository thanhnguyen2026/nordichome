'use client'
import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { calcTaobaoCost } from '@/lib/taobaoCost'
import { Product, ProductVariant } from '@/types'
import { X, Calculator, TrendingUp, TrendingDown } from 'lucide-react'

interface CostSettings { rate: number; fee: number; shipPerKg: number }

interface Props {
  products: Product[]
  // Đủ cột (cost_price/price/taobao_price_cny/weight) — dùng để tính lại giá
  // vốn/giá bán cho TỪNG BIẾN THỂ có giá gốc Taobao riêng, không chỉ cấp SP.
  variants: ProductVariant[]
  costSettings: CostSettings | null
  onClose: () => void
  onApplied: () => void
  confirm: (msg: string, opts?: { danger?: boolean }) => Promise<boolean>
  showToast: (msg: string) => void
}

interface Row {
  // Phân biệt để biết ghi vào bảng nào lúc áp dụng — 'products' hay
  // 'product_variants' — id vẫn là khoá chính của đúng bảng đó.
  kind: 'product' | 'variant'
  id: string
  name: string
  oldCost: number
  oldPrice: number
  // Giá trị admin có thể sửa tay trước khi áp dụng — mặc định là số gợi ý
  // tính từ công thức, nhưng không bắt buộc dùng nguyên.
  costInput: string
  priceInput: string
  include: boolean
}

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + '₫'

// Gợi ý giá bán mới = giá vốn mới × (1 + % lãi CŨ) — giữ nguyên tỷ lệ lợi
// nhuận admin đã đặt trước đó, không phải một con số tuỳ tiện. Chưa có giá
// vốn cũ (mới thêm, cost=0) thì không có % lãi để giữ — mặc định gợi ý giá
// bán = đúng giá vốn mới (0% lãi), admin tự sửa tay theo ý muốn.
function suggestPrice(newCost: number, oldCost: number, oldPrice: number): number {
  if (oldCost <= 0) return newCost
  const markupPct = (oldPrice - oldCost) / oldCost
  return Math.round((newCost * (1 + markupPct)) / 1000) * 1000
}

export default function BulkTaobaoCostUpdate({ products, variants, costSettings, onClose, onApplied, confirm, showToast }: Props) {
  const productById = useMemo(() => new Map(products.map(p => [p.id, p])), [products])

  const eligible = useMemo(() => {
    const productRows = products
      .filter(p => p.taobao_price_cny != null && p.taobao_price_cny > 0)
      .map(p => ({
        kind: 'product' as const,
        id: p.id,
        name: p.name,
        priceCny: p.taobao_price_cny!,
        weight: p.weight || 0,
        oldCost: p.cost_price || 0,
        oldPrice: p.price || 0,
      }))

    // Biến thể tự có giá gốc Taobao riêng — giá bán biến thể để trống (null)
    // nghĩa là kế thừa giá sản phẩm (xem placeholder "Trống = giá SP" ở
    // VariantsManager), nên fallback về giá sản phẩm cha khi tính % lãi cũ.
    const variantRows = variants
      .filter(v => v.taobao_price_cny != null && v.taobao_price_cny > 0)
      .map(v => {
        const parent = productById.get(v.product_id)
        return {
          kind: 'variant' as const,
          id: v.id,
          name: `${parent?.name ?? 'Sản phẩm đã xoá'} — ${v.option_name}`,
          priceCny: v.taobao_price_cny!,
          weight: v.weight || 0,
          oldCost: v.cost_price || 0,
          oldPrice: v.price ?? (parent?.price ?? 0),
        }
      })

    return [...productRows, ...variantRows]
  }, [products, variants, productById])

  const [rows, setRows] = useState<Row[]>(() => eligible.map(e => {
    const newCost = costSettings
      ? calcTaobaoCost({
          priceCny:      e.priceCny,
          weightKg:      e.weight,
          exchangeRate:  costSettings.rate,
          feePercent:    costSettings.fee,
          shippingPerKg: costSettings.shipPerKg,
        })
      : e.oldCost
    return {
      kind:       e.kind,
      id:         e.id,
      name:       e.name,
      oldCost:    e.oldCost,
      oldPrice:   e.oldPrice,
      costInput:  String(newCost),
      priceInput: String(suggestPrice(newCost, e.oldCost, e.oldPrice)),
      include:    true,
    }
  }))

  const [applying, setApplying] = useState(false)

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))

  const toggleAll = (include: boolean) => setRows(prev => prev.map(r => ({ ...r, include })))

  const included = rows.filter(r => r.include)

  // Luôn cập nhật CẢ giá vốn lẫn giá bán CÙNG LÚC trong 1 lần bấm — cố tình
  // không cho tách "chỉ giá vốn" / "chỉ giá bán" thành 2 hành động riêng: nếu
  // đổi giá vốn trước rồi quay lại đổi giá bán sau (nhất là ở lần mở bảng
  // khác), % lãi gốc để tính gợi ý giá bán đã bị ghi đè mất, không còn cách
  // nào suy đúng lại — xem lịch sử trao đổi. Áp dụng cùng lúc trong 1 lần mở
  // bảng thì oldCost/oldPrice vẫn luôn đúng, không có rủi ro này.
  const apply = async () => {
    if (included.length === 0) { showToast('Chưa chọn dòng nào'); return }
    if (!(await confirm(`Áp dụng giá vốn + giá bán mới cho ${included.length} dòng đã chọn?`))) return

    setApplying(true)
    const results = await Promise.all(included.map(r => {
      const patch = {
        cost_price: Math.round(Number(r.costInput) || 0),
        price:      Math.round(Number(r.priceInput) || 0),
      }
      const table = r.kind === 'product' ? 'products' : 'product_variants'
      return supabase.from(table).update(patch).eq('id', r.id)
    }))
    setApplying(false)

    const failed = results.filter(r => r.error).length
    if (failed > 0) showToast(`${failed}/${included.length} dòng cập nhật lỗi`)
    else showToast(`Đã cập nhật giá vốn + giá bán cho ${included.length} dòng`)
    onApplied()
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-stone-400" />
            <div>
              <h2 className="font-bold text-sm">Cập nhật giá vốn / giá bán theo tỷ giá Taobao</h2>
              <p className="text-xs text-stone-400 mt-0.5">
                {costSettings
                  ? `Tỷ giá hiện tại: 1¥ = ${costSettings.rate.toLocaleString('vi-VN')}đ · Phí ${costSettings.fee}% · Ship ${costSettings.shipPerKg.toLocaleString('vi-VN')}đ/kg — bao gồm cả sản phẩm và biến thể có giá gốc Taobao`
                  : 'Chưa cấu hình công thức Taobao ở Cài đặt'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {eligible.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8">
              Không có sản phẩm hoặc biến thể nào đã nhập Giá Taobao gốc (¥) để tính lại.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-stone-500">
                  <input type="checkbox" checked={included.length === rows.length}
                    onChange={e => toggleAll(e.target.checked)} />
                  Chọn tất cả ({rows.length})
                </label>
                <span className="text-stone-300">·</span>
                <span className="text-stone-500">Sửa tay số liệu trong bảng nếu muốn giá khác gợi ý</span>
              </div>

              <div className="space-y-2">
                {rows.map(r => {
                  const newCost = Number(r.costInput) || 0
                  const newPrice = Number(r.priceInput) || 0
                  const profitPct = newCost > 0 ? ((newPrice - newCost) / newCost) * 100 : null
                  return (
                    <div key={r.id} className={`border rounded-xl p-3 transition ${r.include ? 'border-stone-200 bg-white' : 'border-stone-100 bg-stone-50 opacity-60'}`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={r.include} onChange={e => setRow(r.id, { include: e.target.checked })}
                          className="mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-2">
                            <p className="text-sm font-semibold text-stone-700 truncate">{r.name}</p>
                            {r.kind === 'variant' && (
                              <span className="text-[10px] font-semibold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded flex-shrink-0">biến thể</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold text-stone-400 uppercase block mb-1">
                                Giá vốn: {fmt(r.oldCost)} →
                              </label>
                              <input
                                value={r.costInput}
                                onChange={e => setRow(r.id, { costInput: e.target.value.replace(/\D/g, '') })}
                                className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-stone-400 tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-stone-400 uppercase block mb-1">
                                Giá bán: {fmt(r.oldPrice)} →
                              </label>
                              <input
                                value={r.priceInput}
                                onChange={e => setRow(r.id, { priceInput: e.target.value.replace(/\D/g, '') })}
                                className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-stone-400 tabular-nums"
                              />
                            </div>
                            <div className="flex items-end">
                              {profitPct != null && (
                                <span className={`flex items-center gap-1 text-[11px] font-semibold ${profitPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {profitPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                  {profitPct.toFixed(0)}% lãi
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer — 1 hành động duy nhất, không có gì tự áp dụng ngoài ý admin */}
        {eligible.length > 0 && (
          <div className="flex items-center justify-end px-6 py-4 border-t border-stone-100 flex-shrink-0">
            <button onClick={apply} disabled={applying}
              className="text-xs font-bold bg-stone-900 text-amber-100 rounded-lg px-4 py-2.5 hover:bg-stone-800 transition disabled:opacity-40 cursor-pointer">
              {applying ? 'Đang áp dụng...' : `Cập nhật toàn bộ (${included.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
