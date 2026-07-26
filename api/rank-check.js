// 2026-07-26 — 실측 순위 추적기 (api/rank-check.js)
// 30분마다 네이버 모바일 검색에서 파워링크 내 올데이케어 위치를 확인해 기록.
// 원칙: 확인만, 클릭 절대 없음. 차단(캡차/비정상 응답) 감지 시 그 회차 스킵 + 기록.
// ?token=...&debug=1&kw=에어컨가스충전 → 파싱 원본 진단

const TOKEN = "b29adde027905ee35c810634f09bda48a697f973fbdb8ca8";
const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 오늘 광고비 상위 실측 TOP10 (7/26 기준 — 필요시 교체)
const KEYWORDS = [
  "에어컨가스충전", "에어컨냉매충전", "에어컨수리", "에어컨가스충전비",
  "에어콘가스충전", "에어컨냉매충전가격", "에어컨가스충전비용", "에어컨냉매충전비용",
  "에어컨이안시원해요", "에어컨청소",
];
const OURS = ["올데이케어", "olldaycare", "xn--2n1bk06aikal6b92t", "1866-2003"];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

export const maxDuration = 60;

async function fetchSerp(kw) {
  const r = await fetch("https://m.search.naver.com/search.naver?query=" + encodeURIComponent(kw), {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9",
      "Accept": "text/html,application/xhtml+xml" }, redirect: "follow" });
  const html = await r.text();
  return { status: r.status, html };
}

// 파워링크 광고 블록에서 우리 위치 찾기.
// 광고 아이템 경계 후보를 여러 개 시도해 가장 그럴듯한 걸 쓴다.
function parseRank(html) {
  const out = { blocked: false, adsTotal: null, rank: null, markerUsed: null };
  // 진짜 차단 페이지만: 본문이 극단적으로 짧거나 방지문자 안내가 뜬 경우
  if (html.length < 20000 || html.includes("자동입력 방지문자") || html.includes("비정상적인 접근")) {
    out.blocked = true; return out;
  }
  // 광고 = ader.naver.com 링크 묶음(클러스터). 파워링크 구역(power_link)부터만 센다.
  const secStart = html.indexOf("power_link");
  const base = secStart > 0 ? secStart : 0;
  const idx = [];
  const re = /ader\.naver\.com/g; let m;
  while ((m = re.exec(html)) !== null) { if (m.index >= base) idx.push(m.index); }
  if (!idx.length) { out.adsTotal = 0; return out; }
  const GAP = 1500;
  const clusters = [];
  let cs = idx[0], ce = idx[0];
  for (let i = 1; i < idx.length; i++) {
    if (idx[i] - ce > GAP) { clusters.push([cs, ce]); cs = idx[i]; }
    ce = idx[i];
  }
  clusters.push([cs, ce]);
  out.adsTotal = clusters.length; out.markerUsed = "ader-cluster";
  out.clusters = clusters.map(c => c[0]);
  let ourPos = -1;
  for (const o of OURS) { const p = html.indexOf(o, base); if (p >= 0 && (ourPos < 0 || p < ourPos)) ourPos = p; }
  if (ourPos >= 0) {
    let rank = 0;
    for (const [a, b] of clusters) { if (a - 800 <= ourPos) rank++; else break; }
    if (rank > 0 && rank <= clusters.length) out.rank = rank;
  }
  return out;
}

export default async function handler(req, res) {
  if ((req.query.token || "") !== TOKEN) { res.status(404).end(); return; }
  try {
    if (req.query.debug) {
      const kw = req.query.kw || KEYWORDS[0];
      const { status, html } = await fetchSerp(kw);
      const p = parseRank(html);
      const count = (re) => (html.match(new RegExp(re, "g")) || []).length;
      const diag = {
        powerLabel: count("파워링크"), splink: count("splink"), powerClass: count("power_link"),
        ader: count("ader\\.naver\\.com"), cite: count("<cite"),
        adBadge: count(">광고<"), liItem: count("<li"),
        oursIdx: (() => { for (const o of OURS) { const i = html.indexOf(o); if (i >= 0) return { o, i }; } return null; })(),
        secStart: html.search(/파워링크|power_link|splink/i),
      };
      res.status(200).json({ ok: true, kw, status, len: html.length, parse: p, diag });
      return;
    }
    const rows = [];
    for (const kw of KEYWORDS) {
      try {
        const { status, html } = await fetchSerp(kw);
        const p = parseRank(html);
        rows.push({ kw, rank: p.blocked ? null : p.rank, ads_total: p.adsTotal,
          blocked: p.blocked || status !== 200 });
      } catch (e) { rows.push({ kw, rank: null, ads_total: null, blocked: true }); }
      await new Promise(r => setTimeout(r, 800)); // 사람 속도
    }
    if (SB_URL && SB_KEY) {
      await fetch(`${SB_URL}/rest/v1/ad_serp_rank`, { method: "POST",
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
          "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(rows) });
    }
    res.status(200).json({ ok: true, checked: rows.length,
      blocked: rows.filter(r => r.blocked).length, rows });
  } catch (e) { res.status(200).json({ ok: false, error: String(e && e.message || e) }); }
}
