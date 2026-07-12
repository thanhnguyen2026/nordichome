'use client'
import { useEffect, useRef } from 'react'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type VideoSource =
  | { type: 'youtube';   id: string;   isShorts: boolean }
  | { type: 'facebook';  url: string;  isReels: boolean  }
  | { type: 'tiktok';    url: string                     }
  | { type: 'gdrive';    id: string                      }
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

  // ── Google Drive (file/d/ID/view, open?id=ID, uc?id=ID) ──────────────────
  if (u.includes('drive.google.com') || u.includes('docs.google.com')) {
    const patterns = [
      /\/file\/d\/([A-Za-z0-9_-]+)/,
      /[?&]id=([A-Za-z0-9_-]+)/,
    ]
    for (const p of patterns) {
      const m = u.match(p)
      if (m) return { type: 'gdrive', id: m[1] }
    }
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

/**
 * TikTok chỉ công bố CHÍNH THỨC một cách nhúng duy nhất: thẻ <blockquote
 * class="tiktok-embed"> kèm script embed.js của họ tự quét DOM và dựng
 * player (kiểm chứng qua chính API oEmbed của TikTok). Dùng iframe tự trỏ
 * thẳng vào tiktok.com/embed/v2/{id} là cách không chính thức, dễ thiếu
 * nút điều khiển/fullscreen và có thể hỏng bất cứ lúc nào nếu TikTok đổi
 * cấu trúc trang nội bộ.
 */
function TikTokEmbed({ videoId, url }: { videoId: string; url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.innerHTML = `
      <blockquote class="tiktok-embed" cite="${url}" data-video-id="${videoId}" style="max-width:100%;min-width:100%;">
        <section></section>
      </blockquote>
    `

    // embed.js chỉ quét DOM 1 lần lúc script chạy xong — thêm script mới mỗi
    // lần mount để nó quét lại blockquote vừa chèn (dựng iframe thật bên trong)
    const script = document.createElement('script')
    script.src = 'https://www.tiktok.com/embed.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      script.remove()
    }
  }, [videoId, url])

  return (
    <div className="flex justify-center w-full">
      <div ref={containerRef} className="w-full max-w-[340px] [&_iframe]:rounded-2xl [&_iframe]:shadow-lg" />
    </div>
  )
}

/** iframe fullsize */
function FullIframe({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      // "fullscreen" bắt buộc phải khai báo tường minh ở đây — nếu thiếu, trình
      // duyệt chặn Fullscreen API bên trong iframe qua Permissions Policy, khiến
      // nút phóng to của Facebook/YouTube/TikTok bị vô hiệu hoá âm thầm dù đã có
      // allowFullScreen (thuộc tính đó chỉ là điều kiện cần, chưa đủ)
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
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
    // width quyết định độ phân giải Facebook trả về, không chỉ là kích thước
    // hiển thị — dùng mức tối đa Facebook hỗ trợ (1280) để luôn nhận bản chất
    // lượng cao nhất; CSS sẽ tự thu nhỏ lại cho vừa khung, thu nhỏ không làm mờ
    // (chỉ phóng to ảnh/video có độ phân giải thấp mới gây mờ)
    const src =
      `https://www.facebook.com/plugins/video.php` +
      `?href=${encoded}&width=1280&show_text=false&autoplay=false`

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
    // Link rút gọn (vm.tiktok.com/xxx) không chứa ID số trong URL — TikTok yêu
    // cầu link đầy đủ dạng tiktok.com/@user/video/ID cho cách nhúng chính thức.
    const tikId = source.url.match(/video\/(\d+)/)
    if (!tikId) {
      return (
        <div className="w-full aspect-[9/16] max-w-[340px] mx-auto rounded-2xl overflow-hidden shadow-md bg-stone-100 flex items-center justify-center">
          <div className="text-center text-stone-500 px-6">
            <div className="text-4xl mb-3">🎬</div>
            <p className="text-sm font-medium text-stone-500 mb-1">Cần link TikTok đầy đủ</p>
            <p className="text-xs text-stone-500 mb-2">Link rút gọn (vm.tiktok.com) chưa nhúng được — mở link trên TikTok, bấm Chia sẻ → Sao chép link để lấy link đầy đủ.</p>
            <a href={source.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-amber-600 hover:text-amber-700 hover:underline transition">
              Xem video trong tab mới →
            </a>
          </div>
        </div>
      )
    }

    return <TikTokEmbed videoId={tikId[1]} url={source.url} />
  }

  // ── Google Drive ──────────────────────────────────────────────────────────
  // Lưu ý: file trên Drive phải để chế độ chia sẻ "Bất kỳ ai có đường liên kết"
  // thì khách xem web mới phát được — nếu để riêng tư, trình phát sẽ báo lỗi quyền truy cập.
  if (source.type === 'gdrive') {
    const src = `https://drive.google.com/file/d/${source.id}/preview`
    return (
      <LandscapeWrapper>
        <FullIframe src={src} title="Google Drive Video" />
      </LandscapeWrapper>
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
      <div className="text-center text-stone-500 px-6">
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