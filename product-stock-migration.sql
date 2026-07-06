-- Số lượng tồn kho cho sản phẩm KHÔNG có biến thể (sản phẩm có biến thể đã
-- quản lý tồn kho riêng từng mẫu trong product_variants.stock).
-- Null = không theo dõi số lượng, dùng cờ in_stock thủ công như trước giờ.
alter table public.products
  add column stock integer;
