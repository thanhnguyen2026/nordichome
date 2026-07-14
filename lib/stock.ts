// Tổng tồn kho <= ngưỡng này (nhưng còn hàng) thì coi là "sắp hết" — dùng
// chung giữa badge cảnh báo trong admin/products và thông báo Telegram khi
// tồn kho giảm xuống ngưỡng này lúc có đơn mới.
export const LOW_STOCK_THRESHOLD = 5
