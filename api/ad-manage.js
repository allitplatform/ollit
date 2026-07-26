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

    if (step === "list") {
      const r = await call("GET", "/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(req.query.gid));
      const rows = Array.isArray(r.data) ? r.data : [];
      res.status(200).json({ ok: true, total: rows.length,
        rows: rows.map(k => ({ kw: k.keyword, bid: k.bidAmt, st: k.status })) });
      return;
    }

    res.status(200).json({ ok: true, steps: ["group&name=", "addkw&gid=&bid=&kws=", "list&gid="] });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
