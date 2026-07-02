import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cho phép truy cập dev server qua IP mạng LAN (xem demo trên điện thoại) —
  // Next.js 16 mặc định chặn request cross-origin đến /_next/* nếu host không khớp localhost.
  // Giữ cả IP cũ lẫn mới vì máy có thể đổi mạng wifi (đổi dải IP) qua lại nhiều lần.
  allowedDevOrigins: ["192.168.1.17", "192.168.1.8"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "rdklbrtbxtatpwdjtgrl.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "img.vietqr.io" },
      { protocol: "https", hostname: "upload.wikimedia.org" }, // icon mặc định cho kênh mạng xã hội
    ],
  },
};

export default nextConfig;
