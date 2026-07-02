import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Cột an toàn để hiển thị cho khách hàng — KHÔNG bao gồm cost_price, origin_url
// (Supabase RLS chỉ lọc theo dòng, không lọc theo cột, nên select('*') ở phía
// khách sẽ đẩy thẳng giá vốn/link nguồn Taobao ra trình duyệt của mọi khách).
export const PUBLIC_PRODUCT_COLUMNS =
  'id,name,slug,sku,category_id,price,sale_price,short_desc,description,' +
  'cover_image,images,video_url,weight,in_stock,is_preorder,is_visible,' +
  'is_featured,is_new,is_bulky,meta_title,meta_description,created_at,updated_at'

export const PUBLIC_VARIANT_COLUMNS =
  'id,product_id,group_name,option_name,price,stock,sku,weight,image_url,sort_order'