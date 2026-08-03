// 2026-08-03 — 유솔홈케어(에어컨세척) 광고 계정 전용 API (api/yusol-ad.js)
// 올잇 컨설팅 1호 광고주. 올데이 코드(ad-report/ad-console)와 완전 분리 — 서로 영향 없음.
//
// GET /api/yusol-ad?token=...&since=YYYY-MM-DD&until=YYYY-MM-DD[&daily=1]
//   응답: { ok, cost, clicks, impressions, conv, convAmt, cpc,
//           campaigns:[{id,name,type,cost,clicks,impressions,conv,convAmt}],
//           days:[{ymd,cost,clicks,impressions,conv}] }   // daily=1
//   - cost 는 네이버 salesAmt (VAT 별도). 클라에서 ×1.1.
//   - conv = 네이버 ccnt (프리미엄 로그분석 주문 전환). 승인 전에는 0.
//   - 전환 필드가 400 을 내면 기본 필드로 재시도 (계정 상태에 따라 미지원 가능).
//
// 환경변수 (Vercel Production 에 추가 필요):
//   YUSOL_AD_API_KEY / YUSOL_AD_SECRET / YUSOL_AD_CUSTOMER_ID (=622180)
//
// 부정클릭 감시: 서버는 일별 원자료만 제공, 급증 판정(오늘 vs 직전7일 평균)은
//   마케팅 화면에서 계산. 유솔 랜딩이 스마트스토어(네이버 소유)라 방문 IP 수집은 불가 —
//   올데이(click-log) 방식은 쓸 수 없고 클릭 통계 기반으로 감시한다.

import crypto from "crypto";

const API_KEY  = process.env.YUSOL_AD_API_KEY;
const SECRET   = process.env.YUSOL_AD_SECRET;
const CUSTOMER = process.env.YUSOL_AD_CUSTOMER_ID;
const BASE     = "https://api.searchad.naver.com";

// 읽기 전용 토큰 (마케팅 화면·향후 유솔 공유용 관제판에서 사용)
const TOKEN = "yz74c1e0a95d2b8f36e41c07";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export const maxDuration = 60;

function sign(method, path) {
  const ts = Date.now();
  const sig = crypto.createHmac("sha256", SECRET)
    .update(`${ts}.${method}.${path}`).digest("base64");
  return { "X-Timestamp": String(ts), "X-API-KEY": API_KEY,
    "X-Customer": CUSTOMER, "X-Signature": sig };
}

