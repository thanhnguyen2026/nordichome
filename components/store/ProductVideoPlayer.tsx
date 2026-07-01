'use client'
import { useEffect, useRef } from 'react'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type VideoSource =
  | { type: 'youtube';   id: string;   isShorts: boolean }
  | { type: 'facebook';  url: string;  isReels: boolean  }
  | { type: 'tiktok';    url: string                     }
  | { type: 'mp4';       url: string                     }
  | { type: 'unknown';   url: string                     }

// ─── URL PARSER ───────────────────────────────────────────────────────────────

function parseVideoUrl(url: string): VideoSource {
  if (!url) return { type: 'unknown', url }

  const u = url.trim()

  // ── YouTube Shorts (dọc) ──────────────────────────────────────────────────
  const ytShorts = u.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]+)/)
  if (ytShorts) return { type: 'youtube', id: ytShorts[1], isShorts: true }

  // ── YouTube thường ────────────────────────────────────────────────────────
  const ytPatterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]+)/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]+)/,
    /youtu\.be\/([A-Za-z0-9_-]+)/,
  ]
  for (const p of ytPatterns) {
    const m = u.match(p)
    if (m) return { type: 'youtube', id: m[1], isShorts: false }
  }

  // ── Facebook Reels (dọc) ──────────────────────────────────────────────────
  if (
    (u.includes('facebook.com') || u.includes('fb.watch')) &&
    (u.includes('/reel/') || u.includes('/reels/'))
  ) {
    return { type: 'facebook', url: u, isReels: true }
  }

  // ── Facebook Video thường ─────────────────────────────────────────────────
  if (u.includes('facebook.com') || u.includes('fb.watch')) {
    return { type: 'facebook', url: u, isReels: false }
  }

  // ── TikTok ────────────────────────────────────────────────────────────────
  if (u.includes('tiktok.com') || u.includes('vm.tiktok.com')) {
    return { type: 'tiktok', url: u }
  }

  // ── File MP4 / WebM / MOV trực tiếp ──────────────────────────────────────
  if (u.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i)) {
    return { type: 'mp4', url: u }
  }

  return { type: 'unknown', url: u }
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

/** Wrapper cho video dọc (Shorts / Reels / TikTok) */
function PortraitWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center w-full">
      <div className="w-full max-w-[340px]">
        <div className="relative aspect-[9/16] rounded-2xl overflow-hidden shadow-lg bg-black">
          {children}
        </div>
      </div>
    </div>
  )
}

/** Wrapper cho video ngang */
function LandscapeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-lg bg-black">
      {children}
    </div>
  )
}

/** Video MP4 tự host — ép muted qua ref để đảm bảo autoplay không bị trình duyệt chặn */
function MutedAutoplayVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.muted = true
    el.play().catch(() => {})
  }, [])

  return (
    <video
      ref={ref}
      src={src}
      controls
      autoPlay
      loop
      muted
      playsInline
      className="w-full max-h-[70vh] object-contain"
      style={{ display: 'block' }}
    />
  )
}

/** iframe fullsize */
function FullIframe({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      scrolling="no"
      className="absolute inset-0 w-full h-full border-0"
    />
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface Props {
  videoUrl: string
}

export default function ProductVideoPlayer({ videoUrl }: Props) {
  if (!videoUrl) return null

  const source = parseVideoUrl(videoUrl)

  // ── YouTube ─────────────────────────────────────────────────────────────────
  if (source.type === 'youtube') {
    const src =
      `https://www.youtube.com/embed/${source.id}` +
      `?controls=1&rel=0&modestbranding=1&playsinline=1`

    if (source.isShorts) {
      return (
        <PortraitWrapper>
          <FullIframe src={src} title="YouTube Shorts" />
        </PortraitWrapper>
      )
    }
    return (
      <LandscapeWrapper>
        <FullIframe src={src} title="YouTube Video" />
      </LandscapeWrapper>
    )
  }

  // ── Facebook ────────────────────────────────────────────────────────────────
  if (source.type === 'facebook') {
    const encoded = encodeURIComponent(source.url)
    const src =
      `https://www.facebook.com/plugins/video.php` +
      `?href=${encoded}&width=500&show_text=false&autoplay=false`

    if (source.isReels) {
      return (
        <PortraitWrapper>
          <FullIframe src={src} title="Facebook Reels" />
        </PortraitWrapper>
      )
    }
    return (
      <LandscapeWrapper>
        <FullIframe src={src} title="Facebook Video" />
      </LandscapeWrapper>
    )
  }

  // ── TikTok ──────────────────────────────────────────────────────────────────
  if (source.type === 'tiktok') {
    // Trích video ID từ URL TikTok
    const tikId = source.url.match(/video\/(\d+)/)
    const embedUrl = tikId
      ? `https://www.tiktok.com/embed/v2/${tikId[1]}`
      : source.url

    return (
      <PortraitWrapper>
        <FullIframe src={embedUrl} title="TikTok Video" />
      </PortraitWrapper>
    )
  }

  // ── MP4 / WebM / MOV trực tiếp ─────────────────────────────────────────────
  // Dùng thẻ <video> HTML5, object-contain để giữ tỷ lệ gốc bất kể chiều hướng
  if (source.type === 'mp4') {
    return (
      <div className="w-full rounded-2xl overflow-hidden shadow-lg bg-stone-950">
        <MutedAutoplayVideo src={source.url} />
      </div>
    )
  }

  // ── Không nhận diện được ────────────────────────────────────────────────────
  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-md bg-stone-100 flex items-center justify-center">
      <div className="text-center text-stone-400 px-6">
        <div className="text-4xl mb-3">🎬</div>
        <p className="text-sm font-medium text-stone-500 mb-1">Không thể nhúng video này</p>
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-600 hover:text-amber-700 hover:underline transition"
        >
          Xem video trong tab mới →
        </a>
      </div>
    </div>
  )
}