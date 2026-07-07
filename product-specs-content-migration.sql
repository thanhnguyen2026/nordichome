-- Thông số kỹ thuật dạng bảng (VD: "Độ dày thảm (mm)": "10-15") và các khối
-- nội dung ảnh + mô tả xen kẽ hiển thị full-width dưới trang chi tiết sản
-- phẩm — tăng độ tin tưởng, giống bố cục mô tả sản phẩm kiểu Taobao.
alter table public.products
  add column specs jsonb not null default '[]'::jsonb,
  add column content_blocks jsonb not null default '[]'::jsonb;
