// Bỏ dấu tiếng Việt khi so khớp tìm kiếm — nhân viên gõ trên điện thoại
// thường bỏ dấu (VD "binh" thay vì "Bình"), không nên bắt gõ đúng dấu mới ra kết quả.
export const stripDiacritics = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

// Dùng khi nhét JSON (VD JSON-LD) vào <script dangerouslySetInnerHTML> — nếu
// dữ liệu (tên sản phẩm admin nhập...) chứa chuỗi kết thúc thẻ script thì
// trình duyệt sẽ đọc nhầm đó là hết thẻ <script> giữa chừng, và chạy phần nội
// dung phía sau như HTML/script thật (XSS). Thay mọi dấu "<" bằng mã unicode
// tương đương để trình duyệt không bao giờ nhận ra một thẻ đóng script nằm
// trong nội dung JSON, dù dữ liệu gốc chứa gì đi nữa.
export const safeJsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, '\\u003c')
