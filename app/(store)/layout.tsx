// Lớp grain (noise) rất mảnh phủ toàn bộ storefront — tạo cảm giác "chất
// liệu"/được thiết kế thay vì nền phẳng tuyệt đối. Đặt riêng ở layout của
// route group (store) (không phải root layout) để không ảnh hưởng /admin.
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="grain-overlay" aria-hidden="true" />
      {children}
    </>
  )
}
