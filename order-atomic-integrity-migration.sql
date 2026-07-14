-- Trừ tồn kho nguyên tử — chỉ trừ nếu đủ hàng tại thời điểm ghi, tránh bán
-- vượt tồn kho khi 2 đơn cùng tranh giành đúng lúc gần hết hàng. Trả về NULL
-- nếu không đủ hàng, caller tự xử lý (không throw exception).
create or replace function public.decrement_variant_stock(p_variant_id uuid, p_qty integer)
returns integer
language sql
as $$
  update public.product_variants
  set stock = stock - p_qty
  where id = p_variant_id and stock >= p_qty
  returning stock;
$$;

create or replace function public.increment_variant_stock(p_variant_id uuid, p_qty integer)
returns integer
language sql
as $$
  update public.product_variants
  set stock = stock + p_qty
  where id = p_variant_id
  returning stock;
$$;

create or replace function public.decrement_product_stock(p_product_id uuid, p_qty integer)
returns integer
language sql
as $$
  update public.products
  set stock = stock - p_qty, in_stock = (stock - p_qty) > 0
  where id = p_product_id and stock >= p_qty
  returning stock;
$$;

create or replace function public.increment_product_stock(p_product_id uuid, p_qty integer)
returns integer
language sql
as $$
  update public.products
  set stock = stock + p_qty, in_stock = (stock + p_qty) > 0
  where id = p_product_id
  returning stock;
$$;

-- Cộng lượt dùng mã nguyên tử — chỉ cộng nếu chưa chạm usage_limit tại thời
-- điểm ghi, tránh vượt giới hạn khi nhiều đơn cùng dùng 1 mã gần hết lượt.
create or replace function public.increment_coupon_usage(p_coupon_id uuid, p_limit integer)
returns integer
language sql
as $$
  update public.coupons
  set used_count = used_count + 1
  where id = p_coupon_id and (p_limit is null or used_count < p_limit)
  returning used_count;
$$;

create or replace function public.decrement_coupon_usage(p_coupon_id uuid)
returns integer
language sql
as $$
  update public.coupons
  set used_count = greatest(used_count - 1, 0)
  where id = p_coupon_id
  returning used_count;
$$;

-- Chống tạo trùng đơn khi khách double-click nút đặt hàng hoặc trình duyệt/
-- mạng tự động thử lại request bị timeout — mỗi lượt checkout gửi kèm 1 khoá
-- duy nhất (sinh 1 lần lúc vào trang), đơn thứ 2 với cùng khoá được trả về
-- đơn đã tạo thay vì tạo mới và trừ kho/coupon thêm lần nữa.
alter table public.orders
  add column idempotency_key text unique;
