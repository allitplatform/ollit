// 2026-07-25 — 마케팅 화면 블록④ 광고 지출·CPA (네이버 검색광고 API).
// GET /api/ad-report?since=YYYY-MM-DD&until=YYYY-MM-DD&actor=<uuid>[&daily=1]
//   daily=1 이면 응답에 days:[{ymd,cost,clicks,impressions}] 추가 (마케팅 블록⑤ 일별 대조표).
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

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json({
      ok: true,
      cost, clicks, impressions, cpc, ctr,
      since, until,
      vatIncluded: false, // salesAmt 는 VAT 별도. 클라에서 ×1.1 로 실청구액 계산.
      days, daysMode,
    });
  } catch (e) {
    console.error("[ad-report]", e?.message || e);
    return res.status(200).json({ ok: false, error: e?.message || "naver API 실패" });
  }
}
