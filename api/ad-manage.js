// 2026-07-26 — 광고 관리 API (api/ad-manage.js) — 그룹 생성/키워드 추가 (토큰 가드)
// ?token=...&step=group&name=확장_설치        → 새 그룹 (메인키워드 채널 복제)
// ?token=...&step=addkw&gid=...&bid=2000&kws=a,b,c → 키워드 추가
// ?token=...&step=list&gid=...               → 그룹 키워드 확인

import crypto from "crypto";

const NAVER_API_KEY  = process.env.NAVER_AD_API_KEY;
const NAVER_SECRET   = process.env.NAVER_AD_SECRET;
const NAVER_CUSTOMER = process.env.NAVER_AD_CUSTOMER_ID;
const NAVER_BASE     = "https://api.searchad.naver.com";
const TOKEN = "b29adde027905ee35c810634f09bda48a697f973fbdb8ca8";
const CAMPAIGN_ID = "cmp-a001-01-000000010808110";
const POWER_CONTENT_ID = "cmp-a001-03-000000010907045";
const GOAL_CPA = 25000, LIMIT_CPA = 35300;

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
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { ok: r.ok, status: r.status, data: d };
}

// 통신사 모바일 공용(CGNAT) 대역 — IP 하나를 고객 수천 명이 공유하므로 차단 금지.
// 2026-07-31 사고: 자동순찰이 이 대역 17개를 차단해 모바일 노출 급락 + 사장님 폰에서도 광고 안 보임.
const MOBILE_CGNAT = /^(223\.(3[2-9]|[45][0-9]|6[0-3])\.|106\.10[12]\.|117\.111\.|211\.234\.|118\.235\.|110\.70\.|39\.7\.|175\.223\.|211\.36\.)/;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if ((req.query.token || "") !== TOKEN) { res.status(404).end(); return; }
  try {
    const step = req.query.step || "";

    if (step === "group") {
      const name = req.query.name;
      if (!name) { res.status(200).json({ ok: false, error: "name 필요" }); return; }
      const ag = await call("GET", "/ncc/adgroups", "nccCampaignId=" + encodeURIComponent(CAMPAIGN_ID));
      const groups = Array.isArray(ag.data) ? ag.data : [];
      const exist = groups.find(g => g.name === name);
      if (exist) { res.status(200).json({ ok: true, gid: exist.nccAdgroupId, note: "이미 있음" }); return; }
      const main = groups.find(g => g.name === "메인키워드");
      const r = await call("POST", "/ncc/adgroups", null, {
        nccCampaignId: CAMPAIGN_ID, name,
        adgroupType: main.adgroupType || "WEB_SITE",
        pcChannelId: main.pcChannelId, mobileChannelId: main.mobileChannelId,
        bidAmt: 2000, useDailyBudget: false,
      });
      res.status(200).json({ ok: r.ok, gid: r.data && r.data.nccAdgroupId, err: r.ok ? null : r.data });
      return;
    }

    if (step === "addkw") {
      const gid = req.query.gid, bid = Number(req.query.bid || 2000);
      const kws = String(req.query.kws || "").split(",").map(s => s.trim()).filter(Boolean);
      if (!gid || !kws.length) { res.status(200).json({ ok: false, error: "gid/kws 필요" }); return; }
      const r = await call("POST", "/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(gid),
        kws.map(k => ({ keyword: k, bidAmt: bid, useGroupBidAmt: false })));
      res.status(200).json({ ok: r.ok, created: Array.isArray(r.data) ? r.data.length : 0,
        err: r.ok ? null : r.data });
      return;
    }

    // 그룹의 타게팅 원본 확인
    if (step === "targets") {
      const r = await call("GET", "/ncc/adgroups/" + req.query.gid);
      res.status(200).json({ ok: r.ok, name: r.data && r.data.name,
        targets: r.data && r.data.targets });
      return;
    }

    // 임의 GET 패스스루 (진단용) — ?step=raw&path=/ncc/adgroups/xxx&qs=a=b
    if (step === "raw") {
      const path = String(req.query.path || "");
      if (!path.startsWith("/")) { res.status(200).json({ ok: false, error: "path 필요" }); return; }
      const r = await call("GET", path, req.query.qs ? String(req.query.qs) : null);
      res.status(200).json({ ok: r.ok, status: r.status, data: r.data });
      return;
    }

    // 그룹별 지역 타게팅 전수 조회 (진단용) — targets + targetSummary + /ncc/targets
    if (step === "regionaudit") {
      const ag = await call("GET", "/ncc/adgroups", "nccCampaignId=" + encodeURIComponent(CAMPAIGN_ID));
      const out = [];
      for (const g of (Array.isArray(ag.data) ? ag.data : [])) {
        const full = await call("GET", "/ncc/adgroups/" + g.nccAdgroupId);
        const tg = await call("GET", "/ncc/targets", "nccAdgroupId=" + encodeURIComponent(g.nccAdgroupId));
        out.push({ grp: g.name, gid: g.nccAdgroupId,
          summary: full.data && full.data.targetSummary,
          keys: full.data ? Object.keys(full.data) : null,
          tps: (full.data && full.data.targets || []).map(x => x.targetTp),
          tgStatus: tg.status, tg: tg.data });
      }
      res.status(200).json({ ok: true, campaign: CAMPAIGN_ID, rows: out });
      return;
    }

    // 지역 타게팅이 걸린 모든 그룹에 지역코드 추가 (예: codes=RL11,RL02190)
    if (step === "alladdregion") {
      const codes = String(req.query.codes || "").split(",").map(s => s.trim()).filter(Boolean);
      if (!codes.length) { res.status(200).json({ ok: false, error: "codes 필요" }); return; }
      const ag = await call("GET", "/ncc/adgroups", "nccCampaignId=" + encodeURIComponent(CAMPAIGN_ID));
      const out = [];
      for (const g of (Array.isArray(ag.data) ? ag.data : [])) {
        const full = await call("GET", "/ncc/adgroups/" + g.nccAdgroupId);
        const grp = full.data;
        const t = (grp.targets || []).find(x =>
          String(x.targetTp || "").toUpperCase().includes("REGION") && x.target && x.target.location);
        if (!t) { out.push({ grp: g.name, skip: "지역 타게팅 없음(전지역)" }); continue; }
        let changed = false;
        for (const c of codes) {
          if (!t.target.location[c]) { t.target.location[c] = true; changed = true; }
        }
        if (!changed) { out.push({ grp: g.name, skip: "이미 포함" }); continue; }
        const put = await call("PUT", "/ncc/adgroups/" + g.nccAdgroupId, null, grp);
        out.push({ grp: g.name, ok: put.ok, err: put.ok ? null : (put.data && put.data.title) || put.status });
      }
      res.status(200).json({ ok: true, codes, result: out });
      return;
    }

    // 확장소재 원본 조회 (구조 파악용)
    if (step === "extlist") {
      const r = await call("GET", "/ncc/ad-extensions", "ownerId=" + encodeURIComponent(req.query.owner));
      res.status(200).json({ ok: r.ok, count: Array.isArray(r.data) ? r.data.length : 0, raw: r.data });
      return;
    }

    // 확장소재 복제: from(그룹)의 소재를 to(캠페인/그룹)로 — types 쉼표 목록으로 제한 가능
    if (step === "extcopy") {
      const { from, to } = req.query;
      const types = String(req.query.types || "").split(",").map(s => s.trim()).filter(Boolean);
      const src = await call("GET", "/ncc/ad-extensions", "ownerId=" + encodeURIComponent(from));
      const list = Array.isArray(src.data) ? src.data : [];
      const out = [];
      for (const e of list) {
        if (types.length && !types.includes(e.type)) continue;
        const body = JSON.parse(JSON.stringify(e));
        for (const k of ["nccAdExtensionId", "ownerId", "customerId", "regTm", "editTm",
                         "status", "statusReason", "inspectStatus", "delFlag"]) delete body[k];
        body.ownerId = to;
        const r = await call("POST", "/ncc/ad-extensions", null, body);
        out.push({ type: e.type, ok: r.ok, err: r.ok ? null : ((r.data && (r.data.title || r.data.code)) || r.status) });
      }
      res.status(200).json({ ok: true, tried: out.length, result: out });
      return;
    }

    if (step === "list") {
      const r = await call("GET", "/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(req.query.gid));
      const rows = Array.isArray(r.data) ? r.data : [];
      res.status(200).json({ ok: true, total: rows.length,
        rows: rows.map(k => ({ kw: k.keyword, bid: k.bidAmt, st: k.status })) });
      return;
    }

    // 소재(헤드라인·설명) 수정 (?step=adhead&gid=...&adid=...&headline=...[&desc=...])
    //   기존 소재 전체를 GET으로 받아 headline/description만 바꿔서 통째로 PUT — 이미지 등 나머지 필드 보존
    if (step === "adhead") {
      const { gid, adid } = req.query;
      const headline = req.query.headline ? String(req.query.headline) : null;
      const desc = req.query.desc ? String(req.query.desc) : null;
      if (!gid || !adid || (!headline && !desc)) {
        res.status(200).json({ ok: false, error: "gid/adid 필요 + headline 또는 desc 중 하나" }); return; }
      const cur = await call("GET", "/ncc/ads", "nccAdgroupId=" + encodeURIComponent(gid));
      const list = Array.isArray(cur.data) ? cur.data : [];
      const ad = list.find(a => a.nccAdId === adid);
      if (!ad) { res.status(200).json({ ok: false, error: "해당 adid를 그룹에서 못 찾음" }); return; }
      const before = { headline: ad.ad.headline, description: ad.ad.description };
      const nextAd = JSON.parse(JSON.stringify(ad.ad));
      if (headline) nextAd.headline = headline;
      if (desc) nextAd.description = desc;
      const r = await call("PUT", "/ncc/ads/" + encodeURIComponent(adid), null,
        { nccAdId: adid, nccAdgroupId: gid, type: ad.type, ad: nextAd });
      res.status(200).json({ ok: r.ok, before, after: { headline: nextAd.headline, description: nextAd.description },
        err: r.ok ? null : r.data });
      return;
    }

    // 개별 입찰가 수정
    if (step === "setbid") {
      const { id, gid } = req.query; const bid = Number(req.query.bid);
      if (!id || !gid || !bid || bid < 70 || bid > 100000) {
        res.status(200).json({ ok: false, error: "id/gid/bid(70~100000) 필요" }); return; }
      const r = await call("PUT", "/ncc/keywords", "fields=bidAmt",
        [{ nccKeywordId: id, nccAdgroupId: gid, bidAmt: bid, useGroupBidAmt: false }]);
      // 수동 변경도 이력에 남긴다
      if (r.ok && req.query.kw) {
        try {
          const SU = process.env.VITE_SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
          await fetch(`${SU}/rest/v1/ad_autobid_log`, { method: "POST",
            headers: { apikey: SK, Authorization: `Bearer ${SK}`,
              "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ kw: String(req.query.kw), grp: "_수동",
              bid_from: Number(req.query.from || 0), bid_to: bid, est1: null }) });
        } catch (e) {}
      }
      res.status(200).json({ ok: r.ok, err: r.ok ? null : r.data });
      return;
    }

    // 키워드 켜기/끄기
    if (step === "onoff") {
      const { id, gid } = req.query; const on = req.query.on === "1";
      if (!id || !gid) { res.status(200).json({ ok: false, error: "id/gid 필요" }); return; }
      const r = await call("PUT", "/ncc/keywords", "fields=userLock",
        [{ nccKeywordId: id, nccAdgroupId: gid, userLock: !on }]);
      res.status(200).json({ ok: r.ok, err: r.ok ? null : r.data });
      return;
    }

    // 그룹 통째로 켜기/끄기 (?step=grouponoff&gid=...&on=0|1) — 7/29 확장_증상청소 실험 종료용
    if (step === "grouponoff") {
      const gid = req.query.gid; const on = req.query.on === "1";
      if (!gid) { res.status(200).json({ ok: false, error: "gid 필요" }); return; }
      const r = await call("PUT", "/ncc/adgroups", "fields=userLock",
        [{ nccAdgroupId: gid, userLock: !on }]);
      res.status(200).json({ ok: r.ok, err: r.ok ? null : r.data });
      return;
    }

    // 검색량 수집: 그룹의 살아있는 단어를 keywordstool로 조회해 Supabase에 저장
    // ?step=volsync&gid=...&offset=0&limit=50 → { done, next }
    if (step === "volsync") {
      const SB_URL = process.env.VITE_SUPABASE_URL;
      const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const gid = req.query.gid;
      const offset = Number(req.query.offset || 0), limit = Number(req.query.limit || 50);
      const ks = await call("GET", "/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(gid));
      const wantAll = req.query.all === "1";   // all=1 → 70원 잠자는 단어까지
      const alive = (Array.isArray(ks.data) ? ks.data : [])
        .filter(k => wantAll ? (k.bidAmt || 0) <= 70 : (k.bidAmt || 0) > 70)
        .map(k => String(k.keyword).replace(/\s+/g, ""));
      const part = alive.slice(offset, offset + limit);
      const qc = v => { if (typeof v === "number") return v;
        const t = String(v || "").replace(/[^0-9]/g, ""); return t ? Number(t) : 5; };
      const rows = [];
      for (let i = 0; i < part.length; i += 5) {
        const pack = part.slice(i, i + 5);
        try {
          const r = await call("GET", "/keywordstool",
            "hintKeywords=" + encodeURIComponent(pack.join(",")) + "&showDetail=1");
          const map = new Map((r.data && r.data.keywordList || [])
            .map(k => [String(k.relKeyword).replace(/\s+/g, "").toUpperCase(),
                       { m: qc(k.monthlyMobileQcCnt), t: qc(k.monthlyPcQcCnt) + qc(k.monthlyMobileQcCnt) }]));
          for (const kw of pack) {
            const hit = map.get(kw.toUpperCase());
            if (hit) rows.push({ kw, vol_total: hit.t, vol_mobile: hit.m });
          }
        } catch (e) { /* skip pack */ }
      }
      if (rows.length && SB_URL && SB_KEY) {
        await fetch(`${SB_URL}/rest/v1/ad_kw_volume?on_conflict=kw`, {
          method: "POST",
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows),
        });
      }
      rows.sort((a, b) => b.vol_total - a.vol_total);
      res.status(200).json({ ok: true, groupAlive: alive.length,
        processed: part.length, saved: rows.length,
        top: rows.slice(0, 12),
        next: offset + limit < alive.length ? offset + limit : null });
      return;
    }

    // 광고 노출제한 IP (?step=ipblock&list=1 조회 / &ips=a,b,c 등록) — 부정클릭 2단계
    //   등록된 IP에는 우리 광고가 아예 안 보임 (네이버 한도 600개)
    if (step === "ipblock") {
      if (req.query.list === "1") {
        const r = await call("GET", "/tool/ip-exclusions", "");
        res.status(200).json({ ok: r.ok, list: r.data });
        return;
      }
      const ipsRaw = String(req.query.ips || "").split(",").map(s => s.trim())
        .filter(s => /^\d{1,3}(\.\d{1,3}){3}$/.test(s)).slice(0, 20);
      // 모바일 공용 대역은 force=1 없이는 등록 거부
      const skippedMobile = ipsRaw.filter(ip => MOBILE_CGNAT.test(ip) && req.query.force !== "1");
      const ips = ipsRaw.filter(ip => !skippedMobile.includes(ip));
      if (!ips.length) { res.status(200).json({ ok: false, error: "ips 필요 (쉼표구분 IPv4)", skippedMobile }); return; }
      const memo = String(req.query.memo || "관제판 악성판정").slice(0, 30);
      // 네이버는 배열이 아니라 IP 1개씩 객체로 받는다 (IpExclusionRequest)
      const out = [];
      for (const ip of ips) {
        const r = await call("POST", "/tool/ip-exclusions", "", { filterIp: ip, memo });
        out.push({ ip, ok: r.ok, err: r.ok ? null : r.data });
      }
      res.status(200).json({ ok: out.every(o => o.ok), results: out, skippedMobile });
      return;
    }

    // 노출제한 IP 삭제 (?step=ipdel&ids=30554350,30552843) — ipFilterId 쉼표구분
    if (step === "ipdel") {
      const ids = String(req.query.ids || "").split(",").map(s => s.trim())
        .filter(s => /^\d+$/.test(s)).slice(0, 50);
      if (!ids.length) { res.status(200).json({ ok: false, error: "ids 필요 (ipFilterId 쉼표구분)" }); return; }
      const r = await call("DELETE", "/tool/ip-exclusions", "ipFilterIds=" + ids.join(","));
      res.status(200).json({ ok: r.ok, status: r.status, data: r.data });
      return;
    }

    // 부정클릭 자동 순찰 (?step=ippatrol) — 30분마다 cron 호출
    //   기준: 최근 24시간 광고 유입 4회 이상 OR 10분 내 3회 연타. 걸리면 노출제한 자동 등록 + 문자.
    if (step === "ippatrol") {
      const SU = process.env.VITE_SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const r = await fetch(`${SU}/rest/v1/ad_click_log?ts=gte.${encodeURIComponent(sinceIso)}&order=ts.asc&limit=2000&select=ip,ts,qs,ref`, {
        headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
      const list = r.ok ? await r.json() : [];
      const byIp = {};
      for (const c of list) {
        if ((c.ref || "").includes("navercorp")) continue; // 네이버 내부 점검봇 — 차단 금지
        const isAd = (c.qs || "").includes("n_") || (c.ref || "").includes("naver");
        if (!isAd || !c.ip) continue;
        (byIp[c.ip] = byIp[c.ip] || []).push(new Date(c.ts).getTime());
      }
      const bad = [];
      for (const [ip, times] of Object.entries(byIp)) {
        let burst = false;
        for (let i = 0; i + 2 < times.length; i++) if (times[i + 2] - times[i] <= 10 * 60000) { burst = true; break; }
        if (times.length >= 4 || burst) bad.push({ ip, n: times.length, burst });
      }
      // 이미 등록된 IP 제외
      let already = new Set();
      try {
        const ex = await call("GET", "/tool/ip-exclusions", "");
        for (const e of (Array.isArray(ex.data) ? ex.data : [])) if (e.filterIp) already.add(e.filterIp);
      } catch (e) {}
      // 모바일 공용(CGNAT) 대역은 절대 자동차단 금지 — 고객 수천 명 노출이 같이 죽는다
      const targets = bad.filter(b => !already.has(b.ip) && !MOBILE_CGNAT.test(b.ip)).slice(0, 10);
      const results = [];
      for (const b of targets) {
        const rr = await call("POST", "/tool/ip-exclusions", "",
          { filterIp: b.ip, memo: "자동순찰 " + new Date(Date.now() + 9 * 3600000).toISOString().slice(5, 10) });
        results.push({ ip: b.ip, n: b.n, burst: b.burst, ok: rr.ok });
      }
      if (results.some(x => x.ok)) {
        try {
          const msg = "[올잇 광고] 부정클릭 자동차단: " + results.filter(x => x.ok).map(x => x.ip + "(" + x.n + "회" + (x.burst ? "·연타" : "") + ")").join(", ");
          const K = process.env.SOLAPI_API_KEY, S = process.env.SOLAPI_API_SECRET;
          if (K && S) {
            const date = new Date().toISOString();
            const salt = crypto.randomBytes(16).toString("hex");
            const sig = crypto.createHmac("sha256", S).update(date + salt).digest("hex");
            await fetch("https://api.solapi.com/messages/v4/send-many", { method: "POST",
              headers: { "Content-Type": "application/json",
                Authorization: `HMAC-SHA256 apiKey=${K}, date=${date}, salt=${salt}, signature=${sig}` },
              body: JSON.stringify({ messages: [{ to: "01048874002", from: "01041163991",
                text: msg, type: msg.length > 43 ? "LMS" : "SMS", subject: "올잇 광고 경보" }] }) });
          }
        } catch (e) {}
      }
      res.status(200).json({ ok: true, scanned: Object.keys(byIp).length, flagged: bad.length,
        alreadyBlocked: already.size, registered: results });
      return;
    }

    // 비즈머니 잔액 조회 (?step=bizmoney[&snap=1]) — 실시간 지출 계산용
    //   snap=1 이면 오늘(KST) 기준 스냅샷을 ad_autobid_log에 저장 (kw=_bizmoney, grp=날짜, bid_from=잔액)
    //   0시 5분 스냅샷 잔액 − 지금 잔액 = 오늘 실시간 지출 (네이버 화면과 거의 일치)
    if (step === "bizmoney") {
      const r = await call("GET", "/billing/bizmoney", "");
      const bal = r.data && (r.data.bizmoney ?? r.data.balance ?? null);
      if (req.query.snap === "1" && r.ok && bal != null) {
        const SU = process.env.VITE_SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
        try {
          await fetch(`${SU}/rest/v1/ad_autobid_log`, { method: "POST",
            headers: { apikey: SK, Authorization: `Bearer ${SK}`,
              "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ kw: "_bizmoney", grp: kst, bid_from: Math.round(bal), bid_to: 0, est1: null }) });
        } catch (e) {}
      }
      res.status(200).json({ ok: r.ok, balance: bal, raw: r.ok ? undefined : r.data });
      return;
    }

    // 연관 키워드 발굴 (?step=relkw&hints=a,b,... 최대 5) — 네이버가 추천하는 관련 검색어 전부
    if (step === "relkw") {
      const hints = String(req.query.hints || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 5);
      if (!hints.length) { res.status(200).json({ ok: false, error: "hints 필요" }); return; }
      const qc = v => { if (typeof v === "number") return v;
        const t = String(v || "").replace(/[^0-9]/g, ""); return t ? Number(t) : 5; };
      const r = await call("GET", "/keywordstool",
        "hintKeywords=" + encodeURIComponent(hints.join(",")) + "&showDetail=1");
      const list = ((r.data && r.data.keywordList) || [])
        .map(k => ({ kw: String(k.relKeyword).replace(/\s+/g, ""),
                     vol: qc(k.monthlyPcQcCnt) + qc(k.monthlyMobileQcCnt),
                     comp: k.compIdx || null }))
        .sort((a, b) => b.vol - a.vol);
      res.status(200).json({ ok: r.ok, count: list.length, rows: list.slice(0, 400) });
      return;
    }

    // 임의 후보 검색량 심사 (?step=volprobe&kws=a,b,... 최대 50) — 저장도 함께
    if (step === "volprobe") {
      const SBu = process.env.VITE_SUPABASE_URL, SBk = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const kws = String(req.query.kws || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 50);
      const qc = v => { if (typeof v === "number") return v;
        const t = String(v || "").replace(/[^0-9]/g, ""); return t ? Number(t) : 5; };
      const out = [];
      for (let i = 0; i < kws.length; i += 5) {
        const pack = kws.slice(i, i + 5);
        try {
          const r = await call("GET", "/keywordstool",
            "hintKeywords=" + encodeURIComponent(pack.join(",")) + "&showDetail=1");
          const map = new Map(((r.data && r.data.keywordList) || [])
            .map(k => [String(k.relKeyword).replace(/\s+/g, "").toUpperCase(),
                       qc(k.monthlyPcQcCnt) + qc(k.monthlyMobileQcCnt)]));
          for (const kw of pack) out.push({ kw, vol: map.get(kw.toUpperCase()) ?? null });
        } catch (e) { for (const kw of pack) out.push({ kw, vol: null }); }
      }
      const withVol = out.filter(o => o.vol != null);
      if (withVol.length && SBu && SBk) {
        await fetch(`${SBu}/rest/v1/ad_kw_volume?on_conflict=kw`, { method: "POST",
          headers: { apikey: SBk, Authorization: `Bearer ${SBk}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(withVol.map(o => ({ kw: o.kw, vol_total: o.vol }))) });
      }
      res.status(200).json({ ok: true, probed: out.length, rows: out });
      return;
    }

    // 아침 보고서 저장 (POST body: {d, html}) → 열람 슬러그 반환
    if (step === "savereport") {
      const SBu = process.env.VITE_SUPABASE_URL, SBk = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const b = req.body || {};
      if (!b.html) { res.status(200).json({ ok: false, error: "html 필요(POST)" }); return; }
      const slug = crypto.randomBytes(9).toString("hex");
      const r = await fetch(`${SBu}/rest/v1/ad_daily_report`, { method: "POST",
        headers: { apikey: SBk, Authorization: `Bearer ${SBk}`,
          "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ slug, d: b.d || null, html: String(b.html) }) });
      res.status(200).json({ ok: r.ok, slug, url: "https://ollit.vercel.app/api/report?id=" + slug });
      return;
    }

    // 문자 발송 (사장님 번호 고정)
    if (step === "sms") {
      const text = String(req.query.text || "").slice(0, 1800);
      if (!text) { res.status(200).json({ ok: false, error: "text 필요" }); return; }
      const K = process.env.SOLAPI_API_KEY, S = process.env.SOLAPI_API_SECRET;
      const date = new Date().toISOString();
      const salt = crypto.randomBytes(16).toString("hex");
      const sig = crypto.createHmac("sha256", S).update(date + salt).digest("hex");
      const r = await fetch("https://api.solapi.com/messages/v4/send-many", { method: "POST",
        headers: { "Content-Type": "application/json",
          Authorization: `HMAC-SHA256 apiKey=${K}, date=${date}, salt=${salt}, signature=${sig}` },
        body: JSON.stringify({ messages: [{ to: "01048874002", from: "01041163991",
          text, type: text.length > 43 ? "LMS" : "SMS",
          subject: "올잇 광고 보고" }] }) });
      res.status(200).json({ ok: r.ok, status: r.status });
      return;
    }

    // 경보: 자동맞춤이 75분 넘게 안 돌았으면 사장님 폰으로 문자
    if (step === "health") {
      const SB_URL2 = process.env.VITE_SUPABASE_URL, SB_KEY2 = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const ALERT_TO = "01048874002";  // 알림 받을 번호(사장님)
      const lr = await fetch(`${SB_URL2}/rest/v1/ad_autobid_log?kw=eq._run&order=run_at.desc&limit=1`, {
        headers: { apikey: SB_KEY2, Authorization: `Bearer ${SB_KEY2}` } }).then(r => r.json());
      const last = lr && lr[0] && lr[0].run_at;
      const ageMin = last ? Math.round((Date.now() - new Date(last).getTime()) / 60000) : 9999;
      let alerted = false;
      if (ageMin > 75) {
        const K = process.env.SOLAPI_API_KEY, S = process.env.SOLAPI_API_SECRET;
        if (K && S) {
          const date = new Date().toISOString();
          const salt = crypto.randomBytes(16).toString("hex");
          const sig = crypto.createHmac("sha256", S).update(date + salt).digest("hex");
          await fetch("https://api.solapi.com/messages/v4/send-many", {
            method: "POST",
            headers: { "Content-Type": "application/json",
              Authorization: `HMAC-SHA256 apiKey=${K}, date=${date}, salt=${salt}, signature=${sig}` },
            body: JSON.stringify({ messages: [{ to: ALERT_TO, from: "01041163991",
              text: `[올잇 광고] 1위 자동맞춤이 ${ageMin}분째 멈춰 있습니다. 관제판 확인 필요.`, type: "SMS" }] }),
          });
          alerted = true;
        }
      }
      res.status(200).json({ ok: true, lastRun: last, ageMin, alerted });
      return;
    }

    // 아침 자동보고 (?step=morningreport) — 매일 08:10 KST pg_cron이 호출.
    //   브라우저·세션·컴퓨터 전원과 무관하게 서버 혼자 돈다: 어제 확정치·오늘 실시간 수집
    //   → 예산다이얼 계산 → HTML 작성 → 관제판 📄보고서 탭 저장 → 사장님 문자 알림.
    //   PDF 생성·채팅 전달은 Claude 세션이 살아있을 때만 별도로 얹는다(있으면 좋고 없어도 핵심은 됨).
    if (step === "morningreport") {
      const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
      const todayStr = kstNow.toISOString().slice(0, 10);
      const yStr = new Date(kstNow.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
      const fmt = n => Number(n || 0).toLocaleString("ko-KR");
      const pickStat = d => { if (!d) return null;
        if (Array.isArray(d)) return d[0] || null;
        if (Array.isArray(d.data)) return d.data[0] || null;
        return null; };

      // ① 어제 확정치 (파워링크 + 파워컨텐츠, 캠페인 단위 — 실패해도 보고서는 계속 만든다)
      let yPL = null, yPC = null, statErr = null;
      try {
        const fields = encodeURIComponent(JSON.stringify(["impCnt", "clkCnt", "salesAmt", "ccnt"]));
        const tr = encodeURIComponent(JSON.stringify({ since: yStr, until: yStr }));
        const r1 = await call("GET", "/stats", `ids=${encodeURIComponent(CAMPAIGN_ID)}&fields=${fields}&timeRange=${tr}`);
        yPL = pickStat(r1.data);
        const r2 = await call("GET", "/stats", `ids=${encodeURIComponent(POWER_CONTENT_ID)}&fields=${fields}&timeRange=${tr}`);
        yPC = pickStat(r2.data);
        if (!yPL) statErr = "네이버 통계 응답 형식 불일치 (수동 확인 필요)";
      } catch (e) { statErr = String(e && e.message || e); }
      const yCost = yPL ? Math.round((yPL.salesAmt || 0) * 1.1) : null;
      const yJobs = yPL ? (yPL.ccnt || 0) : null;

      // 비즈머니 잔액
      let biz = null;
      try { const rb = await call("GET", "/billing/bizmoney", ""); biz = rb.data && (rb.data.bizmoney ?? rb.data.balance); } catch (e) {}

      // ② 오늘 실시간 — 관제판 자체 API 재사용(그룹/키워드 집계 로직 중복 방지, 자체 도메인이라 방화벽 문제 없음)
      let todayData = null;
      try { todayData = await fetch(`https://ollit.vercel.app/api/ad-console?token=${TOKEN}`).then(r => r.json()); } catch (e) {}
      const rows = (todayData && Array.isArray(todayData.rows) ? todayData.rows : []).filter(r => r && typeof r === "object");
      let cost = 0, imp = 0, clk = 0;
      const grpMap = {};
      for (const r of rows) {
        cost += r.cost || 0; imp += r.imp || 0; clk += r.clk || 0;
        const g = r.grp || "?"; grpMap[g] = grpMap[g] || { cost: 0, imp: 0, clk: 0, conv: 0 };
        grpMap[g].cost += r.cost || 0; grpMap[g].imp += r.imp || 0; grpMap[g].clk += r.clk || 0; grpMap[g].conv += r.conv || 0;
      }
      const jobs = (todayData && todayData.todayJobs) || 0;
      const cpa = jobs ? Math.round(cost / jobs) : 0;
      const topSpend = rows.filter(r => (r.cost || 0) >= 15000).sort((a, b) => b.cost - a.cost).slice(0, 8);
      const pendingKw = rows.filter(r => /PENDING|REVIEW/i.test(String(r.st || ""))).length;

      // ③ 파워컨텐츠 — 심사 상태 + 실제 성과 (2026-08-01부터: /api/ad-console?pc=1 재사용,
      //   기존엔 관제판이 파워링크만 집계해 파워컨텐츠가 사각지대였음. 개설일(7/27)~오늘 누적으로 판정재료 확보)
      let pcStatus = "확인불가", pc = null;
      try {
        const cr = await call("GET", "/ncc/campaigns", "");
        const pcCamp = (Array.isArray(cr.data) ? cr.data : []).find(c => c.nccCampaignId === POWER_CONTENT_ID);
        if (pcCamp) pcStatus = pcCamp.status + (pcCamp.delFlag ? "(삭제됨)" : "");
      } catch (e) {}
      try {
        pc = await fetch(`https://ollit.vercel.app/api/ad-console?token=${TOKEN}&pc=1&since=2026-07-27&until=${todayStr}`).then(r => r.json());
      } catch (e) {}
      const pcCpa = pc && pc.conv ? Math.round(pc.cost / pc.conv) : null;

      // ④ 밤사이 순찰 — 노출제한 IP 현황 (모바일 대역 재차단 감시가 핵심)
      let ipNew = [], ipTotal = 0, ipMobile = 0;
      try {
        const ir = await call("GET", "/tool/ip-exclusions", "");
        const list = Array.isArray(ir.data) ? ir.data : [];
        ipTotal = list.length;
        ipMobile = list.filter(x => MOBILE_CGNAT.test(x.filterIp || "")).length;
        const sinceMs = Date.now() - 24 * 3600 * 1000;
        ipNew = list.filter(x => (x.regTm || 0) >= sinceMs).map(x => x.filterIp);
      } catch (e) {}

      // 예산 다이얼 판정
      let dial = "적정 유지";
      if (cpa && cpa < GOAL_CPA * 0.85) dial = "여유 — 증액 검토 가능";
      else if (cpa > LIMIT_CPA) dial = "초과 — 감액 검토 필요";

      const rowsHtml = Object.entries(grpMap).filter(([, v]) => v.cost > 1000)
        .sort((a, b) => b[1].cost - a[1].cost)
        .map(([g, v]) => `<tr><td>${g}</td><td>${fmt(v.cost)}</td><td>${fmt(v.imp)}</td><td>${fmt(v.clk)}</td><td>${fmt(v.conv)}</td></tr>`).join("");
      const topHtml = topSpend.map(r => `<tr><td>${r.kw}</td><td>${fmt(r.cost)}</td><td>${r.clk}</td><td>${r.conv || 0}</td><td>${fmt(r.bid)}</td><td>${r.rnk ?? "권외"}</td></tr>`).join("");

      const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>
body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#37352F;margin:28px auto;max-width:820px;padding:0 16px;font-size:14px;line-height:1.55}
h1{font-size:21px;margin:0 0 2px} .sub{color:#787774;font-size:12.5px;margin-bottom:18px}
h2{font-size:15.5px;margin:22px 0 8px;padding-bottom:4px;border-bottom:2px solid #37352F}
table{border-collapse:collapse;width:100%;font-size:13px} th,td{border:1px solid #E3E2E0;padding:5px 8px;text-align:right}
th{background:#F7F6F4;text-align:center;font-weight:600} td:first-child{text-align:left}
.hero{display:flex;gap:10px;margin:14px 0;flex-wrap:wrap} .card{flex:1;min-width:150px;border:1px solid #E3E2E0;border-radius:8px;padding:12px 14px}
.card .l{font-size:11.5px;color:#787774} .card .v{font-size:20px;font-weight:700;margin-top:2px}
.ok{color:#0F7B6C}.warn{color:#D9730D}.bad{color:#E03E3E} .grey{color:#787774;font-size:12px}
.note{background:#FBF3DB;border-radius:6px;padding:10px 12px;font-size:12.5px;margin:8px 0}
</style></head><body>
<h1>올잇 광고 일일 보고 — ${yStr} 결산 + ${todayStr} 현재</h1>
<div class="sub">서버 자동생성(pg_cron) · ${kstNow.toISOString().slice(0, 16).replace("T", " ")} KST</div>
<div class="hero">
  <div class="card"><div class="l">어제(${yStr}) 확정 지출</div><div class="v">${yCost != null ? fmt(yCost) + "원" : "조회 실패"}</div><div class="grey">${yJobs != null ? "네이버 폼전환 " + yJobs + "건 (전화콜 미포함·실제보다 과소)" : ""}</div></div>
  <div class="card"><div class="l">오늘 실시간 지출</div><div class="v">${fmt(cost)}원</div><div class="grey">노출 ${fmt(imp)} · 클릭 ${fmt(clk)}</div></div>
  <div class="card"><div class="l">오늘 건당 광고비</div><div class="v ${cpa > LIMIT_CPA ? "bad" : (cpa > GOAL_CPA ? "warn" : "ok")}">${fmt(cpa)}원</div><div class="grey">${dial}</div></div>
  <div class="card"><div class="l">비즈머니 잔액</div><div class="v">${biz != null ? fmt(Math.round(biz)) + "원" : "조회 실패"}</div></div>
</div>
${statErr ? `<div class="note">⚠️ 어제 네이버 확정치 조회 문제: ${statErr} — 사람이 관제판에서 재확인 필요</div>` : ""}
<h2>오늘 그룹별 지출</h2>
<table><tr><th>그룹</th><th>지출</th><th>노출</th><th>클릭</th><th>전환</th></tr>${rowsHtml || '<tr><td colspan="5">데이터 없음</td></tr>'}</table>
<h2>지출 상위 키워드 (15,000원 이상)</h2>
<table><tr><th>키워드</th><th>지출</th><th>클릭</th><th>전환</th><th>입찰</th><th>순위</th></tr>${topHtml || '<tr><td colspan="6">데이터 없음</td></tr>'}</table>
<h2>파워컨텐츠 (개설 7/27 ~ 오늘 누적, 2주 판정 마감 8/10)</h2>
<ul>
<li>캠페인 상태: ${pcStatus}${pc && pc.dailyBudget ? " · 일예산 " + fmt(pc.dailyBudget) + "원" : ""}</li>
<li>누적 지출 ${pc ? fmt(pc.cost) + "원" : "조회 실패"} · 노출 ${pc ? fmt(pc.imp) : "-"} · 클릭 ${pc ? fmt(pc.clk) : "-"} · CTR ${pc ? pc.ctr : "-"}% · CPC ${pc ? fmt(pc.cpc) + "원" : "-"}</li>
<li>전환 ${pc ? pc.conv : "-"}건${pcCpa != null ? " · 전환당 " + fmt(pcCpa) + "원 (판정선 5만원)" : ""}</li>
</ul>
<h2>심사·순찰</h2>
<ul>
<li>심사중(PENDING/REVIEW) 키워드: ${pendingKw}개</li>
<li>노출제한 IP 총 ${ipTotal}개 (모바일 공용대역 ${ipMobile}개${ipMobile > 0 ? " — ⚠️ 코드상 자동등록 금지 구간인데 존재함, 확인 필요" : ""})</li>
<li>최근 24시간 신규 차단: ${ipNew.length ? ipNew.join(", ") : "없음"}</li>
</ul>
<div class="grey" style="margin-top:20px">다음 자동보고: ${new Date(kstNow.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10)} 08:10 KST · 서버 cron 자동 실행 — 컴퓨터·세션 상태와 무관</div>
</body></html>`;

      // 저장 (관제판 📄보고서 탭)
      let saveRes = { ok: false };
      try {
        const SBu = process.env.VITE_SUPABASE_URL, SBk = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const slug = crypto.randomBytes(9).toString("hex");
        const sr = await fetch(`${SBu}/rest/v1/ad_daily_report`, { method: "POST",
          headers: { apikey: SBk, Authorization: `Bearer ${SBk}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ slug, d: yStr, html }) });
        saveRes = { ok: sr.ok, slug, url: "https://ollit.vercel.app/api/report?id=" + slug };
      } catch (e) { saveRes = { ok: false, error: String(e && e.message || e) }; }

      // 사장님 문자 알림 (관제판 열어보게 유도 — 세션 없이도 존재를 알림)
      try {
        const K = process.env.SOLAPI_API_KEY, S = process.env.SOLAPI_API_SECRET;
        if (K && S && saveRes.ok) {
          const msg = `[올잇 광고] 아침 보고서 준비됨. 오늘 건당 ${fmt(cpa)}원(${dial}). ${saveRes.url}`;
          const date = new Date().toISOString();
          const salt = crypto.randomBytes(16).toString("hex");
          const sig = crypto.createHmac("sha256", S).update(date + salt).digest("hex");
          await fetch("https://api.solapi.com/messages/v4/send-many", { method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `HMAC-SHA256 apiKey=${K}, date=${date}, salt=${salt}, signature=${sig}` },
            body: JSON.stringify({ messages: [{ to: "01048874002", from: "01041163991", text: msg,
              type: msg.length > 43 ? "LMS" : "SMS", subject: "올잇 광고 아침보고" }] }) });
        }
      } catch (e) {}

      res.status(200).json({ ok: saveRes.ok, report: saveRes, cpa, cost, jobs, yCost, yJobs, ipTotal, ipMobile, statErr,
        pc: pc && { cost: pc.cost, imp: pc.imp, clk: pc.clk, conv: pc.conv, ctr: pc.ctr, cpc: pc.cpc, cpa: pcCpa } });
      return;
    }

    res.status(200).json({ ok: true, steps: ["group&name=", "addkw&gid=&bid=&kws=", "list&gid=", "volsync&gid=&offset=", "health", "morningreport"] });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
