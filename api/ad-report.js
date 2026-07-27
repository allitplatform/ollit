// 2026-07-25 — 마케팅 화면 블록④ 광고 지출·CPA (네이버 검색광고 API).
// GET /api/ad-report?since=YYYY-MM-DD&until=YYYY-MM-DD&actor=<uuid>[&daily=1]
//   daily=1    → days:[{ymd,cost,clicks,impressions}]            (블록⑤ 일별 대조)
//   keywords=1 → keywords:[{id,text,cost,clicks,impressions,avgRnk}] (블록⑥ 키워드별 진단)
//
// 관리자 게이트: actor(uuid) → user_roles.role IN ('owner','admin') 확인.
//   PUSH_API_KEY 방식 미사용 (클라에서 호출하는 엔드포인트라 키 노출 우려).
//
// 네이버 API 호출 2단계:
//   ① GET /ncc/campaigns → 캠페인 id 목록
//   ② GET /stats?ids=[...]&fields=[...]&timeRange={...} → 지표 집계
//
// 서명 (HMAC-SHA256):
//   `${timestamp}.${method}.${path}` (path 는 쿼리스트링 제외한 경로만)
//   헤더: X-Timestamp / X-API-KEY / X-Customer / X-Signature
//
// 응답: { ok:true, cost, clicks, impressions, cpc, ctr, since, until, vatIncluded:false, days? }
//   - cost 는 네이버 salesAmt (VAT 별도). 클라에서 ×1.1 로 VAT 포함 CPA 계산.
//   - 광고 API 실패 시에도 500 던지지 말고 200 + { ok:false, error } — 나머지 3블록 살아야.
//
// 환경변수 (Vercel Production 에 이미 등록):
//   NAVER_AD_API_KEY / NAVER_AD_SECRET / NAVER_AD_CUSTOMER_ID
//   VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const SUPABASE_URL     = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NAVER_API_KEY  = process.env.NAVER_AD_API_KEY;
const NAVER_SECRET   = process.env.NAVER_AD_SECRET;
const NAVER_CUSTOMER = process.env.NAVER_AD_CUSTOMER_ID;
const NAVER_BASE     = "https://api.searchad.naver.com";

const ADMIN_ROLES = new Set(["owner", "admin"]);
const UUID_RE     = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YMD_RE      = /^\d{4}-\d{2}-\d{2}$/;

