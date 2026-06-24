// 2026-06-24 — 호스트별 OG 메타 분리 (Vercel serverless function).
//   올데이케어.kr (xn--2n1bk06aikal6b92t.kr) 요청 시:
//     · 빌드 산출 index.html 을 fetch
//     · OG/twitter/title 메타만 올데이케어용으로 치환해서 응답
//     · 정적 자산(/og-alldaycare.png, /assets/*) 은 vercel rewrites 매칭 X — 직접 서빙
//
//   ollit.vercel.app 등 다른 호스트는 vercel rewrites 가 안 잡아 → 기본 index.html 그대로.

const ALLDAY_OG = {
  title:       "올데이케어 - 에어컨 분해세척·냉매충전·설치·수리",
  description: "서울·경기 당일 출장. 냉매충전·분해세척·누설수리·설치",
  image:       "https://올데이케어.kr/og-alldaycare.png",  // 카톡 크롤러는 절대 URL 만 읽음
  url:         "https://올데이케어.kr",
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

export default async function handler(req, res) {
  try {
    const proto  = req.headers["x-forwarded-proto"] || "https";
    const host   = req.headers.host || "";
    const origin = `${proto}://${host}`;

    // 빌드된 index.html 가져오기 (절대 URL 로)
    const resp = await fetch(`${origin}/index.html`);
    if (!resp.ok) throw new Error(`fetch index.html ${resp.status}`);
    let html = await resp.text();

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
      );

    // twitter:card 추가 (기존 index.html 에 없을 경우)
    if (!/twitter:card/.test(html)) {
      html = html.replace(
        /<meta property="og:type"[^>]*>/,
        (m) => `${m}\n    <meta name="twitter:card" content="summary_large_image">`,
      );
    }

    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "public, max-age=300, s-maxage=300");
    res.status(200).send(html);
  } catch (e) {
    console.error("[og-rewrite] failed:", e);
    // 실패 시 그냥 기본 index.html 로 redirect — 손님이 못 보는 일은 없게.
    res.redirect(307, "/index.html");
  }
}
