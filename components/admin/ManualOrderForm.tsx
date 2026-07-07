'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Product, SalesChannel, SALES_CHANNEL_LABEL } from '@/types'
import ChannelIcon from './ChannelIcon'

interface VariantRow {
  id: string
  product_id: string
  group_name: string
  option_name: string
  price: number | null
  cost_price: number | null
  stock: number
  image_url: string | null
}

interface ItemRow {
  product_id: string
  variant_id: string
  quantity: string
  price: string
}

const emptyItem: ItemRow = { product_id: '', variant_id: '', quantity: '1', price: '' }

interface Props {
  onClose: () => void
  onCreated: () => void
}

export default function ManualOrderForm({ onClose, onCreated }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  const [channel, setChannel] = useState<SalesChannel>('facebook')
  const [channelMenuOpen, setChannelMenuOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bank'>('cod')
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('paid')
  const [shippingFee, setShippingFee] = useState('0')
  const [rows, setRows] = useState<ItemRow[]>([{ ...emptyItem }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('*').eq('is_visible', true).order('name'),
      supabase.from('product_variants').select('id, product_id, group_name, option_name, price, cost_price, stock, image_url'),
    ]).then(([p, v]) => {
      setProducts((p.data as unknown as Product[]) || [])
      setVariants((v.data as unknown as VariantRow[]) || [])
      setLoadingProducts(false)
    })
  }, [])

  const variantsOf = (productId: string) => variants.filter(v => v.product_id === productId)

  const updateRow = (i: number, patch: Partial<ItemRow>) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  const onSelectProduct = (i: number, productId: string) => {
    const product = products.find(p => p.id === productId)
    const defaultPrice = product ? (product.sale_price ?? product.price) : 0
    updateRow(i, { product_id: productId, variant_id: '', price: String(defaultPrice) })
  }

  const onSelectVariant = (i: number, variantId: string) => {
    const variant = variants.find(v => v.id === variantId)
    updateRow(i, { variant_id: variantId, price: variant?.price != null ? String(variant.price) : rows[i].price })
  }

  const addRow = () => setRows(prev => [...prev, { ...emptyItem }])
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i))

  const subtotal = rows.reduce((s, r) => s + (Number(r.price) || 0) * (Number(r.quantity) || 0), 0)
  const total = subtotal + (Number(shippingFee) || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!customerName || !customerPhone || !customerAddress) {
      setError('Vui lòng nhập đầy đủ tên, SĐT, địa chỉ khách hàng')
      return
    }
    const validRows = rows.filter(r => r.product_id)
    if (validRows.length === 0) {
      setError('Vui lòng chọn ít nhất 1 sản phẩm')
      return
    }

    setSubmitting(true)

    const items = validRows.map(r => {
      const product = products.find(p => p.id === r.product_id)!
      const variant = r.variant_id ? variants.find(v => v.id === r.variant_id) : null
      return {
        product_id:    r.product_id,
        product_name:  product.name,
        product_image: variant?.image_url || product.cover_image,
        price:         Number(r.price) || 0,
        quantity:      Math.max(1, Math.round(Number(r.quantity) || 1)),
        cost_price:    variant?.cost_price ?? product.cost_price ?? 0,
        origin_url:    product.origin_url ?? null,
        variant_id:    r.variant_id || null,
        variant_label: variant ? `${variant.group_name}: ${variant.option_name}` : null,
      }
    })

    const res = await fetch('/api/admin/orders/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        customer_note: customerNote,
        channel, payment_method: paymentMethod, payment_status: paymentStatus,
        shipping_fee: Number(shippingFee) || 0,
        items,
      }),
    })
    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) { setError(data.error || 'Có lỗi xảy ra'); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-lg">➕ Thêm đơn thủ công</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="text-xs font-semibold text-stone-500 block mb-1">Kênh bán *</label>
            {/* <select><option> gốc không render được icon bên trong — dùng
                dropdown tự chế để hiện logo thật từng kênh thay vì text thuần. */}
            <button type="button" onClick={() => setChannelMenuOpen(o => !o)}
              className="w-full flex items-center gap-2 border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 bg-white">
              <ChannelIcon channel={channel} />
              <span>{SALES_CHANNEL_LABEL[channel]}</span>
            </button>
            {channelMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setChannelMenuOpen(false)} />
                <div className="absolute z-20 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
                  {(['facebook', 'shopee', 'tiktok', 'other'] as SalesChannel[]).map(c => (
                    <button key={c} type="button"
                      onClick={() => { setChannel(c); setChannelMenuOpen(false) }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-stone-50 transition ${c === channel ? 'bg-stone-50 font-semibold' : ''}`}>
                      <ChannelIcon channel={c} />
                      <span>{SALES_CHANNEL_LABEL[c]}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Tên khách *</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">SĐT *</label>
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" required />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-stone-500 block mb-1">Địa chỉ *</label>
              <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" required />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-stone-500 block mb-1">Ghi chú</label>
              <input value={customerNote} onChange={e => setCustomerNote(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-2">Sản phẩm *</label>
            {loadingProducts ? (
              <div className="text-xs text-stone-400">Đang tải sản phẩm...</div>
            ) : (
              <div className="space-y-2">
                {rows.map((row, i) => {
                  const rowVariants = row.product_id ? variantsOf(row.product_id) : []
                  return (
                    <div key={i} className="flex gap-2 items-start bg-stone-50 rounded-lg p-2">
                      <select value={row.product_id} onChange={e => onSelectProduct(i, e.target.value)}
                        className="flex-1 border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-stone-400">
                        <option value="">-- Chọn sản phẩm --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {rowVariants.length > 0 && (
                        <select value={row.variant_id} onChange={e => onSelectVariant(i, e.target.value)}
                          className="w-32 border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-stone-400">
                          <option value="">-- Mẫu --</option>
                          {rowVariants.map(v => (
                            <option key={v.id} value={v.id}>{v.group_name}: {v.option_name}</option>
                          ))}
                        </select>
                      )}
                      <input type="text" inputMode="numeric" value={row.quantity}
                        onChange={e => updateRow(i, { quantity: e.target.value.replace(/\D/g, '') })}
                        placeholder="SL" className="w-14 border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-stone-400" />
                      <input type="text" inputMode="numeric" value={row.price}
                        onChange={e => updateRow(i, { price: e.target.value.replace(/\D/g, '') })}
                        placeholder="Giá" className="w-24 border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-stone-400" />
                      {rows.length > 1 && (
                        <button type="button" onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 px-1">✕</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <button type="button" onClick={addRow}
              className="mt-2 bg-stone-100 border border-stone-200 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-stone-200 transition">
              + Thêm dòng
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Thanh toán</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as 'cod' | 'bank')}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400">
                <option value="cod">COD</option>
                <option value="bank">Chuyển khoản</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Trạng thái TT</label>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as 'pending' | 'paid')}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400">
                <option value="paid">Đã nhận tiền</option>
                <option value="pending">Chờ thanh toán</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Phí ship</label>
              <input type="text" inputMode="numeric" value={shippingFee}
                onChange={e => setShippingFee(e.target.value.replace(/\D/g, ''))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
            </div>
          </div>

          <div className="flex justify-between items-center text-sm font-bold border-t border-stone-100 pt-3">
            <span>Tổng cộng</span>
            <span className="text-amber-700">{total.toLocaleString('vi-VN')}₫</span>
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting}
              className="bg-stone-800 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-stone-700 transition disabled:opacity-50">
              {submitting ? 'Đang lưu...' : '💾 Tạo đơn'}
            </button>
            <button type="button" onClick={onClose}
              className="border border-stone-200 px-6 py-2.5 rounded-lg text-sm hover:bg-stone-50 transition">
              Huỷ
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
