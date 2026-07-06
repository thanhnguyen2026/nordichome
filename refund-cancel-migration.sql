-- Lý do hủy đơn, số tiền hoàn lại, và cờ đánh dấu đã khôi phục tồn kho
-- (tránh cộng lại nhiều lần nếu admin đổi trạng thái qua lại)
alter table public.orders
  add column cancel_reason text,
  add column refund_amount numeric not null default 0,
  add column stock_restored boolean not null default false;
