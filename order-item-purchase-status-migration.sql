-- Trạng thái nhập hàng nội bộ cho từng dòng sản phẩm trong đơn — theo dõi đã
-- đặt hàng bên Taobao chưa / đang về / đã về kho, tách biệt với trạng thái
-- đơn hàng hướng tới khách (orders.status). Chỉ có ý nghĩa với dòng có
-- origin_url (hàng nhập theo đơn), nhưng thêm mặc định cho mọi dòng cho đơn giản.
alter table public.order_items
  add column purchase_status text not null default 'not_ordered'
    check (purchase_status in ('not_ordered', 'ordered', 'arrived'));
