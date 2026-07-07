export interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
  sort_order: number
  image_url?: string | null
  is_visible?: boolean
  children?: Category[]
}

export interface ProductSpec {
  label: string
  value: string
}

export interface ProductContentBlock {
  image_url: string
  text: string
}

export interface Product {
  id: string
  name: string
  slug: string
  sku: string
  category_id: string
  price: number
  sale_price: number | null
  short_desc: string
  description: string
  specs: ProductSpec[]
  content_blocks: ProductContentBlock[]
  cover_image: string
  images: string[]
  video_url?: string | null
  weight: number
  in_stock: boolean
  // Số lượng tồn kho — chỉ áp dụng cho sản phẩm KHÔNG có biến thể (biến thể
  // quản lý tồn kho riêng trong ProductVariant.stock). Null = không theo dõi
  // số lượng, dùng in_stock thủ công như trước giờ.
  stock?: number | null
  is_preorder: boolean
  is_visible: boolean
  is_featured: boolean
  is_new: boolean
  is_bulky: boolean
  meta_title: string
  meta_description: string
  created_at?: string
  updated_at?: string
  category?: Category
  // Chỉ admin mới fetch (không nằm trong PUBLIC_PRODUCT_COLUMNS phía khách)
  cost_price?: number
  origin_url?: string | null
  // Giá gốc Taobao (¥) — dùng để tự tính gợi ý giá vốn, xem lib/taobaoCost.ts
  taobao_price_cny?: number | null
}

export interface ProductVariant {
  id: string
  product_id: string
  group_name: string
  option_name: string
  price: number | null
  cost_price?: number
  stock: number
  weight: number
  sku: string | null
  image_url: string | null
  sort_order: number
}

// Sản phẩm trong giỏ hàng — mở rộng Product với thông tin biến thể được
// AddToCartSection gắn thêm lúc "Thêm vào giỏ" (xem buildCartProduct)
export interface CartProduct extends Product {
  variant_id?: string | null
  variant_label?: string | null
  variant_image?: string | null
  variant_cost_price?: number | null
  selectedVariant?: {
    id: string
    label: string
    image_url: string | null
    cost_price?: number | null
  } | null
}

export interface CartItem {
  product: CartProduct
  quantity: number
}

export interface Order {
  id: string
  order_code: string
  customer_name: string
  customer_phone: string
  customer_address: string
  customer_note: string
  payment_method: 'cod' | 'bank'
  payment_status?: 'pending' | 'paid'
  status: 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled'
  subtotal: number
  total: number
  shipping_fee?: number
  shipping_zone?: string
  total_weight?: number
  tracking_code?: string | null
  revenue?: number
  cost?: number
  profit?: number
  notified_messenger?: boolean
  coupon_code?: string | null
  discount_amount?: number
  cancel_reason?: string | null
  refund_amount?: number
  stock_restored?: boolean
  channel: SalesChannel
  created_at: string
  order_items?: OrderItem[]
}

// Kênh phát sinh đơn — 'website' là đơn tự động qua checkout, các kênh còn
// lại là đơn Facebook/Shopee/TikTok/khác được admin nhập tay để gộp chung
// vào 1 hệ thống theo dõi (thay vì tách rời sang Excel).
export type SalesChannel = 'website' | 'facebook' | 'shopee' | 'tiktok' | 'other'

export const SALES_CHANNEL_LABEL: Record<SalesChannel, string> = {
  website:  'Website',
  facebook: 'Facebook',
  shopee:   'Shopee',
  tiktok:   'TikTok',
  other:    'Khác',
}

export interface Coupon {
  id: string
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_order_amount: number
  max_discount_amount: number | null
  starts_at: string | null
  ends_at: string | null
  usage_limit: number | null
  used_count: number
  is_active: boolean
  created_at: string
}

export interface OrderItem {
  id: string
  order_id?: string
  product_id?: string
  product_name: string
  product_image: string
  price: number
  quantity: number
  cost_price?: number
  origin_url?: string | null
  variant_id?: string | null
  variant_label?: string | null
  purchase_status?: PurchaseStatus
  ordered_at?: string | null
  arrived_at?: string | null
  taobao_tracking_code?: string | null
}

// Trạng thái nhập hàng nội bộ (Taobao) cho từng dòng sản phẩm — khác với
// Order['status'] (trạng thái hướng tới khách hàng).
export type PurchaseStatus = 'not_ordered' | 'ordered' | 'arrived'

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  not_ordered: 'Chưa đặt',
  ordered:     'Đã đặt TQ',
  arrived:     'Đã về kho',
}

// Payload 1 dòng sản phẩm gửi lên POST /api/orders khi đặt hàng — dùng chung
// giữa checkout/page.tsx (nơi gửi) và app/api/orders/route.ts (nơi nhận)
export interface CreateOrderItem {
  product_id: string
  product_name: string
  product_image: string
  price: number
  quantity: number
  cost_price: number
  origin_url: string
  variant_id: string | null
  variant_label: string | null
  variant_image: string | null
  variant_cost_price: number | null
}

export interface CreateOrderPayload {
  customer_name: string
  customer_phone: string
  customer_address: string
  customer_note: string
  payment_method: 'cod' | 'bank'
  shipping_fee?: number
  shipping_zone?: string
  total_weight?: number
  items: CreateOrderItem[]
  coupon_code?: string | null
}

export type OrderStatus = Order['status']

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}