-- Bảng mã giảm giá
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric not null check (discount_value > 0),
  min_order_amount numeric not null default 0,
  -- Chỉ áp dụng cho discount_type = 'percent', giới hạn số tiền giảm tối đa. Null = không giới hạn.
  max_discount_amount numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  -- Null = không giới hạn số lượt dùng
  usage_limit integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;

-- Chỉ admin (đã đăng nhập) mới đọc/sửa được bảng coupons trực tiếp.
-- Checkout công khai KHÔNG được cấp quyền gì trên bảng này — luôn đi qua
-- API route dùng service role, tránh lộ toàn bộ danh sách mã đang có cho bất kỳ ai.
create policy "coupons_admin_all" on public.coupons
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Ghi lại mã đã dùng + số tiền đã giảm trên từng đơn hàng
alter table public.orders
  add column coupon_code text,
  add column discount_amount numeric not null default 0;
