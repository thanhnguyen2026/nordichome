export interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
  sort_order: number
  children?: Category[]
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
  cover_image: string
  images: string[]
  in_stock: boolean
  is_preorder: boolean
  is_visible: boolean
  is_featured: boolean
  is_new: boolean
  meta_title: string
  meta_description: string
  category?: Category
}

export interface CartItem {
  product: Product
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
  status: 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled'
  subtotal: number
  total: number
  created_at: string
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  product_name: string
  product_image: string
  price: number
  quantity: number
}

export type OrderStatus = Order['status']

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}