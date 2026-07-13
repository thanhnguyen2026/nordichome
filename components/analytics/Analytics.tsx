'use client'
import { useEffect } from 'react'
import Script from 'next/script'
import { captureUTM } from '@/lib/analytics'

const GTM_ID     = process.env.NEXT_PUBLIC_GTM_ID
const GA_ID      = process.env.NEXT_PUBLIC_GA_ID
const GADS_ID    = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
const PIXEL_ID   = process.env.NEXT_PUBLIC_META_PIXEL_ID
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID

export default function Analytics() {
  useEffect(() => {
    captureUTM()
  }, [])

  return (
    <>
      {/* ── Google Tag Manager ─────────────────────────────────────── */}
      {GTM_ID && (
        <>
          <Script id="gtm" strategy="afterInteractive">{`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;
            j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
            f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');
          `}</Script>
          <noscript>
            <iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} />
          </noscript>
        </>
      )}

      {/* ── Google Analytics 4 + Google Ads (direct gtag.js) ──────── */}
      {(GA_ID || GADS_ID) && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID || GADS_ID}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            ${GA_ID   ? `gtag('config', '${GA_ID}', { send_page_view: true });` : ''}
            ${GADS_ID ? `gtag('config', '${GADS_ID}');` : ''}
          `}</Script>
        </>
      )}

      {/* ── Meta Pixel base code ───────────────────────────────────── */}
      {PIXEL_ID && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
            n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${PIXEL_ID}');
            fbq('track', 'PageView');
          `}</Script>
          <noscript>
            {/* Pixel theo dõi Meta chuẩn — next/image cần JS để hoạt động nên
                không dùng được trong <noscript>, phải dùng <img> thuần. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img height="1" width="1" style={{ display: 'none' }} alt=""
              src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`} />
          </noscript>
        </>
      )}

      {/* ── Microsoft Clarity ─────────────────────────────────────── */}
      {CLARITY_ID && (
        <Script id="clarity" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window,document,"clarity","script","${CLARITY_ID}");
        `}</Script>
      )}
    </>
  )
}
