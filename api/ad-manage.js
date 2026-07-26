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

    // 개별 입찰가 수정
    if (step === "setbid") {
      const { id, gid } = req.query; const bid = Number(req.query.bid);
      if (!id || !gid || !bid || bid < 70 || bid > 100000) {
        res.status(200).json({ ok: false, error: "id/gid/bid(70~100000) 필요" }); return; }
      const r = await call("PUT", "/ncc/keywords", "fields=bidAmt",
        [{ nccKeywordId: id, nccAdgroupId: gid, bidAmt: bid, useGroupBidAmt: false }]);
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

    // 경보: 자동맞춤이 75분 넘게 안 돌았으면 사장님 폰으로 문자
    if (step === "health") {
      const SB_URL2 = process.env.VITE_SUPABASE_URL, SB_KEY2 = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const ALERT_TO = "01041163991";  // 알림 받을 번호
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

    res.status(200).json({ ok: true, steps: ["group&name=", "addkw&gid=&bid=&kws=", "list&gid=", "volsync&gid=&offset=", "health"] });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
