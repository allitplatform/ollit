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
// 쓰기(입찰 변경·키워드 추가) 전용 관리 토큰 — 화면 코드에 절대 넣지 말 것.
const ADMIN = "cc49948f9ff3048ef3f343bef3";

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

async function naverBody(method, path, body, queryString) {
  const url = queryString ? `${BASE}${path}?${queryString}` : `${BASE}${path}`;
  const r = await fetch(url, {
    method,
    headers: { ...sign(method, path), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error(`naver ${path} ${r.status}: ${text.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  try { return JSON.parse(text); } catch { return text; }
}
const naverPost = (path, body, qs) => naverBody("POST", path, body, qs);
const naverPut  = (path, body, qs) => naverBody("PUT",  path, body, qs);

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

  // ── mode=keywords: 등록 키워드별 월 검색량 + 모바일 1위/4위 예상 입찰가 ──
  //   GET /api/yusol-ad?token=...&mode=keywords
  //   가성비 판정용. 검색량은 키워드도구(월간), 시세는 견적 API(모바일 노출 4자리 기준
  //   4위 = 제일 싼 노출 자리). 연관 키워드도 검색량 상위 30개를 함께 돌려준다.
  if (String(q.mode || "") === "keywords") {
    try {
      const norm = s => String(s || "").replace(/\s+/g, "").toLowerCase();
      const qcNum = v => { const n = Number(String(v == null ? "" : v).replace(/[^0-9]/g, "")); return Number.isFinite(n) ? n : 0; };

      // ① 파워링크 캠페인의 살아있는 키워드 수집
      const camps = await naverGet("/ncc/campaigns");
      const mine = [];
      for (const c of (Array.isArray(camps) ? camps : [])) {
        if (!c.nccCampaignId || c.campaignTp !== "WEB_SITE") continue;
        if (c.userLock) continue;
        const groups = await naverGet("/ncc/adgroups", "nccCampaignId=" + encodeURIComponent(c.nccCampaignId));
        for (const g of (Array.isArray(groups) ? groups : [])) {
          const kws = await naverGet("/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(g.nccAdgroupId));
          for (const k of (Array.isArray(kws) ? kws : [])) {
            if (k.userLock) continue;
            mine.push({
              keyword: String(k.keyword || ""),
              group: String(g.name || ""),
              bid: k.useGroupBidAmt ? Number(g.bidAmt || 0) : Number(k.bidAmt || 0),
              groupBid: !!k.useGroupBidAmt,
            });
          }
        }
      }

      // ② 키워드도구 — 월 검색량 (5개씩). 연관 키워드도 함께 수집.
      const seeds = [...new Set(mine.map(r => r.keyword))];
      const volMap = new Map();   // norm(kw) -> {keyword,pc,mobile,comp}
      for (let i = 0; i < seeds.length; i += 5) {
        const part = seeds.slice(i, i + 5);
        try {
          const r = await naverGet("/keywordstool",
            "hintKeywords=" + encodeURIComponent(part.join(",")) + "&showDetail=1");
          for (const k of (Array.isArray(r?.keywordList) ? r.keywordList : [])) {
            const word = String(k?.relKeyword || "").trim();
            if (!word) continue;
            const key = norm(word);
            if (volMap.has(key)) continue;
            volMap.set(key, {
              keyword: word,
              pc: qcNum(k.monthlyPcQcCnt), mobile: qcNum(k.monthlyMobileQcCnt),
              comp: String(k.compIdx || ""),
            });
          }
        } catch (e) { /* 청크 실패는 건너뜀 */ }
      }

      // ③ 연관 키워드: 미등록 + 모바일 검색량 상위 30개
      const mineSet = new Set(seeds.map(norm));
      const related = [...volMap.values()]
        .filter(v => !mineSet.has(norm(v.keyword)))
        .sort((a, b) => (b.mobile + b.pc) - (a.mobile + a.pc))
        .slice(0, 30);

      // ④ 모바일 1위/4위 예상 입찰가 (4위 = 모바일 마지막 노출 자리)
      const allKws = [...new Set([...seeds, ...related.map(v => v.keyword)])];
      async function estim(position) {
        const out = new Map();
        for (let i = 0; i < allKws.length; i += 100) {
          try {
            const r = await naverPost("/estimate/average-position-bid/keyword", {
              device: "MOBILE",
              items: allKws.slice(i, i + 100).map(k => ({ key: k, position })),
            });
            for (const e of ((r && r.estimate) || [])) {
              const kk = e.keyword ?? e.key;
              const bid = e.bid ?? e.bidAmt ?? e.estimate;
              if (kk != null && bid != null) out.set(norm(kk), Number(bid));
            }
          } catch (e) { /* 견적 실패는 null 로 둠 */ }
        }
        return out;
      }
      const pos1 = await estim(1);
      const pos4 = await estim(4);

      const decorate = (base) => {
        const v = volMap.get(norm(base.keyword)) || { pc: 0, mobile: 0, comp: "" };
        return {
          ...base,
          pc: v.pc, mobile: v.mobile, total: v.pc + v.mobile, comp: v.comp,
          mobile1: pos1.get(norm(base.keyword)) ?? null,
          mobile4: pos4.get(norm(base.keyword)) ?? null,
        };
      };

      res.status(200).json({
        ok: true, mode: "keywords",
        mine: mine.map(decorate),
        related: related.map(v => decorate({ keyword: v.keyword })),
      });
    } catch (e) {
      res.status(200).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
    }
    return;
  }

  // ── 쓰기 모드 (admin 토큰 필수) ─────────────────────────────────────────
  //   setgroupbid : &group=이름일부&bid=4500          — 그룹 기본 입찰가
  //   setkwbid    : &kws=키워드:6500,키워드:5000       — 키워드 개별 입찰
  //   usegroupbid : &kws=키워드,키워드                 — 개별 입찰 해제(그룹 기본 사용)
  //   addkw       : &group=이름일부&kws=a,b,c[&bid=N]  — 키워드 추가(기본: 그룹 입찰 사용)
  const WRITE_MODES = ["setgroupbid", "setkwbid", "usegroupbid", "addkw"];
  const mode = String(q.mode || "");
  if (WRITE_MODES.includes(mode)) {
    if (String(q.admin || "") !== ADMIN) { res.status(403).json({ ok: false, error: "admin token" }); return; }
    try {
      const norm = s => String(s || "").replace(/\s+/g, "").toLowerCase();
      // 파워링크 캠페인의 그룹 전부 수집
      const camps = await naverGet("/ncc/campaigns");
      let groups = [];
      for (const c of (Array.isArray(camps) ? camps : [])) {
        if (!c.nccCampaignId || c.campaignTp !== "WEB_SITE") continue;
        const gs = await naverGet("/ncc/adgroups", "nccCampaignId=" + encodeURIComponent(c.nccCampaignId));
        groups = groups.concat(Array.isArray(gs) ? gs : []);
      }

      if (mode === "setgroupbid") {
        const name = String(q.group || "");
        const bid = Number(q.bid || 0);
        const g = groups.find(x => String(x.name || "").includes(name));
        if (!g || !(bid >= 70)) { res.status(200).json({ ok: false, error: "group/bid 확인" }); return; }
        const full = await naverGet("/ncc/adgroups/" + g.nccAdgroupId);
        full.bidAmt = bid;
        const r = await naverPut("/ncc/adgroups/" + g.nccAdgroupId, full);
        res.status(200).json({ ok: true, group: g.name, bidAmt: r?.bidAmt ?? bid });
        return;
      }

      if (mode === "addkw") {
        const name = String(q.group || "");
        const g = groups.find(x => String(x.name || "").includes(name));
        const kws = String(q.kws || "").split(",").map(s => s.trim()).filter(Boolean);
        if (!g || !kws.length) { res.status(200).json({ ok: false, error: "group/kws 확인" }); return; }
        const bid = Number(q.bid || 0);
        const body = kws.map(k => bid >= 70
          ? { keyword: k, bidAmt: bid, useGroupBidAmt: false }
          : { keyword: k, bidAmt: Number(g.bidAmt || 3000), useGroupBidAmt: true });
        const r = await naverPost("/ncc/keywords", body, "nccAdgroupId=" + encodeURIComponent(g.nccAdgroupId));
        res.status(200).json({ ok: true, group: g.name, created: Array.isArray(r) ? r.length : 0 });
        return;
      }

      // 키워드 대상 모드: 전체 키워드 수집 후 이름 매칭
      const allkw = [];
      for (const g of groups) {
        const ks = await naverGet("/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(g.nccAdgroupId));
        for (const k of (Array.isArray(ks) ? ks : [])) allkw.push(k);
      }
      const findKw = w => allkw.find(x => norm(x.keyword) === norm(w));

      if (mode === "setkwbid") {
        const pairs = String(q.kws || "").split(",").map(s => s.trim()).filter(Boolean)
          .map(s => { const i = s.lastIndexOf(":"); return { w: s.slice(0, i), bid: Number(s.slice(i + 1)) }; })
          .filter(p => p.w && p.bid >= 70);
        const body = [], missing = [];
        for (const p of pairs) {
          const k = findKw(p.w);
          if (!k) { missing.push(p.w); continue; }
          body.push({ nccKeywordId: k.nccKeywordId, nccAdgroupId: k.nccAdgroupId, bidAmt: p.bid, useGroupBidAmt: false });
        }
        const r = body.length ? await naverPut("/ncc/keywords", body, "fields=bidAmt") : [];
        res.status(200).json({ ok: true, changed: Array.isArray(r) ? r.length : 0, missing });
        return;
      }

      if (mode === "usegroupbid") {
        const body = [], missing = [];
        for (const w of String(q.kws || "").split(",").map(s => s.trim()).filter(Boolean)) {
          const k = findKw(w);
          if (!k) { missing.push(w); continue; }
          body.push({ nccKeywordId: k.nccKeywordId, nccAdgroupId: k.nccAdgroupId, bidAmt: k.bidAmt, useGroupBidAmt: true });
        }
        const r = body.length ? await naverPut("/ncc/keywords", body, "fields=bidAmt") : [];
        res.status(200).json({ ok: true, changed: Array.isArray(r) ? r.length : 0, missing });
        return;
      }
    } catch (e) {
      res.status(200).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
    }
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
