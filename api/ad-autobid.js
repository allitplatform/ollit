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

// 변경 이력 기록 (보라웨어식 시간대별 그래프의 재료) — 실패해도 본 작업은 계속
const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
async function logRows(rows) {
  if (!SB_URL || !SB_KEY || !rows.length) return;
  try {
    await fetch(`${SB_URL}/rest/v1/ad_autobid_log`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
  } catch (e) { /* 기록 실패는 무시 */ }
}

const CAMPAIGN_ID = "cmp-a001-01-000000010808110";
// 확장_증상청소 는 제외 — 검색량 큰 청소 단어를 1위에 걸면 예산이 며칠에 다 나간다.
// 청소 그룹은 2,000원 고정으로 일주일 데이터 먼저.
// 사장님 전략(7/26): "비싼 키워드는 2~3위, 노출 많은 건 무조건 1위"
//  → 지역 그룹: 1위 추격, 상한 15,000 (상한 초과 시 자연스럽게 2~3위)
//  → 메인키워드: 1위 추격, 상한 20,000, 단 **내리지는 않음** (견적이 실제보다 낮게
//    나오는 단어가 있어서 — 에어컨가스충전 견적 9,690인데 실순위 2.1 — 믿고 내리면 뺏긴다)
// 7/27 낮 사장님 지시: 청소 빼고 전부 2위 이상 유지. 단 터무니없는 가격은 제외.
// → 1위가 15,000 이하면 1위 추격 / 넘으면 2위 가격으로 2위 확보(최대 20,000) / 2위도 2만 넘으면 포기.
const GROUP_POLICY = {
  "중간키워드":   { cap: 15000, margin: 1.1,  lowerOk: true,  pos2: true, cap2: 15000 },
  "중간키워드2":  { cap: 15000, margin: 1.1,  lowerOk: true,  pos2: true, cap2: 15000 },
  "고양시":       { cap: 15000, margin: 1.1,  lowerOk: true,  pos2: true, cap2: 15000 },
  "고양시2":      { cap: 15000, margin: 1.1,  lowerOk: true,  pos2: true, cap2: 15000 },
  "파주시":       { cap: 15000, margin: 1.1,  lowerOk: true,  pos2: true, cap2: 15000 },
  "김포시":       { cap: 15000, margin: 1.1,  lowerOk: true,  pos2: true, cap2: 15000 },
  "남양주시":     { cap: 15000, margin: 1.1,  lowerOk: true,  pos2: true, cap2: 15000 },
  "서울":         { cap: 15000, margin: 1.1,  lowerOk: true,  pos2: true, cap2: 15000 },
  // 메인(7/26 밤 개정): 비용대비 순이익 원칙 — 7/13 데이터(입찰 1.3만·2위권·최고 성적) 기준.
  // 1위 과열 안 따라감. 추격 여유 5%, 상한 15,000.
  "메인키워드":   { cap: 15000, margin: 1.05, lowerOk: false, pos2: true, cap2: 15000 },
  // 사장님(7/26 저녁): 수리·누설·누수 + 가스충전이 제일 메인 → 핵심 대접
  "확장_수리누설": { cap: 15000, margin: 1.1,  lowerOk: true,  pos2: true, cap2: 15000 },
  // 설치(7/27 사장님 확정): 지금은 시기 아님 — 싼 자리(5,000 이하)만 줍고 비싼 판은 성수기에.
  "확장_설치":     { cap: 5000,  margin: 1.1,  lowerOk: true  },
  // 증상·청소(7/28 신설): 지금까지 자동입찰 밖에 방치돼 입찰가가 얼어 있던 그룹.
  // 세척 단가가 수리보다 낮으니 상한도 낮게 8,000으로 시작한다.
  "확장_증상청소": { cap: 8000,  margin: 1.1,  lowerOk: true,  pos2: true, cap2: 8000 },
};
const TARGET_GROUPS = new Set(Object.keys(GROUP_POLICY));

// 키워드별 개별 상한 (그룹 상한보다 우선)
// 7/27 저녁 개정: 냉매충전 17,000 실험 종료 — 클릭 240개 동일한데 단가만 1.7배 (7/13 대비).
// 상단권(1~3위)이면 클릭 흡수 비슷 → 웃돈 금지. 냉매·가스: 10,000 (2~3위권 실험 유지)
const KW_CAP = {
  "에어컨냉매": 10000,
  "에어컨가스": 10000,
  // 7/28 사장님 지시로 추가. 월 50회·GHP(상업용 가스냉난방) 검색어 → 자동입찰이 못 올리게 못박음
  "가스에어컨": 1000,
};
const FLOOR = 1000;     // 바닥 — 견적이 이상하게 낮아도 이 밑으론 안 내림

// 시간대 전략 (7/27 실측: 12~17시 클릭단가 7천원대 = 아침·저녁의 1.5배)
// 낮에는 목표를 1위→2위로 낮춰 2위 가격만 낸다. 순위는 2~3위 보장(사장님: 3위 밑 금지),
// 노출은 계속 켜져 있음. 아침·저녁은 1위 추격 그대로.
function isMidday() {
  const kstH = new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
  return kstH >= 12 && kstH < 18;
}

// 매 실행마다 비즈머니 잔액 1줄 기록 → 관제판 "시간대별 지출 곡선" 재료 (7/28 업그레이드)
async function logBizBalance() {
  try {
    const r = await call("GET", "/billing/bizmoney", "");
    const bal = r && (r.bizmoney ?? r.balance);
    if (bal == null) return;
    const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    await logRows([{ kw: "_bz", grp: kst, bid_from: Math.round(bal), bid_to: 0, est1: null }]);
  } catch (e) {}
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
    const est2Map = new Map();
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

    // ②-2 2위 견적 — 평소엔 1위가 상한 초과분만, 낮(12~17시)엔 내림 가능한 그룹 전부 (2위 확보 모드)
    const midday = isMidday();
    const p2kws = kws.filter(k => {
      const pol = GROUP_POLICY[k.grp] || {};
      if (!pol.pos2 || KW_CAP[norm(k.kw)] != null) return false;
      if (midday && pol.lowerOk) return true;
      const e1 = estMap.get(norm(k.kw));
      return e1 && Math.round(e1 * (pol.margin || 1.1) / 10) * 10 > (pol.cap || 15000);
    });
    for (const part of chunk(p2kws, 100)) {
      try {
        const r = await call("POST", "/estimate/average-position-bid/keyword", null, {
          device: "MOBILE", items: part.map(k => ({ key: k.kw, position: 2 })) });
        for (const e of ((r && r.estimate) || [])) {
          const kk = e.keyword ?? e.key;
          if (kk != null && e.bid != null) est2Map.set(norm(kk), Number(e.bid));
        }
      } catch (e) {}
    }

    // ③ 새 입찰가 계산
    const changes = [];
    let capped = 0, noEst = 0;
    for (const k of kws) {
      const est = estMap.get(norm(k.kw));
      if (!est) { noEst++; continue; }
      const pol = GROUP_POLICY[k.grp] || { cap: 15000, margin: 1.1, lowerOk: true };
      const cap = KW_CAP[norm(k.kw)] != null ? KW_CAP[norm(k.kw)] : pol.cap; // 키워드 개별 상한 우선
      let bid = Math.round(est * pol.margin / 10) * 10;
      // 낮(12~17시): 내림 가능한 그룹은 2위 가격 + 5%로 2위 확보 (3위 밑 금지 — 2위가를 내니 2~3위 보장)
      if (midday && pol.lowerOk && pol.pos2 && KW_CAP[norm(k.kw)] == null) {
        const e2m = est2Map.get(norm(k.kw));
        if (e2m) bid = Math.min(bid, Math.round(e2m * 1.05 / 10) * 10);
      }
      if (bid > cap && pol.pos2 && KW_CAP[norm(k.kw)] == null) {
        // 1위가 너무 비쌈 → 2위 가격 + 10% 로 2위 확보 (최대 cap2).
        // 2위조차 cap2를 넘는 터무니없는 판은 안 따라감(cap에 묶고 포기).
        const e2 = est2Map.get(norm(k.kw));
        const b2 = e2 ? Math.round(e2 * 1.1 / 10) * 10 : null;
        bid = (b2 && b2 <= pol.cap2) ? b2 : cap;
        capped++;
      } else if (bid > cap) { bid = cap; capped++; }
      if (bid < FLOOR) bid = FLOOR;
      if (!pol.lowerOk && bid < k.cur) continue;  // 메인키워드: 올리기만, 내리진 않음
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
    await logRows([
      { kw: "_run", grp: "_summary", bid_from: kws.length, bid_to: applied, est1: capped },
      ...changes.map(c => ({ kw: c.kw, grp: c.grp, bid_from: c.from, bid_to: c.to, est1: c.est1 })),
    ]);
    await logBizBalance(); // 시간대별 지출 곡선 재료
    res.status(200).json({ ok: true, alive: kws.length,
      applied, capped, noEst });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