const supabase = (SUPABASE_URL && SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function signNaver(method, path) {
  const ts  = Date.now();
  const sig = crypto
    .createHmac("sha256", NAVER_SECRET)
    .update(`${ts}.${method}.${path}`)
    .digest("base64");
  return {
    "X-Timestamp": String(ts),
    "X-API-KEY":   NAVER_API_KEY,
    "X-Customer":  NAVER_CUSTOMER,
    "X-Signature": sig,
  };
}

async function naverGet(path, queryString) {
  const url = queryString ? `${NAVER_BASE}${path}?${queryString}` : `${NAVER_BASE}${path}`;
  const r = await fetch(url, { method: "GET", headers: signNaver("GET", path) });
  const text = await r.text();
  if (!r.ok) {
    // 2026-07-25 — 4xx 는 요청 쿼리스트링도 error 에 포함 (디버깅 왕복 축소).
    //   ⚠️ 헤더(X-API-KEY / X-Signature) 는 절대 포함하지 않음.
    const qsPart = (queryString && r.status >= 400 && r.status < 500)
      ? ` | qs=${queryString.slice(0, 500)}`
      : "";
    const err = new Error(`naver ${path} ${r.status}: ${text.slice(0, 300)}${qsPart}`);
    err.status = r.status;
    throw err;
  }
  try { return JSON.parse(text); } catch { return text; }
}

// ── 일별 분해 ────────────────────────────────────────────────────────────────
//   1순위: /stats 에 timeIncrement=allDays → 요청 1회로 일별 행.
//   2순위(대체): 하루씩 timeRange 를 끊어 호출. 느리지만 검증된 경로라 확실하다.
function _dayList(since, until) {
  const out = [];
  const d = new Date(`${since}T00:00:00Z`);
  const last = new Date(`${until}T00:00:00Z`);
  while (d <= last && out.length < 200) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function fetchDaily(ids, since, until) {
  const fields = ["impCnt", "clkCnt", "salesAmt"];
  const idsQs  = ids.map(id => "ids=" + encodeURIComponent(id)).join("&");

  // ① timeIncrement=allDays
  try {
    const qs = idsQs
      + "&fields="        + encodeURIComponent(JSON.stringify(fields))
      + "&timeRange="     + encodeURIComponent(JSON.stringify({ since, until }))
      + "&timeIncrement=" + encodeURIComponent("allDays");
    const s = await naverGet("/stats", qs);
    const rows = Array.isArray(s?.data) ? s.data : Array.isArray(s) ? s : [];
    const agg = new Map();
    for (const r of rows) {
      const raw = r?.dateStartDate || r?.statDt || r?.date || r?.dt || "";
      const ymd = String(raw).slice(0, 10);
      if (!YMD_RE.test(ymd)) continue;
      const cur = agg.get(ymd) || { ymd, cost: 0, clicks: 0, impressions: 0 };
      cur.impressions += Number(r?.impCnt   || 0);
      cur.clicks      += Number(r?.clkCnt   || 0);
      cur.cost        += Number(r?.salesAmt || 0);
      agg.set(ymd, cur);
    }
    if (agg.size > 1) {
      return { mode: "allDays", rows: [...agg.values()].sort((a, b) => (a.ymd < b.ymd ? -1 : 1)) };
    }
  } catch (e) {
    console.error("[ad-report] timeIncrement=allDays 실패 → 일별 루프 대체:", e?.message || e);
  }

  // ② 하루씩 (동시 4개, 최대 62일)
  const list = _dayList(since, until).slice(0, 62);
  const out  = [];
  const CONC = 4;
  for (let i = 0; i < list.length; i += CONC) {
    const chunk = list.slice(i, i + CONC);
    const got = await Promise.all(chunk.map(async ymd => {
      try {
        const qs = idsQs
          + "&fields="    + encodeURIComponent(JSON.stringify(fields))
          + "&timeRange=" + encodeURIComponent(JSON.stringify({ since: ymd, until: ymd }));
        const s = await naverGet("/stats", qs);
        const rows = Array.isArray(s?.data) ? s.data : Array.isArray(s) ? s : [];
        let cost = 0, clicks = 0, impressions = 0;
        for (const r of rows) {
          impressions += Number(r?.impCnt   || 0);
          clicks      += Number(r?.clkCnt   || 0);
          cost        += Number(r?.salesAmt || 0);
        }
        return { ymd, cost, clicks, impressions };
      } catch {
        return { ymd, cost: 0, clicks: 0, impressions: 0, err: true };
      }
    }));
    out.push(...got);
  }
  return { mode: "perDay", rows: out };
}

// ── 키워드별 성과 ──────────────────────────────────────
//   "예산을 다 못 쓴다" 의 원인을 가르는 지표 2개:
//     avgRnk(평균노출순위) 1~2위인데 노출이 안 늘면 = 검색량 천장.
//     avgRnk 3위 밖이면                    = 순위 밀림 (입찰가 올리면 예산 소진 가능).
//     노출 0 인 키워드 수               = 죽은 키워드 (입찰가가 너무 낮아 아예 안 뜬다).
//   경로: /ncc/campaigns → /ncc/adgroups → /ncc/keywords → /stats(ids=키워드id)
const KW_LIMITS = {
  campaigns:    50,
  adgroups:     300,
  detailGroups: 6,     // 키워드 상세는 광고비 큰 그룹만. 전체는 수만개라 못 가져온다.
  keywords:     4000,
  show:         300,
};

// 동시 실행 헬퍼. 순차 루프로는 Vercel 타임아웃이 난다.
async function _mapLimit(items, conc, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += conc) {
    out.push(...await Promise.all(items.slice(i, i + conc).map(fn)));
  }
  return out;
}

// /stats 는 캠페인·광고그룹·키워드 id 를 다 받는다. 그룹 단위는 이걸로 한 번에 끝낸다.
//   키워드를 합산해서 그룹 값을 만들면, 키워드를 다 못 가져왔을 때 광고비가 0 으로 보인다.
async function fetchStatsByIds(ids, since, until) {
  const fields = ["impCnt", "clkCnt", "salesAmt", "avgRnk", "ccnt"];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const map = new Map();
  await _mapLimit(chunks, 4, async chunk => {
    try {
      const qs =
        chunk.map(id => "ids=" + encodeURIComponent(id)).join("&") +
        "&fields="    + encodeURIComponent(JSON.stringify(fields)) +
        "&timeRange=" + encodeURIComponent(JSON.stringify({ since, until }));
      const st = await naverGet("/stats", qs);
      const rows = Array.isArray(st?.data) ? st.data : Array.isArray(st) ? st : [];
      for (const r of rows) {
        const id = r?.id || r?.nccKeywordId || r?.nccAdgroupId;
        if (id) map.set(id, r);
      }
    } catch (e) { console.error("[ad-report] stats 실패", e?.message || e); }
  });
  return map;
}

function _statRow(r) {
  return {
    impressions: Number(r?.impCnt   || 0),
    clicks:      Number(r?.clkCnt   || 0),
    cost:        Number(r?.salesAmt || 0),
    conv:        Number(r?.ccnt     || 0),
    avgRnk:      Number(r?.avgRnk   || 0),
  };
}

async function fetchKeywords(campaignIds, since, until) {
  const t0 = Date.now();
  const DEADLINE = 22000;

  // ① 광고그룹
  const groups = [];
  await _mapLimit(campaignIds.slice(0, KW_LIMITS.campaigns), 4, async cid => {
    try {
      const gs = await naverGet("/ncc/adgroups", "nccCampaignId=" + encodeURIComponent(cid));
      for (const g of (Array.isArray(gs) ? gs : [])) {
        const gid = g && (g.nccAdgroupId || g.id);
        if (!gid) continue;
        groups.push({ id: gid, name: String(g.name || gid), bidAmt: Number(g.bidAmt || 0) });
      }
    } catch (e) { console.error("[ad-report] adgroups 실패", cid, e?.message || e); }
  });
  if (groups.length === 0) {
    return { rows: [], groups: [], meta: { adgroups: 0, total: 0, live: 0, shown: 0, dead: 0, truncated: false } };
  }

  const gUse = groups.slice(0, KW_LIMITS.adgroups);

  // ② 그룹 통계 — 여기가 표의 진짜 숫자다. 키워드 합산이 아니다.
  const gStats = await fetchStatsByIds(gUse.map(g => g.id), since, until);
  const groupRows = gUse.map(g => ({
    id: g.id, name: g.name, bidAmt: g.bidAmt,
    ..._statRow(gStats.get(g.id)),
    kwTotal: null, kwLive: null,   // 상세를 조사한 그룹만 채운다
  })).sort((a, b) => b.cost - a.cost);

  // ③ 키워드 상세 — 광고비 큰 그룹만. 나머지는 어차피 볼 게 없다.
  const detail = groupRows.slice(0, KW_LIMITS.detailGroups);
  const kwMap  = new Map();
  await _mapLimit(detail.map(g => g.id), 4, async gid => {
    if (Date.now() - t0 > DEADLINE) return;
    try {
      const ks = await naverGet("/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(gid));
      const arr = Array.isArray(ks) ? ks : [];
      const row = groupRows.find(g => g.id === gid);
      if (row) { row.kwTotal = arr.length; row.kwLive = 0; }
      for (const k of arr) {
        const kid = k && (k.nccKeywordId || k.id);
        if (!kid || k.userLock === true) continue;
        if (kwMap.size >= KW_LIMITS.keywords) return;
        const useGroupBid = k.useGroupBidAmt === true;
        kwMap.set(kid, {
          text:        String(k.keyword || k.name || kid),
          gid,
          gname:       row?.name || "",
          bid:         useGroupBid ? Number(row?.bidAmt || 0) : Number(k.bidAmt || 0),
          useGroupBid,
        });
      }
    } catch (e) { console.error("[ad-report] keywords 실패", gid, e?.message || e); }
  });

  // ④ 키워드 통계
  const kStats = kwMap.size > 0 ? await fetchStatsByIds([...kwMap.keys()], since, until) : new Map();

  const live = [];
  let dead = 0, deadBidSum = 0, deadMinBid = 0;
  for (const [id, info] of kwMap) {
    const st = _statRow(kStats.get(id));
    if (st.impressions <= 0 && st.clicks <= 0) {
      dead += 1; deadBidSum += info.bid;
      if (info.bid > 0 && info.bid <= 100) deadMinBid += 1;
      continue;
    }
    const row = groupRows.find(g => g.id === info.gid);
    if (row) row.kwLive = (row.kwLive || 0) + 1;
    live.push({ id, text: info.text, group: info.gname, bid: info.bid, useGroupBid: info.useGroupBid, ...st });
  }
  live.sort((a, b) => b.cost - a.cost);

  return {
    rows: live.slice(0, KW_LIMITS.show),
    groups: groupRows,
    meta: {
      adgroups:     gUse.length,
      adgroupsAll:  groups.length,
      detailGroups: detail.length,
      total:        kwMap.size,
      live:         live.length,
      shown:        Math.min(live.length, KW_LIMITS.show),
      dead,
      deadAvgBid:   dead > 0 ? Math.round(deadBidSum / dead) : 0,
      deadMinBidPct: dead > 0 ? deadMinBid / dead : 0,
      // 상세를 안 본 그룹이 있거나, 키워드 상한에 걸렸으면 '일부만 봤다' 고 알린다.
      partial:      groupRows.length > detail.length || kwMap.size >= KW_LIMITS.keywords,
      truncated:    groups.length > gUse.length,
      ms:           Date.now() - t0,
    },
  };
}

// ── 키워드도구 (검색량 조회) ─────────────────────────────────────────────────
//   GET /keywordstool?hintKeywords=a,b,c&showDetail=1
//   - hintKeywords 는 한 번에 5개까지. 더 넣으면 네이버가 조용히 잘라먹는다.
//   - 월 검색량이 10 미만이면 숫자가 아니라 "< 10" 문자열로 온다. Number() 하면 NaN.
//   - 응답의 relKeyword 는 공백 없는 형태다. 우리 등록 키워드와 맞추려면 양쪽 다 정규화해야 한다.
function _normKw(v) {
  return String(v || "").replace(/\s+/g, "").toLowerCase();
}
function _qcNum(v) {
  const n = Number(String(v == null ? "" : v).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function _qcLow(v) {
  return typeof v === "string" && v.indexOf("<") >= 0;
}

async function fetchKeywordTool(seeds) {
  const chunks = [];
  for (let i = 0; i < seeds.length; i += 5) chunks.push(seeds.slice(i, i + 5));
  const map = new Map();
  await _mapLimit(chunks, 3, async chunk => {
    try {
      const qs = "hintKeywords=" + encodeURIComponent(chunk.join(",")) + "&showDetail=1";
      const r = await naverGet("/keywordstool", qs);
      const list = Array.isArray(r?.keywordList) ? r.keywordList : [];
      for (const k of list) {
        const word = String(k?.relKeyword || "").trim();
        if (!word) continue;
        const pc = _qcNum(k.monthlyPcQcCnt);
        const mo = _qcNum(k.monthlyMobileQcCnt);
        const prev = map.get(word);
        if (prev && prev.total >= pc + mo) continue;
        map.set(word, {
          keyword: word,
          pc, mobile: mo, total: pc + mo,
          low:  _qcLow(k.monthlyPcQcCnt) && _qcLow(k.monthlyMobileQcCnt),
          comp: String(k.compIdx || ""),
        });
      }
    } catch (e) { console.error("[ad-report] keywordstool 실패", e?.message || e); }
  });
  return map;
}

// 전 광고그룹의 '등록된 키워드 단어' 만 수집. 통계는 안 부른다 — 그래서 싸다.
async function fetchRegisteredKeywords(campaignIds) {
  const groups = [];
  await _mapLimit(campaignIds.slice(0, KW_LIMITS.campaigns), 4, async cid => {
    try {
      const gs = await naverGet("/ncc/adgroups", "nccCampaignId=" + encodeURIComponent(cid));
      for (const g of (Array.isArray(gs) ? gs : [])) {
        const gid = g && (g.nccAdgroupId || g.id);
        if (gid) groups.push({ id: gid, name: String(g.name || gid) });
      }
    } catch (e) { console.error("[ad-report] adgroups(reg) 실패", cid, e?.message || e); }
  });
  const reg = new Map();
  await _mapLimit(groups.slice(0, KW_LIMITS.adgroups), 4, async g => {
    try {
      const ks = await naverGet("/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(g.id));
      for (const k of (Array.isArray(ks) ? ks : [])) {
        const w = _normKw(k?.keyword || k?.name || "");
        if (!w || reg.has(w)) continue;
        reg.set(w, { group: g.name, on: k?.userLock !== true });
      }
    } catch (e) { console.error("[ad-report] keywords(reg) 실패", g.id, e?.message || e); }
  });
  return { reg, groupCount: groups.length };
}

async function assertAdmin(actor) {
  if (!actor || !UUID_RE.test(actor)) return { ok: false, code: 400, error: "actor(uuid) required" };
  if (!supabase) return { ok: false, code: 500, error: "supabase service role 미구성" };
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", actor);
  if (error) return { ok: false, code: 500, error: error.message || "user_roles 조회 실패" };
  const roles = (data || []).map(r => r.role);
  if (!roles.some(r => ADMIN_ROLES.has(r))) {
    return { ok: false, code: 403, error: "admin only" };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const since = String(req.query.since || "");
  const until = String(req.query.until || "");
  const actor = String(req.query.actor || "");
  const wantDaily = String(req.query.daily || "") === "1";
  const wantKw    = String(req.query.keywords || "") === "1";
  const wantTool  = String(req.query.tool || "") === "1";
  const wantLive  = String(req.query.live || "") === "1"; // 지금 실시간 카드용 (오늘 접수·자동입찰 생존 포함)
  const seedsRaw  = String(req.query.seeds || "");

  if (!YMD_RE.test(since) || !YMD_RE.test(until)) {
    return res.status(400).json({ ok: false, error: "since/until = YYYY-MM-DD 필수" });
  }
  if (since > until) {
    return res.status(400).json({ ok: false, error: "since > until" });
  }

  const gate = await assertAdmin(actor);
  if (!gate.ok) return res.status(gate.code).json({ ok: false, error: gate.error });

  if (!NAVER_API_KEY || !NAVER_SECRET || !NAVER_CUSTOMER) {
    return res.status(200).json({
      ok: false,
      error: "NAVER_AD_API_KEY / NAVER_AD_SECRET / NAVER_AD_CUSTOMER_ID 환경변수 누락",
    });
  }

  // ── 키워드도구 모드 — 검색량 순으로 '우리한테 없는 단어' 찾기 ────────────────
  //   기간 통계와 무관하므로 여기서 끝낸다. 무거운 /stats 를 아예 안 탄다.
  if (wantTool) {
    const seeds = seedsRaw.split(",").map(x => x.trim()).filter(Boolean).slice(0, 20);
    if (seeds.length === 0) {
      return res.status(400).json({ ok: false, error: "seeds(쉼표구분) 필수" });
    }
    try {
      const cps = await naverGet("/ncc/campaigns", "");
      const cids = Array.isArray(cps)
        ? cps.map(c => c && (c.nccCampaignId || c.id)).filter(Boolean)
        : [];
      const [volMap, regRes] = await Promise.all([
        fetchKeywordTool(seeds),
        fetchRegisteredKeywords(cids),
      ]);
      const rows = [...volMap.values()]
        .map(v => {
          const hit = regRes.reg.get(_normKw(v.keyword));
          return {
            ...v,
            registered: !!hit,
            group: hit ? hit.group : null,
            on:    hit ? hit.on : null,
          };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 500);
      const missing = rows.filter(r => !r.registered);
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
      return res.status(200).json({
        ok: true,
        tool: {
          rows,
          seeds,
          found:        volMap.size,
          registered:   regRes.reg.size,
          adgroups:     regRes.groupCount,
          missingCount: missing.length,
          missingVol:   missing.reduce((a, b) => a + b.total, 0),
        },
      });
    } catch (e) {
      console.error("[ad-report] tool", e?.message || e);
      return res.status(200).json({ ok: false, error: e?.message || "키워드도구 호출 실패" });
    }
  }

  // 광고 API 실패해도 마케팅 화면 나머지 3블록은 살아야 함 → try/catch 로 200 + ok:false 반환.
  try {
    // ① 캠페인 id 목록
    const campaigns = await naverGet("/ncc/campaigns", "");
    const ids = Array.isArray(campaigns)
      ? campaigns.map(c => c && (c.nccCampaignId || c.id)).filter(Boolean)
      : [];
    if (ids.length === 0) {
      res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
      return res.status(200).json({
        ok: true,
        cost: 0, clicks: 0, impressions: 0, cpc: 0, ctr: 0,
        since, until, vatIncluded: false,
        days: wantDaily ? [] : undefined,
        note: "캠페인 없음",
      });
    }

    // ② /stats — ids 는 반복 쿼리 파라미터 형식 (JSON 배열로 넣으면 네이버가 통째로 1개 ID 로
    //    파싱해 11001 BAD_REQUEST). fields / timeRange 는 JSON 유지. 서명은 "/stats" 경로만.
    const fields    = ["impCnt", "clkCnt", "salesAmt"];
    const timeRange = { since, until };
    const qs =
      ids.map(id => "ids=" + encodeURIComponent(id)).join("&") +
      "&fields="    + encodeURIComponent(JSON.stringify(fields)) +
      "&timeRange=" + encodeURIComponent(JSON.stringify(timeRange));

    const stats = await naverGet("/stats", qs);
    // 응답 형식: { data: [{ id, impCnt, clkCnt, salesAmt }, ...] } 또는 배열 자체.
    const rows = Array.isArray(stats?.data) ? stats.data
              : Array.isArray(stats)        ? stats
              : [];

    let impressions = 0, clicks = 0, cost = 0;
    for (const r of rows) {
      impressions += Number(r?.impCnt   || 0);
      clicks      += Number(r?.clkCnt   || 0);
      cost        += Number(r?.salesAmt || 0);
    }
    const cpc = clicks > 0 ? Math.round(cost / clicks) : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;

    let days = undefined, daysMode = undefined;
    if (wantDaily) {
      const d = await fetchDaily(ids, since, until);
      days = d.rows;
      daysMode = d.mode;
    }

    let keywords = undefined, keywordMeta = undefined, adGroups = undefined;
    if (wantKw) {
      try {
        const kwRes = await fetchKeywords(ids, since, until);
        keywords    = kwRes.rows;
        adGroups    = kwRes.groups;
        keywordMeta = kwRes.meta;
      } catch (e) {
        console.error("[ad-report] keywords 블록 실패", e?.message || e);
        keywords    = [];
        adGroups    = [];
        keywordMeta = { error: String(e?.message || e) };
      }
    }

    // ── 지금 실시간 (live=1): 오늘 실접수 수 + 자동입찰 생존 신호 ──────────────
    let live = undefined;
    if (wantLive && supabase) {
      live = {};
      try {
        const kstDay = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
        const startISO = new Date(`${kstDay}T00:00:00+09:00`).toISOString();
        const endISO   = new Date(`${kstDay}T23:59:59+09:00`).toISOString();
        const { data: pr } = await supabase.from("principals").select("id").eq("code", "allday").limit(1);
        const pid = pr && pr[0] && pr[0].id;
        if (pid) {
          const { count } = await supabase.from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("principal_id", pid)
            .gte("created_at", startISO).lt("created_at", endISO);
          live.jobsToday = count ?? null;
        }
      } catch (e) { live.jobsToday = null; }
      try {
        const { data: lr } = await supabase.from("ad_autobid_log")
          .select("run_at,bid_from,bid_to,est1").eq("kw", "_run")
          .order("run_at", { ascending: false }).limit(1);
        if (lr && lr[0]) live.lastRun = { at: lr[0].run_at, watched: lr[0].bid_from, changed: lr[0].bid_to };
      } catch (e) {}
      // 실시간 지출 (비즈머니 방식): 오늘 0시 잔액 스냅샷 − 지금 잔액.
      // 보고서 API(위 cost)는 1~2시간 지연되므로, 스냅샷이 있으면 이 값을 우선 사용.
      try {
        const kstDay2 = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
        const { data: snap } = await supabase.from("ad_autobid_log")
          .select("bid_from").eq("kw", "_bizmoney").eq("grp", kstDay2)
          .order("run_at", { ascending: true }).limit(1);
        if (snap && snap[0] && snap[0].bid_from > 0) {
          const bz = await naverGet("/billing/bizmoney", "");
          const nowBal = bz && (bz.bizmoney ?? bz.balance);
          if (nowBal != null) {
            const spent = Math.max(0, Number(snap[0].bid_from) - Number(nowBal));
            if (spent >= 0) live.spendRealtime = spent; // VAT 취급은 클라에서 보고서와 동일하게 ×1.1
          }
        }
      } catch (e) {}
    }

    res.setHeader("Cache-Control", wantLive ? "no-store" : "s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json({
      ok: true,
      cost, clicks, impressions, cpc, ctr,
      since, until,
      vatIncluded: false, // salesAmt 는 VAT 별도. 클라에서 ×1.1 로 실청구액 계산.
      days, daysMode, keywords, adGroups, keywordMeta, live,
    });
  } catch (e) {
    console.error("[ad-report]", e?.message || e);
    return res.status(200).json({ ok: false, error: e?.message || "naver API 실패" });
  }
}
