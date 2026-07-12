-- Sản phẩm luôn miễn phí ship (không tính cân nặng vào phí ship của đơn) —
-- cộng dồn với ngưỡng freeship theo tổng đơn hàng đã có ở settings, không
-- thay thế. Nếu cả giỏ hàng đều là sản phẩm free_shipping thì phí ship = 0.
alter table public.products
  add column free_shipping boolean not null default false;
