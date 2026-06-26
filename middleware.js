// 2026-06-24 — Vercel Edge Middleware (프로젝트 루트).
//   호스트별 OG 메타 분리 — Vite SPA 의 정적 index.html 우선 서빙 문제 우회.
//
//   동작:
//     · matcher 로 / 와 /index.html 만 미들웨어 진입 (정적 자산·api 가드).
//     · host 가 올데이케어.kr (punycode 또는 한글 디코딩) 이면:
//         원본 index.html fetch → OG/title 메타 + favicon link 치환 → 새 Response 반환.
//     · 그 외 host (ollit.vercel.app 등) → undefined 반환 = pass through (기존 동작).
//
//   Vercel routing 에서 Middleware 는 정적 파일/rewrites 보다 먼저 — 정적 우선 문제 해결.
//
// 2026-06-26 — favicon 호스트별 분리 추가.
//   index.html 기본 = 핑크(올잇 PWA — favicon.svg / icon-*.png).
//   올데이케어 호스트만 여기서 -allday(파란 A) 파일로 link 치환.
//   파일명 분리(public/favicon-allday.*)로 브라우저 /favicon.ico 직접 fetch 캐시 함정 회피.

export const config = {
  // 정적 자산(/og-alldaycare.png, /assets/*) 및 /api/* 는 자동 제외됨 (path 매칭 X).
  matcher: ["/", "/index.html"],
};

// 2026-06-24 — og:image / og:url 한글 도메인 → punycode 절대 URL 로 변경.
//   원인: 카톡 이미지 fetcher 가 한글(IDN) URL 을 punycode 변환 못 해 이미지 fetch 실패.
//         (카카오 디버거에선 정상이나 실제 카톡 메시지에서 이미지만 빈칸)
//   호환성 위해 og:url 도 punycode 로 통일.
const ALLDAY_OG = {
  title:       "올데이케어 - 에어컨 분해세척·냉매충전·설치·수리",
  description: "서울·경기 당일 출장. 냉매충전·분해세척·누설수리·설치",
  image:       "https://xn--2n1bk06aikal6b92t.kr/og-alldaycare-v2.png",  // 카톡/CDN 캐시 무효화용 파일명 버전
  url:         "https://xn--2n1bk06aikal6b92t.kr",
};

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isAlldayHost(host) {
  const h = String(host || "").toLowerCase();
  return h.includes("xn--2n1bk06aikal6b92t") || h.includes("올데이케어");
}

export default async function middleware(request) {
  const host = request.headers.get("host") || "";

  // 올데이케어.kr 외 호스트는 통과 (ollit.vercel.app 등 운영 PWA 영향 X).
  if (!isAlldayHost(host)) return;

  try {
    const url = new URL(request.url);
    const indexUrl = `${url.origin}/index.html`;
    const res = await fetch(indexUrl);
    if (!res.ok) return; // 원본 fetch 실패 시 기본 동작 (정적 index.html 서빙)
    let html = await res.text();

    html = html
      .replace(
        /<meta property="og:title"[^>]*>/,
        `<meta property="og:title" content="${escapeAttr(ALLDAY_OG.title)}">`,
      )
      .replace(
        /<meta property="og:description"[^>]*>/,
        `<meta property="og:description" content="${escapeAttr(ALLDAY_OG.description)}">`,
      )
      .replace(
        /<meta property="og:image"[^>]*>/,
        `<meta property="og:image" content="${escapeAttr(ALLDAY_OG.image)}">`,
      )
      .replace(
        /<meta property="og:url"[^>]*>/,
        `<meta property="og:url" content="${escapeAttr(ALLDAY_OG.url)}">`,
      )
      .replace(
        /<title>[^<]*<\/title>/,
        `<title>${escapeText(ALLDAY_OG.title)}</title>`,
      )
      // favicon 치환 — 핑크(올잇 기본) → -allday(파란 A)
      .replace(
        /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"[^>]*>/,
        [
          `<link rel="icon" type="image/x-icon" href="/favicon-allday.ico">`,
          `    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-allday-16.png">`,
          `    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-allday-32.png">`,
        ].join("\n"),
      )
      .replace(
        /<link rel="icon" type="image\/png" sizes="192x192" href="\/icon-192\.png"[^>]*>/,
        `<link rel="icon" type="image/png" sizes="192x192" href="/favicon-allday-192.png">`,
      )
      .replace(
        /<link rel="icon" type="image\/png" sizes="512x512" href="\/icon-512\.png"[^>]*>/,
        `<link rel="icon" type="image/png" sizes="512x512" href="/favicon-allday-512.png">`,
      )
      .replace(
        /<link rel="apple-touch-icon" sizes="180x180" href="\/icon-180\.png"[^>]*>/,
        `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-allday.png">`,
      );

    // twitter:card 추가 (기본 index.html 에 없을 경우)
    if (!/twitter:card/.test(html)) {
      html = html.replace(
        /<meta property="og:type"[^>]*>/,
        (m) => `${m}\n    <meta name="twitter:card" content="summary_large_image">`,
      );
    }

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (e) {
    console.error("[middleware] og rewrite failed:", e);
    return; // 실패 시 기본 동작 (손님 노출 안 막힘)
  }
}
