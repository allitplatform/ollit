// 2026-07-26 — 부정클릭 감시 1단계: 랜딩 방문 기록.
// 랜딩(올데이케어.kr) index.html 이 방문마다 1회 호출. IP·UA·쿼리·리퍼러 저장.
// 판정(반복 IP)은 관제판/아침보고에서 조회로 수행. 차단은 2단계.

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || null;
    const ua = String(req.headers["user-agent"] || "").slice(0, 300);
    const qs = String(req.query.qs || "").slice(0, 500);
    const ref = String(req.query.ref || "").slice(0, 300);
    if (SB_URL && SB_KEY) {
      await fetch(`${SB_URL}/rest/v1/ad_click_log`, {
        method: "POST",
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
          "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ ip, ua, qs, ref }),
      });
    }
    res.status(204).end();
  } catch (e) { res.status(204).end(); }
}
