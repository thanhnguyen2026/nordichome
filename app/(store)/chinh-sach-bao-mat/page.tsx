import PolicyPage from '@/components/store/PolicyPage'

export const metadata = { title: 'Chính sách bảo mật' }

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage title="Chính sách bảo mật">
      <p>
        Nordic Home tôn trọng và cam kết bảo vệ thông tin cá nhân của khách hàng.
        Chính sách này giải thích chúng tôi thu thập, sử dụng và bảo vệ thông tin
        đó như thế nào.
      </p>

      <h2>Thông tin thu thập</h2>
      <p>
        Khi đặt hàng, chúng tôi chỉ thu thập những thông tin cần thiết để xử lý
        đơn: họ tên, số điện thoại, địa chỉ giao hàng và ghi chú (nếu có).
      </p>

      <h2>Mục đích sử dụng</h2>
      <ul>
        <li>Xác nhận và giao đơn hàng đến đúng khách hàng.</li>
        <li>Liên hệ hỗ trợ khi cần thiết (xác nhận đơn, tư vấn, đổi trả).</li>
        <li>Không sử dụng cho mục đích quảng cáo nếu chưa được khách hàng đồng ý.</li>
      </ul>

      <h2>Bảo mật thông tin</h2>
      <p>
        Thông tin khách hàng được lưu trữ trên hệ thống có kiểm soát truy cập,
        không chia sẻ cho bên thứ ba ngoài các đơn vị vận chuyển cần thiết để
        giao hàng.
      </p>
    </PolicyPage>
  )
}
