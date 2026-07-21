-- Đánh giá sản phẩm từ khách — CÓ kiểm duyệt (pending → approved/rejected).
-- KHÔNG seed giả: bảng bắt đầu rỗng, chỉ dòng đã duyệt mới hiển thị ra khách.
-- author_phone chỉ dùng để đối chiếu "đã mua hàng" ở phía server, KHÔNG hiển thị
-- công khai (cùng lý do cost_price/origin_url bị loại khỏi cột public của products).
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  author_name text not null,
  author_phone text,
  rating int not null check (rating between 1 and 5),
  comment text not null default '',
  images jsonb not null default '[]'::jsonb,          -- ảnh khách gửi (tái dùng /api/upload)
  is_verified_purchase boolean not null default false, -- SĐT khớp đơn completed/shipping
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_reply text,                                    -- shop phản hồi (tăng tin cậy)
  created_at timestamptz not null default now()
);

-- Truy vấn nóng nhất: review đã duyệt của 1 sản phẩm, mới nhất trước.
create index if not exists reviews_product_approved_idx
  on public.reviews (product_id, created_at desc)
  where status = 'approved';

-- RLS lọc theo DÒNG (giống các bảng khác trong dự án): khách chỉ ĐỌC được dòng
-- đã duyệt; KHÔNG ghi trực tiếp từ anon — mọi insert đi qua API route dùng service
-- role (bỏ qua RLS) để rate-limit + đối chiếu đơn trước khi lưu. Lưu ý RLS KHÔNG
-- lọc theo CỘT, nên phía khách phải select cột tường minh (PUBLIC_REVIEW_COLUMNS
-- trong lib/supabase.ts) để không lộ author_phone.
alter table public.reviews enable row level security;

create policy reviews_public_read on public.reviews
  for select using (status = 'approved');
