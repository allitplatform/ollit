// 2026-07-26 — 지역 키워드 "1위 자동 맞춤" (api/ad-autobid.js)
// 사장님 방침: 지역+가스충전/냉매충전 무조건 1위. 단 상한 10,000원 — 그 위로는 안 따라감.
// 동작:
//   ① 대상 그룹의 살아있는 키워드(입찰가>70) 수집
//   ② 네이버 견적 API 로 "모바일 1위 입찰가" 조회
//   ③ 새 입찰가 = min(1위가 × 1.1, 상한 10,000) / 바닥 1,000 / 10원 단위 반올림
//   ④ 지금 입찰가와 10% 이상 차이날 때만 변경 (미세 변동으로 매시간 갈아치우지 않게)
// 사용: ?token=...            → 미리보기 (변경 없음)
//       ?token=...&run=1      → 실제 적용
// 스케줄: Supabase pg_cron 이 매시간 &run=1 호출.

import crypto from "crypto";

const NAVER_API_KEY  = process.env.NAVER_AD_API_KEY;
const NAVER_SECRET   = process.env.NAVER_AD_SECRET;
const NAVER_CUSTOMER = process.env.NAVER_AD_CUSTOMER_ID;
const NAVER_BASE     = "https://api.searchad.naver.com";
const TOKEN = "b29adde027905ee35c810634f09bda48a697f973fbdb8ca8";

const CAMPAIGN_ID = "cmp-a001-01-000000010808110";
// 확장_증상청소 는 제외 — 검색량 큰 청소 단어를 1위에 걸면 예산이 며칠에 다 나간다.
// 청소 그룹은 2,000원 고정으로 일주일 데이터 먼저.
const TARGET_GROUPS = new Set([
  "중간키워드", "중간키워드2", "고양시", "고양시2", "파주시",
  "김포시", "남양주시", "서울",   // "서울" = 구 단위 그룹 (은평구·강북구 등)
]);
const CAP = 15000;      // 상한(사장님 지정) — 1위가 이보다 비싸면 포기하고 2위
const FLOOR = 1000;     // 바닥 — 견적이 이상하게 낮아도 이 밑으론 안 내림
const MARGIN = 1.1;     // 1위가 대비 10% 여유

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
  if (!r.ok) { const e = new Error(`naver ${path} ${r.status}: ${text.slice(0,200)}`); throw e; }
  return data;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export default async function handler(req, res) {
  if ((req.query.token || "") !== TOKEN) { res.status(404).end(); return; }
  try {
    // ① 대상 키워드 수집
    const groups = (await call("GET", "/ncc/adgroups",
      "nccCampaignId=" + encodeURIComponent(CAMPAIGN_ID)))
      .filter(g => TARGET_GROUPS.has(g.name));
    const kws = [];
    for (const g of groups) {
      const list = await call("GET", "/ncc/keywords",
        "nccAdgroupId=" + encodeURIComponent(g.nccAdgroupId));
      for (const k of (Array.isArray(list) ? list : [])) {
        if ((k.bidAmt || 0) > 70 && !k.userLock) {
          kws.push({ id: k.nccKeywordId, gid: g.nccAdgroupId, kw: k.keyword,
                     cur: k.bidAmt, grp: g.name });
        }
      }
    }

    // 원인 조사 모드: 견적 API 원본 응답을 그대로 보여줌
    if (req.query.probe) {
      const sample = kws.slice(0, 3).map(k => ({ key: k.kw, position: 1 }));
      let raw, err = null;
      try {
        raw = await call("POST", "/estimate/average-position-bid/keyword", null,
          { device: "MOBILE", items: sample });
      } catch (e) { err = String(e.message || e); }
      res.status(200).json({ ok: true, mode: "probe", sent: sample, raw, err });
      return;
    }

    // ② 모바일 1위 견적 (100개씩) — 응답 형태가 문서와 다른 경우까지 흡수
    const estMap = new Map();
    const norm = (x) => String(x || "").replace(/\s+/g, "").toUpperCase();
    for (const part of chunk(kws, 100)) {
      let r;
      try {
        r = await call("POST", "/estimate/average-position-bid/keyword", null, {
          device: "MOBILE",
          items: part.map(k => ({ key: k.kw, position: 1 })),
        });
      } catch (e) { continue; }
      const arr = (r && r.estimate) || (Array.isArray(r) ? r : []);
      for (const e of arr) {
        const bid = e.bid ?? e.bidAmt ?? e.estimate;
        const kk  = e.keyword ?? e.key;   // 네이버는 keyword 라는 이름으로 돌려준다
        if (kk != null && bid != null) estMap.set(norm(kk), Number(bid));
      }
    }

    // ③ 새 입찰가 계산
    const changes = [];
    let capped = 0, noEst = 0;
    for (const k of kws) {
      const est = estMap.get(norm(k.kw));
      if (!est) { noEst++; continue; }
      let bid = Math.round(est * MARGIN / 10) * 10;
      if (bid > CAP) { bid = CAP; capped++; }
      if (bid < FLOOR) bid = FLOOR;
      if (Math.abs(bid - k.cur) / k.cur >= 0.1) {
        changes.push({ id: k.id, gid: k.gid, kw: k.kw, grp: k.grp,
                       from: k.cur, to: bid, est1: est });
      }
    }

    if (!req.query.run) {
      changes.sort((a, b) => b.to - a.to);
      res.status(200).json({ ok: true, mode: "dry",
        alive: kws.length, willChange: changes.length, capped, noEst,
        top20: changes.slice(0, 20) });
      return;
    }

    // ④ 적용 (200개씩)
    let applied = 0;
    for (const part of chunk(changes, 200)) {
      const r = await call("PUT", "/ncc/keywords", "fields=bidAmt",
        part.map(c => ({ nccKeywordId: c.id, nccAdgroupId: c.gid,
                         bidAmt: c.to, useGroupBidAmt: false })));
      applied += Array.isArray(r) ? r.length : 0;
    }
    res.status(200).json({ ok: true, alive: kws.length,
      applied, capped, noEst });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