async function naverGet(path, queryString) {
  const url = queryString ? `${BASE}${path}?${queryString}` : `${BASE}${path}`;
  const r = await fetch(url, { method: "GET", headers: sign("GET", path) });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error(`naver ${path} ${r.status}: ${text.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  try { return JSON.parse(text); } catch { return text; }
}

const FIELDS_FULL = ["impCnt", "clkCnt", "salesAmt", "ccnt", "convAmt"];
const FIELDS_BASE = ["impCnt", "clkCnt", "salesAmt"];

function statRow(r) {
  return {
    impressions: Number(r?.impCnt   || 0),
    clicks:      Number(r?.clkCnt   || 0),
    cost:        Number(r?.salesAmt || 0),
    conv:        Number(r?.ccnt     || 0),
    convAmt:     Number(r?.convAmt  || 0),
  };
}

// /stats 호출 — 전환 필드 미지원(400) 시 기본 필드로 1회 재시도
async function fetchStats(idsQs, extraQs) {
  for (const fields of [FIELDS_FULL, FIELDS_BASE]) {
    try {
      const qs = idsQs
        + "&fields=" + encodeURIComponent(JSON.stringify(fields))
        + extraQs;
      const s = await naverGet("/stats", qs);
      return Array.isArray(s?.data) ? s.data : (Array.isArray(s) ? s : []);
    } catch (e) {
      if (e.status !== 400 || fields === FIELDS_BASE) throw e;
    }
  }
  return [];
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const q = req.query || {};
  if (String(q.token || "") !== TOKEN) { res.status(403).json({ ok: false, error: "token" }); return; }
  if (!API_KEY || !SECRET || !CUSTOMER) {
    res.status(200).json({ ok: false, error: "환경변수 미설정 (YUSOL_AD_API_KEY/SECRET/CUSTOMER_ID)" });
    return;
  }

  const since = String(q.since || "");
  const until = String(q.until || "");
  if (!YMD_RE.test(since) || !YMD_RE.test(until)) {
    res.status(200).json({ ok: false, error: "since/until 형식(YYYY-MM-DD) 오류" });
    return;
  }

  try {
    // ① 캠페인 목록 (검색광고: 파워링크·쇼핑검색. ADVoost 디스플레이는 이 API 범위 밖)
    const camps = await naverGet("/ncc/campaigns");
    const list = (Array.isArray(camps) ? camps : []).map(c => ({
      id: c.nccCampaignId, name: c.name, type: c.campaignTp || "", on: c.status === "ELIGIBLE" || c.userLock === false,
    })).filter(c => c.id);

    const ids = list.map(c => c.id);
    if (ids.length === 0) {
      res.status(200).json({ ok: true, cost: 0, clicks: 0, impressions: 0, conv: 0, convAmt: 0, cpc: 0, campaigns: [], days: [], since, until });
      return;
    }
    const idsQs = ids.map(id => "ids=" + encodeURIComponent(id)).join("&");
    const rangeQs = "&timeRange=" + encodeURIComponent(JSON.stringify({ since, until }));

    // ② 캠페인별 합계
    const rows = await fetchStats(idsQs, rangeQs);
    const byId = new Map();
    for (const r of rows) {
      const id = r?.id || r?.nccCampaignId;
      if (!id) continue;
      const cur = byId.get(id) || { impressions: 0, clicks: 0, cost: 0, conv: 0, convAmt: 0 };
      const v = statRow(r);
      cur.impressions += v.impressions; cur.clicks += v.clicks; cur.cost += v.cost;
      cur.conv += v.conv; cur.convAmt += v.convAmt;
      byId.set(id, cur);
    }
    const campaigns = list.map(c => ({ ...c, ...(byId.get(c.id) || { impressions: 0, clicks: 0, cost: 0, conv: 0, convAmt: 0 }) }));
    const total = campaigns.reduce((a, c) => ({
      impressions: a.impressions + c.impressions, clicks: a.clicks + c.clicks,
      cost: a.cost + c.cost, conv: a.conv + c.conv, convAmt: a.convAmt + c.convAmt,
    }), { impressions: 0, clicks: 0, cost: 0, conv: 0, convAmt: 0 });

    // ③ 일별 (daily=1) — 부정클릭 급증 판정의 원자료
    let days = [];
    if (String(q.daily || "") === "1") {
      const dRows = await fetchStats(idsQs, rangeQs + "&timeIncrement=" + encodeURIComponent("allDays"));
      const agg = new Map();
      for (const r of dRows) {
        const raw = r?.dateStartDate || r?.statDt || r?.date || r?.dt || "";
        const ymd = String(raw).slice(0, 10);
        if (!YMD_RE.test(ymd)) continue;
        const cur = agg.get(ymd) || { ymd, cost: 0, clicks: 0, impressions: 0, conv: 0 };
        const v = statRow(r);
        cur.cost += v.cost; cur.clicks += v.clicks; cur.impressions += v.impressions; cur.conv += v.conv;
        agg.set(ymd, cur);
      }
      days = [...agg.values()].sort((a, b) => a.ymd.localeCompare(b.ymd));
    }

    res.status(200).json({
      ok: true,
      cost: total.cost, clicks: total.clicks, impressions: total.impressions,
      conv: total.conv, convAmt: total.convAmt,
      cpc: total.clicks > 0 ? Math.round(total.cost / total.clicks) : 0,
      campaigns, days, since, until, vatIncluded: false,
    });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
}
