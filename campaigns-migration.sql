-- Khuyến mãi có thể áp cho toàn bộ sản phẩm hoặc chỉ sản phẩm được chọn (scope
-- + product_ids). Dùng jsonb cho product_ids thay vì bảng join riêng — quy mô
-- catalog nhỏ, không cần truy vấn quan hệ phức tạp.
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric not null,
  scope text not null default 'all' check (scope in ('all', 'selected')),
  product_ids jsonb not null default '[]'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Storefront (anon key) cần đọc trực tiếp để tính giá hiển thị — giống cách
-- products/categories đã cho anon SELECT. Chỉ admin (authenticated) mới được
-- tạo/sửa/xoá khuyến mãi.
alter table public.campaigns enable row level security;

create policy "Ai cũng xem được khuyến mãi"
  on public.campaigns for select
  to anon, authenticated
  using (true);

create policy "Chỉ admin được quản lý khuyến mãi"
  on public.campaigns for all
  to authenticated
  using (true)
  with check (true);
