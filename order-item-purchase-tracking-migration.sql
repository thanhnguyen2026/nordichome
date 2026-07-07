-- Theo dõi tiến độ nhập hàng Taobao cho từng dòng sản phẩm: ngày đặt hàng TQ,
-- mã vận chuyển TQ, ngày về kho. ordered_at/arrived_at tự ghi khi đổi
-- purchase_status nhưng vẫn cho sửa tay (VD: cập nhật hệ thống trễ hơn ngày
-- đặt hàng thực tế).
alter table public.order_items
  add column ordered_at timestamptz,
  add column arrived_at timestamptz,
  add column taobao_tracking_code text;
