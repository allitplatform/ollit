// 2026-07-26 — 광고 관제판 데이터 API (api/ad-console.js)
// GET ?token=... → 살아있는 키워드 전체: 그룹/입찰가/상태 + 오늘 성과 + 모바일 1위가
// 프런트: /ads-console.html (독립 페이지)

import crypto from "crypto";

const NAVER_API_KEY  = process.env.NAVER_AD_API_KEY;
const NAVER_SECRET   = process.env.NAVER_AD_SECRET;
const NAVER_CUSTOMER = process.env.NAVER_AD_CUSTOMER_ID;
const NAVER_BASE     = "https://api.searchad.naver.com";
const TOKEN      = "85cd10a6b18bed7ad40ace71d23fb1fe0f244e425d6184bb"; // 업체용 보기 (추정만)
const TOKEN_FULL = "82ae0c34ae8eeec0f6932b82"; // 대표용 보기 (실제 접수 포함, 조작 불가)
const WRITE_TOKEN = "b29adde027905ee35c810634f09bda48a697f973fbdb8ca8"; // 관리자
const CAMPAIGN_ID = "cmp-a001-01-000000010808110";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
async function sbGetLog() {
  const r = await fetch(`${SB_URL}/rest/v1/ad_click_log?order=ts.desc&limit=800`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  const list = r.ok ? await r.json() : [];
  const byIp = {};
  for (const c of list) {
    const k = c.ip || "?";
    const v = byIp[k] = byIp[k] || { n: 0, last: null, ad: 0, ref: "" };
    v.n++; if (!v.last) v.last = c.ts;
    if ((c.qs || "").includes("n_") || (c.ref || "").includes("naver")) v.ad++;
    if (!v.ref && c.ref) v.ref = c.ref.slice(0, 60);
  }
  const ips = Object.entries(byIp).map(([ip, v]) => ({ ip, ...v }))
    .sort((a, b) => b.n - a.n).slice(0, 100);
  return { total: list.length, ips };
}

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
  const tk = req.query.token || "";
  if (tk !== TOKEN && tk !== TOKEN_FULL && tk !== WRITE_TOKEN) { res.status(404).end(); return; }
  try {
    // 보고서 목록
    if (req.query.reports) {
      const r = await fetch(`${SB_URL}/rest/v1/ad_daily_report?select=slug,d,created_at&order=created_at.desc&limit=60`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
      res.status(200).json({ ok: true, list: r.ok ? await r.json() : [] });
      return;
    }

    // 부정클릭 감시: 최근 클릭 로그 IP 집계
    if (req.query.clicks) {
      const rows = await sbGetLog();
      res.status(200).json({ ok: true, ...rows });
      return;
    }

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
          rows.push({ id: k.nccKeywordId, kw: k.keyword, grp: g.name, gid: g.nccAdgroupId,
            bid: k.bidAmt, on: !k.userLock, st: k.status });
        }
      }
    }

    // ② 오늘 성과 (키워드 단위)
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const fields = encodeURIComponent(JSON.stringify(["impCnt","clkCnt","salesAmt","avgRnk","ccnt"]));
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
      r2.imp = s.impCnt || 0; r2.clk = s.clkCnt || 0; r2.conv = s.ccnt || 0;
      r2.cost = Math.round((s.salesAmt || 0) * 1.1);
      r2.rnk = s.avgRnk || null;
      r2.top1 = estMap.get(norm(r2.kw)) ?? null;
    }
    // 월 검색량 조인
    try {
      const vr = await fetch(`${SB_URL}/rest/v1/ad_kw_volume?select=kw,vol_total,vol_mobile`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Range: "0-2000" } });
      if (vr.ok) {
        const vols = await vr.json();
        const vmap = new Map(vols.map(v => [norm(v.kw), v.vol_total]));
        for (const r2 of rows) r2.vol = vmap.get(norm(r2.kw)) ?? null;
      }
    } catch (e) {}

    // 오늘 실제 접수 (올데이케어 = 자체유입) — 관리 토큰 소지자에게만 (수익 정보)
    let todayJobs = null;
    try {
      if (tk !== TOKEN_FULL && tk !== WRITE_TOKEN && (req.query.wt || "") !== WRITE_TOKEN) throw new Error("viewer");
      const kstDay = today; // KST YYYY-MM-DD
      const startISO = new Date(`${kstDay}T00:00:00+09:00`).toISOString();
      const endISO   = new Date(`${kstDay}T23:59:59+09:00`).toISOString();
      const pr = await fetch(`${SB_URL}/rest/v1/principals?code=eq.allday&select=id`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }).then(r => r.json());
      const pid = pr && pr[0] && pr[0].id;
      if (pid) {
        const cr = await fetch(`${SB_URL}/rest/v1/tasks?principal_id=eq.${pid}`
          + `&created_at=gte.${encodeURIComponent(startISO)}&created_at=lt.${encodeURIComponent(endISO)}&select=id`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
            Prefer: "count=exact", Range: "0-0" } });
        const cRange = cr.headers.get("content-range");
        if (cRange && cRange.includes("/")) todayJobs = Number(cRange.split("/")[1]);
      }
    } catch (e) {}

    // 키워드별 마지막 입찰 조정 시각
    try {
      const logs = await sbGet("kw=neq._run&order=run_at.desc&limit=2000&select=kw,run_at");
      const lmap = new Map();
      for (const l of logs) { const k = norm(l.kw); if (!lmap.has(k)) lmap.set(k, l.run_at); }
      for (const r2 of rows) r2.lastBid = lmap.get(norm(r2.kw)) || null;
    } catch (e) {}

    // 자동맞춤 최근 실행 (생존 신호)
    let lastRun = null;
    try {
      const lr = await sbGet("kw=eq._run&order=run_at.desc&limit=1");
      if (lr && lr[0]) lastRun = { at: lr[0].run_at, watched: lr[0].bid_from,
        changed: lr[0].bid_to, capped: lr[0].est1 };
    } catch (e) {}
    res.status(200).json({ ok: true, at: new Date().toISOString(), today, count: rows.length, lastRun, todayJobs, rows });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
