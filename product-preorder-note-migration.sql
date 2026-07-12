-- Ghi chú thời gian đặt trước tùy chỉnh theo từng sản phẩm (VD: "7-10 ngày",
-- "15-20 ngày") — trước đây hardcode cứng "7-10 ngày" trong code, không đổi
-- được khi thời gian nhập hàng thực tế thay đổi theo từng sản phẩm.
alter table public.products
  add column preorder_note text;
