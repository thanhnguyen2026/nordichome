-- Kênh bán hàng phát sinh đơn — website (tự động qua checkout) hay nhập tay
-- từ Facebook/Shopee/TikTok/khác, để gộp chung mọi đơn (bất kể nguồn) vào 1
-- hệ thống theo dõi duy nhất thay vì tách rời sang Excel.
alter table public.orders
  add column channel text not null default 'website'
    check (channel in ('website', 'facebook', 'shopee', 'tiktok', 'other'));
