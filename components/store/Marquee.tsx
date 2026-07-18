interface Props {
  items: string[]
}

// Dải chữ chạy ngang liên tục giữa các section — phá nhịp lưới đều đặn của
// trang, đặc trưng các trang thương hiệu cao cấp. Nhân đôi danh sách để cuộn
// liền mạch (khi nửa đầu trôi hết, nửa sau đã xếp sẵn ngay tại vị trí cũ).
export default function Marquee({ items }: Props) {
  const content = [...items, ...items]
  return (
    <div className="overflow-hidden border-y border-stone-200 bg-stone-50 py-4" aria-hidden="true">
      <div className="flex w-max animate-marquee">
        {content.map((item, i) => (
          <span key={i} className="flex items-center gap-12 pr-12 font-serif italic text-sm tracking-[3px] uppercase text-stone-400 whitespace-nowrap">
            {item}
            <span className="text-amber-400 not-italic">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}
