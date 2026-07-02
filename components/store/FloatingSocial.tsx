'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Settings { [key: string]: string }

const CHANNELS = [
  {
    key: 'zalo',
    label: 'Zalo',
    color: '#0068FF',
    icon: (
      <svg viewBox="0 0 32 32" className="w-6 h-6 fill-current">
        <path d="M16 2C8.268 2 2 8.268 2 16c0 2.52.7 4.88 1.918 6.89L2 30l7.274-1.892A13.93 13.93 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2Zm-4 9h8a.75.75 0 0 1 0 1.5h-2.5v5h2.5a.75.75 0 0 1 0 1.5H12a.75.75 0 0 1 0-1.5h2.5v-5H12A.75.75 0 0 1 12 11Z"/>
      </svg>
    ),
  },
  {
    key: 'messenger',
    label: 'Messenger',
    color: '#006AFF',
    icon: (
      <svg viewBox="0 0 32 32" className="w-6 h-6 fill-current">
        <path d="M16 3C8.82 3 3 8.475 3 15.167c0 3.885 1.937 7.348 4.97 9.617V29l4.54-2.492a13.87 13.87 0 0 0 3.49.442c7.18 0 13-5.475 13-12.167C29 8.475 23.18 3 16 3Zm1.32 16.62-3.39-3.62-6.63 3.62 7.29-7.74 3.47 3.62 6.55-3.62-7.29 7.74Z"/>
      </svg>
    ),
  },
  {
    key: 'youtube',
    label: 'YouTube',
    color: '#FF0000',
    icon: (
      <svg viewBox="0 0 32 32" className="w-6 h-6 fill-current">
        <path d="M29.41 9.26a3.5 3.5 0 0 0-2.46-2.47C24.76 6.25 16 6.25 16 6.25s-8.76 0-10.95.54a3.5 3.5 0 0 0-2.46 2.47C2.06 11.44 2.06 16 2.06 16s0 4.56.53 6.74a3.5 3.5 0 0 0 2.46 2.47c2.19.54 10.95.54 10.95.54s8.76 0 10.95-.54a3.5 3.5 0 0 0 2.46-2.47c.53-2.18.53-6.74.53-6.74s0-4.56-.53-6.74ZM13.25 20v-8l7.33 4-7.33 4Z"/>
      </svg>
    ),
  },
  {
    key: 'instagram',
    label: 'Instagram',
    color: '#C13584',
    icon: (
      <svg viewBox="0 0 32 32" className="w-6 h-6 fill-current">
        <path d="M16 3c-3.53 0-3.97.015-5.355.078-1.38.063-2.324.283-3.149.603A6.35 6.35 0 0 0 5.2 5.2a6.35 6.35 0 0 0-1.519 2.296c-.32.825-.54 1.769-.603 3.149C3.015 12.03 3 12.47 3 16s.015 3.97.078 5.355c.063 1.38.283 2.324.603 3.149A6.35 6.35 0 0 0 5.2 26.8a6.35 6.35 0 0 0 2.296 1.519c.825.32 1.769.54 3.149.603C12.03 28.985 12.47 29 16 29s3.97-.015 5.355-.078c1.38-.063 2.324-.283 3.149-.603A6.35 6.35 0 0 0 26.8 26.8a6.35 6.35 0 0 0 1.519-2.296c.32-.825.54-1.769.603-3.149C28.985 19.97 29 19.53 29 16s-.015-3.97-.078-5.355c-.063-1.38-.283-2.324-.603-3.149A6.35 6.35 0 0 0 26.8 5.2a6.35 6.35 0 0 0-2.296-1.519c-.825-.32-1.769-.54-3.149-.603C19.97 3.015 19.53 3 16 3Zm0 2.342c3.47 0 3.88.013 5.248.076 1.267.058 1.956.27 2.414.448.607.235 1.04.517 1.495.972.455.455.737.888.972 1.495.178.458.39 1.147.448 2.414.063 1.368.076 1.778.076 5.248s-.013 3.88-.076 5.248c-.058 1.267-.27 1.956-.448 2.414a4.03 4.03 0 0 1-.972 1.495 4.03 4.03 0 0 1-1.495.972c-.458.178-1.147.39-2.414.448-1.368.063-1.778.076-5.248.076s-3.88-.013-5.248-.076c-1.267-.058-1.956-.27-2.414-.448a4.03 4.03 0 0 1-1.495-.972 4.03 4.03 0 0 1-.972-1.495c-.178-.458-.39-1.147-.448-2.414C5.355 19.88 5.342 19.47 5.342 16s.013-3.88.076-5.248c.058-1.267.27-1.956.448-2.414a4.03 4.03 0 0 1 .972-1.495 4.03 4.03 0 0 1 1.495-.972c.458-.178 1.147-.39 2.414-.448C12.12 5.355 12.53 5.342 16 5.342ZM16 9.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 2.34a4.16 4.16 0 1 1 0 8.32 4.16 4.16 0 0 1 0-8.32Zm6.77-4.17a1.52 1.52 0 1 0 0 3.04 1.52 1.52 0 0 0 0-3.04Z"/>
      </svg>
    ),
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    color: '#010101',
    icon: (
      <svg viewBox="0 0 32 32" className="w-6 h-6 fill-current">
        <path d="M21.5 3h-4v17.5a3.5 3.5 0 1 1-3.5-3.5c.33 0 .65.05.95.13V12.9a8 8 0 1 0 7.05 7.93V12.1A11.44 11.44 0 0 0 28 14V10a7.5 7.5 0 0 1-6.5-7Z"/>
      </svg>
    ),
  },
  {
    key: 'shopee',
    label: 'Shopee',
    color: '#EE4D2D',
    icon: (
      <svg viewBox="0 0 32 32" className="w-6 h-6 fill-current">
        <path d="M16 2a7 7 0 0 0-7 7H7a2 2 0 0 0-2 2l-1 16a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2L27 11a2 2 0 0 0-2-2h-2a7 7 0 0 0-7-7Zm0 2a5 5 0 0 1 5 5H11a5 5 0 0 1 5-5Zm0 10a5 5 0 1 1 0 10A5 5 0 0 1 16 14Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>
      </svg>
    ),
  },
  {
    key: 'twitter',
    label: 'X / Twitter',
    color: '#000000',
    icon: (
      <svg viewBox="0 0 32 32" className="w-6 h-6 fill-current">
        <path d="M17.75 14.56 25.6 5.5h-1.86l-6.82 7.93L11.6 5.5H5.5l8.23 11.98L5.5 27.5h1.86l7.2-8.37 5.75 8.37H26.5L17.75 14.56Zm-2.55 2.96-.83-1.19L8.15 6.92h2.87l5.36 7.67.83 1.19 6.97 9.97h-2.87l-5.68-8.13-.38-.1Z"/>
      </svg>
    ),
  },
]

