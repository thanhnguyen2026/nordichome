import PolicyPage from '@/components/store/PolicyPage'

export const metadata = { title: 'Điều khoản sử dụng' }

export default function TermsPage() {
  return (
    <PolicyPage title="Điều khoản sử dụng">
      <p>
        Khi truy cập và sử dụng website Nordic Home, bạn đồng ý với các điều
        khoản dưới đây.
      </p>

      <h2>Thông tin sản phẩm</h2>
      <p>
        Chúng tôi cố gắng mô tả và hiển thị hình ảnh sản phẩm chính xác nhất có
        thể. Màu sắc thực tế có thể chênh lệch nhẹ so với hình ảnh do điều kiện
        ánh sáng và màn hình hiển thị khác nhau.
      </p>

      <h2>Đặt hàng &amp; thanh toán</h2>
      <ul>
        <li>Đơn hàng được xác nhận sau khi khách hàng hoàn tất đặt hàng trên website.</li>
        <li>Hỗ trợ thanh toán khi nhận hàng (COD) hoặc chuyển khoản ngân hàng.</li>
        <li>Sản phẩm đặt trước (Pre-order) có thời gian giao hàng dự kiến 7-10 ngày, sẽ được ghi rõ tại trang sản phẩm.</li>
      </ul>

      <h2>Thay đổi điều khoản</h2>
      <p>
        Nordic Home có thể cập nhật điều khoản sử dụng khi cần thiết. Phiên bản
        mới nhất luôn được đăng tải tại trang này.
      </p>
    </PolicyPage>
  )
}
