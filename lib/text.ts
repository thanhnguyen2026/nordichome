// Bỏ dấu tiếng Việt khi so khớp tìm kiếm — nhân viên gõ trên điện thoại
// thường bỏ dấu (VD "binh" thay vì "Bình"), không nên bắt gõ đúng dấu mới ra kết quả.
export const stripDiacritics = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