export default function FloatingSocial() {
  const pathname = usePathname()
  const [settings, setSettings] = useState<Settings>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('key,value')
      .in('key', CHANNELS.flatMap(c => [`float_${c.key}_on`, `float_${c.key}_url`]))
      .then(({ data }) => {
        setSettings(Object.fromEntries(data?.map(r => [r.key, r.value || '']) ?? []))
        setLoaded(true)
      })
  }, [])

  const active = CHANNELS.filter(
    c => settings[`float_${c.key}_on`] === '1' && settings[`float_${c.key}_url`]
  )

  // Ẩn trên trang admin — kiểm tra SAU khi mọi hook đã gọi xong, vì component
  // này sống trong layout gốc (không unmount khi chuyển trang), nếu return
  // sớm nằm trước useEffect thì số lượng hook gọi ra sẽ đổi giữa các lần
  // render khi khách chuyển từ /admin sang trang thường, vi phạm Rules of Hooks.
  if (pathname?.startsWith('/admin')) return null
  if (!loaded || active.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes floatBob {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-4px);  }
        }
        .float-btn { animation: floatBob 3s ease-in-out infinite; }
        .float-btn:hover { animation: none; }
      `}</style>

      <div className="fixed right-0 bottom-20 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-40 flex flex-col gap-2">
        {active.map((ch, idx) => (
          <a
            key={ch.key}
            href={settings[`float_${ch.key}_url`]}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: ch.color,
              animationDelay: `${idx * 0.4}s`,
            }}
            className="float-btn group flex items-center justify-end w-14 h-14 rounded-l-2xl bg-white shadow-lg hover:shadow-xl hover:w-40 hover:scale-105 transition-all duration-300 ease-in-out overflow-hidden border border-stone-100"
            aria-label={ch.label}
          >
            <span className="flex-1 text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-right pr-2 text-stone-500">
              {ch.label}
            </span>
            <span className="flex-shrink-0 w-14 flex items-center justify-center">
              {ch.icon}
            </span>
          </a>
        ))}
      </div>
    </>
  )
}
