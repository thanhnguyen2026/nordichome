-- Lưu riêng quận/huyện và phường/xã của khách (bên cạnh customer_address dạng
-- chuỗi đầy đủ) — cần thiết để gọi API tạo đơn GHTK, vì GHTK bắt buộc nhận
-- tỉnh/quận/phường tách riêng chứ không nhận địa chỉ dạng 1 chuỗi text.
-- Đơn tạo trước migration này sẽ có 2 cột null — không tự tạo đơn GHTK được,
-- vẫn phải nhập mã vận đơn tay như cũ.
alter table public.orders
  add column customer_district text,
  add column customer_ward text;
