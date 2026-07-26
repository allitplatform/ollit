// 2026-07-26 — 광고 관제판 데이터 API (api/ad-console.js)
// GET ?token=... → 살아있는 키워드 전체: 그룹/입찰가/상태 + 오늘 성과 + 모바일 1위가
// 프런트: /ads-console.html (독립 페이지)

import crypto from "crypto";

const NAVER_API_KEY  = process.env.NAVER_AD_API_KEY;
const NAVER_SECRET   = process.env.NAVER_AD_SECRET;
const NAVER_CUSTOMER = process.env.NAVER_AD_CUSTOMER_ID;
const NAVER_BASE     = "https://api.searchad.naver.com";
const TOKEN = "85cd10a6b18bed7ad40ace71d23fb1fe0f244e425d6184bb";
const CAMPAIGN_ID = "cmp-a001-01-000000010808110";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
async function sbGet(qs) {
  const r = await fetch(`${SB_URL}/rest/v1/ad_autobid_log?${qs}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  return r.ok ? r.json() : [];
}

export const maxDuration = 60;

function sign(method, path) {
  const ts = Date.now();
  const sig = crypto.createHmac("sha256", NAVER_SECRET)
    .update(`${ts}.${method}.${path}`).digest("base64");
  return { "X-Timestamp": String(ts), "X-API-KEY": NAVER_API_KEY,
    "X-Customer": NAVER_CUSTOMER, "X-Signature": sig, "Content-Type": "application/json" };
}

async function call(method, path, qs, body) {
  const url = qs ? `${NAVER_BASE}${path}?${qs}` : `${NAVER_BASE}${path}`;
  const r = await fetch(url, { method, headers: sign(method, path),
    body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`naver ${path} ${r.status}: ${text.slice(0,150)}`);
  return data;
}

function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
const norm = (x) => String(x || "").replace(/\s+/g, "").toUpperCase();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if ((req.query.token || "") !== TOKEN) { res.status(404).end(); return; }
  try {
    // 키워드 이력: 입찰가 변동 그래프 재료
    if (req.query.hist) {
      const rows = await sbGet("kw=eq." + encodeURIComponent(req.query.hist)
        + "&order=run_at.asc&limit=500");
      res.status(200).json({ ok: true, rows });
      return;
    }
    // ① 그룹 + 살아있는 키워드
    const groups = await call("GET", "/ncc/adgroups", "nccCampaignId=" + encodeURIComponent(CAMPAIGN_ID));
    const rows = [];
    for (const g of groups) {
      const list = await call("GET", "/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(g.nccAdgroupId));
      for (const k of (Array.isArray(list) ? list : [])) {
        if ((k.bidAmt || 0) > 70) {
          rows.push({ id: k.nccKeywordId, kw: k.keyword, grp: g.name,
            bid: k.bidAmt, on: !k.userLock, st: k.status });
        }
      }
    }

    // ② 오늘 성과 (키워드 단위)
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const fields = encodeURIComponent(JSON.stringify(["impCnt","clkCnt","salesAmt","avgRnk"]));
    const tr = encodeURIComponent(JSON.stringify({ since: today, until: today }));
    const statMap = new Map();
    for (const part of chunk(rows, 100)) {
      const qs = part.map(r2 => "ids=" + encodeURIComponent(r2.id)).join("&")
        + "&fields=" + fields + "&timeRange=" + tr;
      try {
        const s = await call("GET", "/stats", qs);
        for (const d of (s && s.data || [])) statMap.set(d.id, d);
      } catch (e) { /* 통계 실패해도 표는 살린다 */ }
    }

    // ③ 모바일 1위가
    const estMap = new Map();
    for (const part of chunk(rows, 100)) {
      try {
        const r2 = await call("POST", "/estimate/average-position-bid/keyword", null, {
          device: "MOBILE", items: part.map(k => ({ key: k.kw, position: 1 })),
        });
        for (const e of (r2 && r2.estimate || [])) {
          const kk = e.keyword ?? e.key;
          if (kk != null) estMap.set(norm(kk), e.bid);
        }
      } catch (e) { /* skip */ }
    }

    for (const r2 of rows) {
      const s = statMap.get(r2.id) || {};
      r2.imp = s.impCnt || 0; r2.clk = s.clkCnt || 0;
      r2.cost = Math.round((s.salesAmt || 0) * 1.1);
      r2.rnk = s.avgRnk || null;
      r2.top1 = estMap.get(norm(r2.kw)) ?? null;
    }
    // 자동맞춤 최근 실행 (생존 신호)
    let lastRun = null;
    try {
      const lr = await sbGet("kw=eq._run&order=run_at.desc&limit=1");
      if (lr && lr[0]) lastRun = { at: lr[0].run_at, watched: lr[0].bid_from,
        changed: lr[0].bid_to, capped: lr[0].est1 };
    } catch (e) {}
    res.status(200).json({ ok: true, at: new Date().toISOString(), today, count: rows.length, lastRun, rows });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
