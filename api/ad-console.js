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
// 영어 지명 → 한글 (서울 25구 + 수도권 주요 시 · IP 지오 DB가 영문 로마자로 줘서 변환)
const KO_PLACE = { "Seoul":"서울","Incheon":"인천","Gyeonggi-do":"경기","Busan":"부산","Daegu":"대구","Daejeon":"대전","Gwangju":"광주","Ulsan":"울산","Sejong-si":"세종",
  "Jongno-gu":"종로구","Jung-gu":"중구","Yongsan-gu":"용산구","Seongdong-gu":"성동구","Gwangjin-gu":"광진구","Dongdaemun-gu":"동대문구","Jungnang-gu":"중랑구","Seongbuk-gu":"성북구","Gangbuk-gu":"강북구","Dobong-gu":"도봉구","Nowon-gu":"노원구","Eunpyeong-gu":"은평구","Seodaemun-gu":"서대문구","Mapo-gu":"마포구","Yangcheon-gu":"양천구","Gangseo-gu":"강서구","Guro-gu":"구로구","Geumcheon-gu":"금천구","Yeongdeungpo-gu":"영등포구","Dongjak-gu":"동작구","Gwanak-gu":"관악구","Seocho-gu":"서초구","Gangnam-gu":"강남구","Songpa-gu":"송파구","Gangdong-gu":"강동구",
  "Goyang-si":"고양시","Paju-si":"파주시","Gimpo-si":"김포시","Bucheon-si":"부천시","Suwon-si":"수원시","Seongnam-si":"성남시","Yongin-si":"용인시","Anyang-si":"안양시","Ansan-si":"안산시","Namyangju-si":"남양주시","Uijeongbu-si":"의정부시","Hwaseong-si":"화성시","Siheung-si":"시흥시","Pyeongtaek-si":"평택시","Gwangmyeong-si":"광명시","Hanam-si":"하남시","Guri-si":"구리시","Goyang":"고양시","Incheon Metropolitan City":"인천" };
function koPlace(s) { if (!s) return s; return KO_PLACE[s] || s; }
function koIsp(s) {
  if (!s) return s; const t = String(s).toLowerCase();
  if (t.includes("korea telecom") || t.includes("kt ")) return "KT";
  if (t.includes("sk broadband") || t.includes("hanaro")) return "SK브로드밴드";
  if (t.includes("sk telecom")) return "SKT";
  if (t.includes("lg dacom") || t.includes("lg powercomm") || t.includes("lg uplus") || t.includes("lguplus")) return "LG유플러스";
  return s;
}

