import { NextRequest, NextResponse } from 'next/server'

// Địa chỉ kho gửi hàng — đổi theo thực tế
const PICK_PROVINCE = process.env.GHTK_PICK_PROVINCE || 'Hồ Chí Minh'
const PICK_DISTRICT = process.env.GHTK_PICK_DISTRICT || 'Quận Phú Nhuận'

export async function POST(req: NextRequest) {
  const token = process.env.GHTK_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Chưa cấu hình GHTK_TOKEN' }, { status: 500 })
  }

  const { province, district, ward, weight, value } = await req.json()

  if (!province || !district || !ward) {
    return NextResponse.json({ error: 'Thiếu thông tin địa chỉ' }, { status: 400 })
  }

  const params = new URLSearchParams({
    pick_province: PICK_PROVINCE,
    pick_district: PICK_DISTRICT,
    province,
    district,
    ward,
    weight: String(Math.round((weight || 0.5) * 1000)), // kg → gram
    value:  String(value  || 0),
    transport: 'road',
  })

  const partnerCode = process.env.GHTK_PARTNER_CODE
  const headers: Record<string, string> = { Token: token, 'Content-Type': 'application/json' }
  if (partnerCode) headers['X-Client-Source'] = partnerCode

  try {
    const res = await fetch(
      `https://services.giaohangtietkiem.vn/services/shipment/fee?${params}`,
      { headers, cache: 'no-store' }
    )
    const data = await res.json()

    if (!data.success) {
      return NextResponse.json(
        { error: data.message || 'GHTK không tính được phí' },
        { status: 400 }
      )
    }

    return NextResponse.json({ fee: data.fee?.fee ?? 0 })
  } catch {
    return NextResponse.json({ error: 'Lỗi kết nối GHTK, vui lòng thử lại' }, { status: 500 })
  }
}
