-- Giá gốc Taobao (tệ/¥) để tự tính giá vốn theo công thức chung (tỷ giá, hệ
-- số phí, giá ship/kg nằm ở settings) — giúp theo dõi biến động giá gốc và
-- các chi phí quy đổi riêng biệt thay vì chỉ có 1 con số giá vốn cuối cùng.
alter table public.products
  add column taobao_price_cny numeric;