async function sbGetLog() {
  const r = await fetch(`${SB_URL}/rest/v1/ad_click_log?order=ts.desc&limit=800`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  const list = r.ok ? await r.json() : [];
  const byIp = {};
  for (const c of list) {
    const k = c.ip || "?";
    const v = byIp[k] = byIp[k] || { n: 0, last: null, ad: 0, ref: "", times: [], bot: false };
    v.n++; if (!v.last) v.last = c.ts;
    if ((c.ref || "").includes("navercorp")) v.bot = true; // 네이버 내부 점검봇 (과금 아님)
    else if ((c.qs || "").includes("n_") || (c.ref || "").includes("naver")) { v.ad++; v.times.push(new Date(c.ts).getTime()); }
    if (!v.ref && c.ref) v.ref = c.ref.slice(0, 60);
  }
  // 연타 감지: 광고 클릭 3번이 10분 안에 몰려 있으면 의심
  for (const v of Object.values(byIp)) {
    v.times.sort((a, b) => a - b);
    v.burst = false;
    for (let i = 0; i + 2 < v.times.length; i++) if (v.times[i + 2] - v.times[i] <= 600000) { v.burst = true; break; }
    delete v.times;
  }
  // 정렬: 의심(연타·광고4회+) 먼저 → 광고 유입 많은 순 → 방문 순. 네이버 점검봇은 맨 아래.
  const score = v => v.bot ? -1 : ((v.burst || v.ad >= 4) ? 2 : (v.n >= 4 ? 1 : 0));
  const ips = Object.entries(byIp).map(([ip, v]) => ({ ip, ...v }))
    .sort((a, b) => (score(b) - score(a)) || (b.ad - a.ad) || (b.n - a.n)).slice(0, 100);
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
    // 보고서 목록 — 대표/관리자만 (업체 비번에는 안 보임)
    if (req.query.reports) {
      if (tk === TOKEN) { res.status(200).json({ ok: true, list: [] }); return; }
      const r = await fetch(`${SB_URL}/rest/v1/ad_daily_report?select=slug,d,created_at&order=created_at.desc&limit=60`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
      res.status(200).json({ ok: true, list: r.ok ? await r.json() : [] });
      return;
    }

    // 흐름 데이터 (?trend=1): 시간대별 지출 곡선 + 실측 순위 48시간 추세
    if (req.query.trend) {
      const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      const out = { ok: true, spend: [], snap: null, serp: {} };
      try {
        const s = await fetch(`${SB_URL}/rest/v1/ad_autobid_log?kw=eq._bizmoney&grp=eq.${kst}&order=run_at.asc&limit=1&select=bid_from`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }).then(r => r.json());
        if (s && s[0]) out.snap = s[0].bid_from;
        const b = await fetch(`${SB_URL}/rest/v1/ad_autobid_log?kw=eq._bz&grp=eq.${kst}&order=run_at.asc&limit=200&select=run_at,bid_from`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }).then(r => r.json());
        if (Array.isArray(b) && out.snap) out.spend = b.map(x => ({ at: x.run_at, won: Math.max(0, out.snap - x.bid_from) }));
      } catch (e) {}
      try {
        const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
        const sr = await fetch(`${SB_URL}/rest/v1/ad_serp_rank?ts=gte.${encodeURIComponent(since)}&order=ts.asc&limit=1000&select=ts,kw,rank,rival`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }).then(r => r.json());
        for (const r2 of (Array.isArray(sr) ? sr : [])) {
          (out.serp[r2.kw] = out.serp[r2.kw] || []).push({ t: r2.ts, r: r2.rank, v: r2.rival });
        }
      } catch (e) {}
      res.status(200).json(out);
      return;
    }

    // 부정클릭 감시: 최근 클릭 로그 IP 집계 (+ ?ip=x.x.x.x 시간대 상세)
    if (req.query.clicks) {
      if (req.query.ip) {
        const r = await fetch(`${SB_URL}/rest/v1/ad_click_log?ip=eq.${encodeURIComponent(req.query.ip)}&order=ts.desc&limit=100&select=ts,qs,ref`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
        const list = r.ok ? await r.json() : [];
        // IP 위치 조회 (시군구 수준 · 휴대폰 IP는 통신사 관문 위치라 부정확할 수 있음)
        let geo = null;
        try {
          const g = await fetch(`http://ip-api.com/json/${encodeURIComponent(req.query.ip)}?lang=ko&fields=status,country,regionName,city,isp,mobile`);
          const gj = await g.json();
          if (gj && gj.status === "success") geo = { region: koPlace(gj.regionName), city: koPlace(gj.city), isp: koIsp(gj.isp), mobile: !!gj.mobile };
        } catch (e) {}
        res.status(200).json({ ok: true, ip: req.query.ip, geo,
          rows: list.map(c => ({ ts: c.ts,
            ad: (c.qs || "").includes("n_") || (c.ref || "").includes("naver"),
            kw: (() => { try { const m = /n_(?:keyword|query)=([^&]+)/.exec(c.qs || ""); return m ? decodeURIComponent(m[1]) : null; } catch (e) { return null; } })() })) });
        return;
      }
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
    // 실측 순위 (30분마다 검색결과 확인 — 핵심 10개)
    let serp = null;
    try {
      const sr = await fetch(`${SB_URL}/rest/v1/ad_serp_rank?select=kw,rank,ads_total,rival,blocked,ts&order=ts.desc&limit=10`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
      if (sr.ok) {
        const list = await sr.json();
        serp = {};
        for (const r2 of list) if (!(r2.kw in serp)) serp[r2.kw] = { rank: r2.rank, ads: r2.ads_total, rival: r2.rival, at: r2.ts, blocked: r2.blocked };
      }
    } catch (e) {}
    res.status(200).json({ ok: true, at: new Date().toISOString(), today, count: rows.length, lastRun, todayJobs, serp, rows });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
