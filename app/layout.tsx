import type { Metadata } from "next"
import { Be_Vietnam_Pro, Cormorant_Garamond } from "next/font/google"
import "./globals.css"
import CartHydration from "@/components/CartHydration"
import Analytics from "@/components/analytics/Analytics"
import FloatingSocial from "@/components/store/FloatingSocial"

const font = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-sans",
})

const fontSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif",
})

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: {
    default: "Nordic Home - Simplify & Enjoy",
    template: "%s | Nordic Home",
  },
  description: "Nội thất phong cách Bắc Âu — thiết kế tinh tế, chất liệu tự nhiên bền vững.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className={`${font.variable} ${fontSerif.variable}`}>
      <body className="font-sans antialiased bg-white text-stone-900">
        <Analytics />
        <CartHydration />
        <FloatingSocial />
        {children}
      </body>
    </html>
  )
}