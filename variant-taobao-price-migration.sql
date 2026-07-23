-- Giá gốc Taobao (¥) CHO TỪNG BIẾN THỂ — cùng mục đích với products.taobao_price_cny
-- (products-taobao-price-migration.sql) nhưng ở cấp biến thể, vì các mẫu/màu khác
-- nhau của cùng 1 sản phẩm có thể có giá nhập gốc khác nhau từ Taobao. Dùng để
-- tự tính gợi ý giá vốn riêng cho từng biến thể, xem components/admin/VariantsManager.tsx.
alter table public.product_variants
  add column taobao_price_cny numeric;
