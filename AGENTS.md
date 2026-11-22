<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Đăng sản phẩm (Website + Facebook)

Dùng `scripts/publish-product.mjs`. Thư mục sản phẩm cần: ảnh (`01.png`, `02.png`… — ảnh đầu là ảnh bìa) + file nội dung `<slug>.md` (định dạng skill nordic-product-campaign-generator).

```bash
node scripts/publish-product.mjs <thư-mục> [--website] [--facebook] \
  [--category <slug-danh-mục>] [--price 890000 --visible] [--dry-run] [--force]
```

- Không truyền `--website`/`--facebook` = đăng cả hai. Website mặc định tạo sản phẩm **ẩn** (chưa có giá); `--price … --visible` để hiện luôn. Kết quả ghi vào `<thư-mục>/status.json`, chạy lại không đăng trùng.
- **Trên máy Windows**: khoá đọc từ `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `FACEBOOK_ACCESS_TOKEN`).
- **Trên đám mây (môi trường "nordichome")**: không có `.env.local`; proxy tự chèn token Facebook (graph.facebook.com) và khoá Supabase service_role (header Authorization); biến `NEXT_PUBLIC_SUPABASE_ANON_KEY` có sẵn. Ảnh lấy từ Google Drive: tìm file bằng công cụ Google Drive (thư mục `…/<sản phẩm>/media/images`), tải bằng `curl -L "https://drive.usercontent.google.com/download?id=<FILE_ID>&export=download&confirm=t"` (thư mục Drive đã chia sẻ "bất kỳ ai có liên kết").
- Danh mục Giáng sinh: `giang-sinh-8937` (Decor → Giáng sinh). Page Facebook: Nordic Home (`636095253689048`).
