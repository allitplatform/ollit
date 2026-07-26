// 2026-07-26 — 아침 보고서 열람 (api/report.js)  /api/report?id=<slug>
const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  if (!/^[a-f0-9]{10,40}$/.test(id)) { res.status(404).end(); return; }
  try {
    const r = await fetch(`${SB_URL}/rest/v1/ad_daily_report?slug=eq.${id}&select=html&limit=1`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    const rows = await r.json();
    if (!rows || !rows[0]) { res.status(404).end(); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(rows[0].html);
  } catch (e) { res.status(404).end(); }
}
