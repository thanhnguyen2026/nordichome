import PolicyPage from '@/components/store/PolicyPage'

export const metadata = { title: 'Chính sách đổi trả' }

export default function ReturnPolicyPage() {
  return (
    <PolicyPage title="Chính sách đổi trả">
      <p>
        Nordic Home mong muốn mỗi sản phẩm đến tay bạn đều nguyên vẹn và đúng như
        mô tả. Nếu có sự cố, chúng tôi hỗ trợ đổi/trả theo các điều kiện sau.
      </p>

      <h2>Điều kiện đổi trả</h2>
      <ul>
        <li>Trong vòng 7 ngày kể từ ngày nhận hàng.</li>
        <li>Sản phẩm bị lỗi sản xuất, hư hỏng do vận chuyển, hoặc giao sai mẫu/sai màu so với đơn đặt.</li>
        <li>Sản phẩm còn nguyên vẹn, chưa qua sử dụng, còn đầy đủ tem/nhãn (nếu có).</li>
      </ul>

      <h2>Trường hợp không áp dụng</h2>
      <ul>
        <li>Sản phẩm đã qua sử dụng hoặc hư hỏng do lỗi từ phía khách hàng.</li>
        <li>Khách đổi ý không còn muốn mua sau khi đã nhận hàng (không do lỗi sản phẩm).</li>
      </ul>

      <h2>Cách thức thực hiện</h2>
      <p>
        Liên hệ trực tiếp qua Messenger/Zalo kèm mã đơn hàng và hình ảnh sản phẩm
        lỗi — chúng tôi sẽ phản hồi và hướng dẫn quy trình đổi trả trong thời gian
        sớm nhất.
      </p>
    </PolicyPage>
  )
}
