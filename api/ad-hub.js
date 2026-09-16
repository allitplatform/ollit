// 2026-09-16 — 광고 관리 허브 API (api/ad-hub.js)
// 여러 광고주의 네이버 검색광고 계정을 DB(ad_advertisers)로 관리하고, 성과 조회·접수 입력·변경 이력을 제공한다.
// 기존 ad-report.js(올데이) / yusol-ad.js(유솔) 와 독립 — 서로 영향 없음.
//
// 운영자(actor = 올잇 owner/admin uuid):
//   GET  ?mode=overview&actor=              관리자 메인: 광고주별 오늘 요약(광고비·클릭·순위·잔액·자동입찰·IP)
//   GET  ?mode=list&actor=
//   POST ?mode=add      body {actor, name, slug, customer_id, api_key, api_secret, campaign_filter, margin_per_order, cpa_good, cpa_limit, show_keywords, memo}
//   POST ?mode=update   body {actor, id, ...변경 필드 (api_key/api_secret 은 있을 때만 교체)}
//   POST ?mode=remove   body {actor, id}
//   GET  ?mode=stats&actor=&id=&since=&until=      라이브 조회 + 일별 캐시 갱신
//   POST ?mode=leads    body {actor, id, ymd, leads, note}
//   POST ?mode=log      body {actor, id, action, detail, actor_name, visible_to_client}
//   GET  ?mode=logs&actor=&id=
//   GET  ?mode=refresh  (Authorization: Bearer CRON_SECRET 또는 actor) — 전 광고주 어제·오늘 캐시 갱신
//   GET  ?mode=keywords&actor=&id=&since=&until=[&fresh=1]   키워드 성과(캐시 10분) + 모바일 1위 예상가(상위 40)
//   POST ?mode=setbid   body {actor, id, keywordId, adgroupId, bid, keyword?, prevBid?, actor_name}  — 입찰 변경 + 이력 자동 기록
//   POST ?mode=lockkw   body {actor, id, keywordId, adgroupId, lock:true|false, keyword?}
//   GET  ?mode=policies&actor=&id=          자동입찰: 광고그룹 목록 + 그룹별 정책 + 최근 실행 10건
//   POST ?mode=policy_set body {actor, id, adgroup_id, adgroup_name, enabled, target_pos, cap, floor_bid, margin, lower_ok}
//   GET  ?mode=autobid&actor=&id=[&run=1]   자동입찰 미리보기(run 없음) / 실제 적용(run=1). pg_cron 은 ?cron=CRON_SECRET 로 전 광고주 실행
//   GET  ?mode=ips&actor=&id=                노출제한 IP 목록 / POST ?mode=ip_add {id, ips:"a,b", memo, force} / POST ?mode=ip_del {id, ids:[...]}
// 광고주(열람 링크 토큰):
//   GET  ?mode=client&token=&since=&until=
//   POST ?mode=client_leads body {token, ymd, leads, note}
//
// 환경변수: VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / (선택) AD_HUB_KEY — 키 암호화용 비밀 문자열 / (선택) CRON_SECRET

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENC_SECRET       = process.env.AD_HUB_KEY || SERVICE_ROLE_KEY || "";
const CRON_SECRET      = process.env.CRON_SECRET || "";
const NAVER_BASE       = "https://api.searchad.naver.com";
const ADMIN_ROLES      = new Set(["owner", "admin"]);
const UUID_RE          = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YMD_RE           = /^\d{4}-\d{2}-\d{2}$/;
const FIELDS           = JSON.stringify(["impCnt", "clkCnt", "salesAmt", "ccnt", "avgRnk"]);
const FIELDS_BASE      = JSON.stringify(["impCnt", "clkCnt", "salesAmt", "avgRnk"]);

export const maxDuration = 60;

const supabase = (SUPABASE_URL && SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// ---------- 암호화 ----------
function encKey() { return crypto.createHash("sha256").update(ENC_SECRET).digest(); }
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString("base64");
}
function decrypt(b64) {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), data = buf.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", encKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

// ---------- 네이버 ----------
function naverClient(apiKey, secret, customerId) {
  const sign = (method, path) => {
    const ts = Date.now();
    const sig = crypto.createHmac("sha256", secret).update(`${ts}.${method}.${path}`).digest("base64");
    return { "X-Timestamp": String(ts), "X-API-KEY": apiKey, "X-Customer": String(customerId), "X-Signature": sig };
  };
  async function call(method, path, qs, body) {
    const url = qs ? `${NAVER_BASE}${path}?${qs}` : `${NAVER_BASE}${path}`;
    const opt = { method, headers: { ...sign(method, path), "Content-Type": "application/json" } };
    if (body !== undefined) opt.body = JSON.stringify(body);
    const r = await fetch(url, opt);
    const text = await r.text();
    if (!r.ok) { const e = new Error(`naver ${path} ${r.status}: ${text.slice(0, 160)}`); e.status = r.status; throw e; }
    try { return JSON.parse(text); } catch { return text; }
  }
  return {
    get: (path, qs) => call("GET", path, qs),
    post: (path, body, qs) => call("POST", path, qs, body),
    put: (path, body, qs) => call("PUT", path, qs, body),
    del: (path, qs) => call("DELETE", path, qs),
  };
}
const idsQs = (ids) => ids.map(i => `ids=${encodeURIComponent(i)}`).join("&");
// 네이버 캠페인 종류 — 파워링크(WEB_SITE)만 순위 예상가 기반 자동입찰 대상
const CAMP_TYPE = { WEB_SITE: "파워링크", POWER_CONTENTS: "파워컨텐츠", SHOPPING: "쇼핑", BRAND_SEARCH: "브랜드검색", PLACE: "플레이스" };
const campType = (c) => CAMP_TYPE[c?.campaignTp] || c?.campaignTp || "기타";

async function statsFor(nv, ids, since, until) {
  // 전환 필드 미지원 계정은 기본 필드로 재시도
  const tr = encodeURIComponent(JSON.stringify({ since, until }));
  try {
    const r = await nv.get("/stats", `${idsQs(ids)}&fields=${encodeURIComponent(FIELDS)}&timeRange=${tr}`);
    return r?.data || [];
  } catch (e) {
    if (e.status !== 400) throw e;
    const r = await nv.get("/stats", `${idsQs(ids)}&fields=${encodeURIComponent(FIELDS_BASE)}&timeRange=${tr}`);
    return r?.data || [];
  }
}
const row = (r) => ({
  impressions: Number(r?.impCnt || 0), clicks: Number(r?.clkCnt || 0), cost: Number(r?.salesAmt || 0),
  conv: Number(r?.ccnt || 0), rank: r?.avgRnk != null ? Number(r.avgRnk) : null,
});
function addDays(ymd, n) { const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function kstToday(off = 0) { const d = new Date(Date.now() + 9 * 3600 * 1000); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

async function fetchLive(adv, since, until, { daily = true } = {}) {
  const nv = naverClient(decrypt(adv.api_key_enc), decrypt(adv.api_secret_enc), adv.customer_id);
  const all = await nv.get("/ncc/campaigns");
  const filt = adv.campaign_filter ? String(adv.campaign_filter).trim() : "";
  const camps = (Array.isArray(all) ? all : []).filter(c => !c.delFlag && (!filt || String(c.name || "").includes(filt)));
  const ids = camps.map(c => c.nccCampaignId);
  const out = { campaigns: [], totals: row({}), days: [], bizmoney: null };
  if (ids.length === 0) return out;

  const tot = await statsFor(nv, ids, since, until);
  const byId = Object.fromEntries(tot.map(r => [r.id, row(r)]));
  out.campaigns = camps.map(c => ({ id: c.nccCampaignId, name: c.name, type: campType(c), status: c.status, dailyBudget: c.dailyBudget, userLock: c.userLock, ...(byId[c.nccCampaignId] || row({})) }))
    .sort((a, b) => b.cost - a.cost);
  for (const c of out.campaigns) { out.totals.impressions += c.impressions; out.totals.clicks += c.clicks; out.totals.cost += c.cost; out.totals.conv += c.conv; }
  const ranked = out.campaigns.filter(c => c.rank && c.impressions);
  out.totals.rank = ranked.length ? Number((ranked.reduce((a, c) => a + c.rank * c.impressions, 0) / ranked.reduce((a, c) => a + c.impressions, 0)).toFixed(1)) : null;

  if (daily) {
    const n = daysBetween(since, until);
    const jobs = [];
    for (let i = 0; i <= n; i++) {
      const d = addDays(since, i);
      jobs.push(statsFor(nv, ids, d, d).then(rs => ({ ymd: d, rows: rs })).catch(() => ({ ymd: d, rows: [] })));
    }
    const res = await Promise.all(jobs);
    out.days = res.map(({ ymd, rows }) => {
      const agg = row({}); let rSum = 0, rW = 0;
      const perCamp = rows.map(r => ({ campaign_id: r.id, ...row(r) }));
      for (const r of perCamp) { agg.impressions += r.impressions; agg.clicks += r.clicks; agg.cost += r.cost; agg.conv += r.conv; if (r.rank && r.impressions) { rSum += r.rank * r.impressions; rW += r.impressions; } }
      agg.rank = rW ? Number((rSum / rW).toFixed(1)) : null;
      return { ymd, ...agg, perCamp };
    });
  }
  try { const b = await nv.get("/billing/bizmoney"); out.bizmoney = Number(b?.bizmoney ?? 0); } catch { out.bizmoney = null; }
  return out;
}

async function cacheDays(adv, live) {
  if (!supabase || !live?.days?.length) return;
  const nameById = Object.fromEntries((live.campaigns || []).map(c => [c.id, c.name]));
  const rows = [];
  for (const d of live.days) for (const c of (d.perCamp || [])) {
    rows.push({ advertiser_id: adv.id, ymd: d.ymd, campaign_id: c.campaign_id, campaign_name: nameById[c.campaign_id] || null,
      impressions: c.impressions, clicks: c.clicks, cost: c.cost, conv: c.conv, avg_rank: c.rank, fetched_at: new Date().toISOString() });
  }
  if (rows.length) await supabase.from("ad_daily_stats").upsert(rows, { onConflict: "advertiser_id,ymd,campaign_id" });
}

// ---------- 키워드 ----------
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}
function chunk(arr, n) { const r = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n)); return r; }

async function fetchKeywords(adv, since, until) {
  const nv = naverClient(decrypt(adv.api_key_enc), decrypt(adv.api_secret_enc), adv.customer_id);
  const groups = await listGroups(nv, adv);
  const kwLists = await mapLimit(groups, 4, g => nv.get("/ncc/keywords", `nccAdgroupId=${encodeURIComponent(g.id)}`).catch(() => []));
  const kws = [];
  groups.forEach((g, i) => { for (const k of (Array.isArray(kwLists[i]) ? kwLists[i] : [])) if (!k.delFlag) kws.push({ id: k.nccKeywordId, keyword: k.keyword, groupId: g.id, group: g.name, bid: k.useGroupBidAmt ? g.bid : k.bidAmt, useGroupBid: !!k.useGroupBidAmt, lock: !!k.userLock, status: k.status, qi: k.nccQi?.qiGrade ?? null }); });
  const byId = Object.fromEntries(kws.map(k => [k.id, k]));
  const chunks = chunk(kws.map(k => k.id), 20);
  const statRows = await mapLimit(chunks, 8, ids => statsFor(nv, ids, since, until).catch(() => []));
  for (const rows of statRows) for (const r of rows) { const k = byId[r.id]; if (k) Object.assign(k, row(r)); }
  for (const k of kws) { if (k.impressions == null) Object.assign(k, row({})); k.ctr = k.impressions ? Number((k.clicks / k.impressions * 100).toFixed(2)) : 0; k.cpc = k.clicks ? Math.round(k.cost / k.clicks) : 0; }
  kws.sort((a, b) => (b.cost - a.cost) || (b.impressions - a.impressions));
  // 상위 40개 모바일 1위 예상가
  const top = kws.filter(k => k.impressions > 0).slice(0, 40);
  if (top.length) {
    try {
      const est = await nv.post("/estimate/average-position-bid/keyword", { device: "MOBILE", items: top.map(k => ({ key: k.keyword, position: 1 })) });
      const m = {}; for (const e of (est?.estimate || [])) m[e.keyword] = e.bid;
      for (const k of top) if (m[k.keyword] != null) k.top1Bid = m[k.keyword];
    } catch (e) { console.error("[ad-hub] estimate", e?.message); }
  }
  return { groups, keywords: kws, total: kws.length, exposed: kws.filter(k => k.impressions > 0).length };
}

async function keywordsCached(adv, since, until, fresh) {
  const key = `${since}_${until}`;
  if (!fresh) {
    const { data } = await supabase.from("ad_keyword_cache").select("payload,fetched_at").eq("advertiser_id", adv.id).eq("range_key", key).maybeSingle();
    if (data && Date.now() - new Date(data.fetched_at).getTime() < 10 * 60 * 1000) return { ...data.payload, cached: true, fetched_at: data.fetched_at };
  }
  const payload = await fetchKeywords(adv, since, until);
  const slim = { ...payload, keywords: payload.keywords.slice(0, 300) };
  await supabase.from("ad_keyword_cache").upsert({ advertiser_id: adv.id, range_key: key, payload: slim, fetched_at: new Date().toISOString() }, { onConflict: "advertiser_id,range_key" });
  return { ...slim, cached: false, fetched_at: new Date().toISOString() };
}

// ---------- 자동입찰 ----------
// 정책(ad_autobid_policies)이 켜진 광고그룹의 살아있는 키워드마다 모바일 목표순위 예상가를 받아
//   목표 입찰 = round(예상가 × 여유율 / 10) × 10 → 상한 초과면 2위 예상가로 대체(그것도 초과면 상한) → 바닥 이하면 바닥
// 현재가와 10% 이상 차이날 때만 변경. lower_ok=false 면 내리지 않음. dry=true 면 계산만.
const AUTOBID_MIN_DIFF = 0.10;
const AUTOBID_MAX_CHANGES_LOGGED = 100;
const roundBid = (v) => Math.round(Number(v || 0) / 10) * 10;

async function estimateBids(nv, keywords, position) {
  const m = {};
  for (const part of chunk(keywords, 100)) {
    try {
      const r = await nv.post("/estimate/average-position-bid/keyword", { device: "MOBILE", items: part.map(k => ({ key: k, position })) });
      for (const e of (r?.estimate || [])) if (e?.keyword != null) m[e.keyword] = Number(e.bid || 0);
    } catch (e) { console.error("[ad-hub] autobid estimate", e?.message); }
  }
  return m;
}

async function listGroups(nv, adv) {
  const all = await nv.get("/ncc/campaigns");
  const filt = adv.campaign_filter ? String(adv.campaign_filter).trim() : "";
  const camps = (Array.isArray(all) ? all : []).filter(c => !c.delFlag && (!filt || String(c.name || "").includes(filt)));
  const groups = [];
  for (const c of camps) {
    const gs = await nv.get("/ncc/adgroups", `nccCampaignId=${encodeURIComponent(c.nccCampaignId)}`);
    for (const g of (Array.isArray(gs) ? gs : [])) if (!g.delFlag) groups.push({ id: g.nccAdgroupId, name: g.name, campaign: c.name, type: campType(c), autobidOk: c.campaignTp === "WEB_SITE", bid: g.bidAmt, lock: !!g.userLock, status: g.status });
  }
  return groups;
}

async function runAutobid(adv, { dry }) {
  const { data: pols } = await supabase.from("ad_autobid_policies").select("*").eq("advertiser_id", adv.id).eq("enabled", true);
  const policies = pols || [];
  const run = { advertiser_id: adv.id, dry: !!dry, alive: 0, changed: 0, raised: 0, lowered: 0, capped: 0, no_est: 0, changes: [], error: null };
  if (policies.length === 0) return { ...run, skipped: true, reason: "켜진 정책 없음" };
  const nv = naverClient(decrypt(adv.api_key_enc), decrypt(adv.api_secret_enc), adv.customer_id);
  const updates = [];
  try {
    // 파워링크 그룹만 — 파워컨텐츠 등은 순위 예상가 방식이 맞지 않으므로 정책이 켜져 있어도 건너뜀
    const okIds = new Set((await listGroups(nv, adv)).filter(g => g.autobidOk).map(g => g.id));
    for (const p of policies) {
      if (!okIds.has(p.adgroup_id)) continue;
      let list = [];
      try { list = await nv.get("/ncc/keywords", `nccAdgroupId=${encodeURIComponent(p.adgroup_id)}`); } catch (e) { console.error("[ad-hub] autobid kw", e?.message); continue; }
      let gBid = null;
      const alive = (Array.isArray(list) ? list : []).filter(k => !k.delFlag && !k.userLock && k.status !== "PAUSED");
      if (alive.some(k => k.useGroupBidAmt)) { try { const g = await nv.get(`/ncc/adgroups/${encodeURIComponent(p.adgroup_id)}`); gBid = Number(g?.bidAmt || 0); } catch { /* 그룹가 없으면 개별가만 */ } }
      run.alive += alive.length;
      const target = Math.max(1, Math.min(5, Number(p.target_pos || 1)));
      const margin = Number(p.margin || 1.1), cap = Number(p.cap || 5000), floor = Number(p.floor_bid || 300);
      const words = [...new Set(alive.map(k => k.keyword))];
      const est1 = await estimateBids(nv, words, target);
      const needPos2 = words.filter(w => est1[w] != null && roundBid(est1[w] * margin) > cap);
      const est2 = needPos2.length ? await estimateBids(nv, needPos2, target + 1) : {};
      for (const k of alive) {
        const cur = k.useGroupBidAmt ? (gBid || 0) : Number(k.bidAmt || 0);
        const e1 = est1[k.keyword];
        if (e1 == null || e1 <= 0) { run.no_est++; continue; }
        let bid = roundBid(e1 * margin), note = `${target}위`;
        if (bid > cap) {
          const e2 = est2[k.keyword];
          const b2 = e2 ? roundBid(e2 * margin) : 0;
          if (b2 > 0 && b2 <= cap) { bid = b2; note = `${target + 1}위(상한)`; }
          else { bid = cap; note = "상한"; run.capped++; }
        }
        if (bid < floor) { bid = floor; note = "바닥"; }
        if (bid < 70) bid = 70;
        if (cur > 0 && bid < cur && p.lower_ok === false) continue;
        if (cur > 0 && Math.abs(bid - cur) / cur < AUTOBID_MIN_DIFF) continue;
        if (bid === cur) continue;
        updates.push({ nccKeywordId: k.nccKeywordId, nccAdgroupId: p.adgroup_id, bidAmt: bid, useGroupBidAmt: false });
        if (bid > cur) run.raised++; else run.lowered++;
        if (run.changes.length < AUTOBID_MAX_CHANGES_LOGGED) run.changes.push({ kw: k.keyword, grp: p.adgroup_name || p.adgroup_id, from: cur, to: bid, est: e1, note });
      }
    }
    run.changed = updates.length;
    if (!dry && updates.length) {
      for (const part of chunk(updates, 200)) await nv.put("/ncc/keywords", part, "fields=bidAmt");
      await supabase.from("ad_change_log").insert({ advertiser_id: adv.id, actor: "자동입찰", action: "자동입찰",
        detail: `${updates.length}개 조정 (↑${run.raised} ↓${run.lowered}${run.capped ? ` · 상한 ${run.capped}` : ""}) — 대상 ${run.alive}개`, visible_to_client: true });
      await supabase.from("ad_keyword_cache").delete().eq("advertiser_id", adv.id);
    }
  } catch (e) {
    run.error = e?.message || String(e);
  }
  const { data: saved } = await supabase.from("ad_autobid_runs").insert({ ...run, changes: run.changes }).select("id,at").single();
  return { ...run, id: saved?.id, at: saved?.at };
}

async function autobidSummary(advId) {
  const [{ data: pols }, { data: runs }] = await Promise.all([
    supabase.from("ad_autobid_policies").select("adgroup_id,adgroup_name,enabled,target_pos,cap").eq("advertiser_id", advId),
    supabase.from("ad_autobid_runs").select("id,at,dry,alive,changed,raised,lowered,capped,no_est,error").eq("advertiser_id", advId).eq("dry", false).order("at", { ascending: false }).limit(1),
  ]);
  const on = (pols || []).filter(p => p.enabled);
  return { enabled: on.length > 0, groups: on.length, total_groups: (pols || []).length, last: runs?.[0] || null };
}

// ---------- 부정클릭 (노출제한 IP) ----------
// 네이버 계정 단위 목록. 등록된 IP 에는 광고가 아예 안 보인다 (계정당 600개 한도). 모바일 공용 대역은 force 없이는 거부.
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
const MOBILE_CGNAT = /^(223\.(3[2-9]|[45][0-9]|6[0-3])\.|106\.10[12]\.|117\.111\.|211\.234\.|118\.235\.|110\.70\.|39\.7\.|175\.223\.|211\.36\.)/;
async function ipList(nv) {
  const r = await nv.get("/tool/ip-exclusions");
  const list = (Array.isArray(r) ? r : (r?.data || [])).map(x => ({ id: x.ipFilterId, ip: x.filterIp, memo: x.memo || "", at: x.regTm || null }));
  list.sort((a, b) => (b.at || 0) - (a.at || 0));
  return list;
}
async function ipSummary(nv) {
  try {
    const list = await ipList(nv);
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    return { total: list.length, new24h: list.filter(x => (x.at || 0) >= dayAgo).length, mobile: list.filter(x => MOBILE_CGNAT.test(x.ip)).length, limit: 600 };
  } catch { return null; }
}

// ---------- 공통 ----------
function pub(a) {
  return { id: a.id, name: a.name, slug: a.slug, customer_id: a.customer_id, campaign_filter: a.campaign_filter,
    margin_per_order: a.margin_per_order, cpa_good: a.cpa_good, cpa_limit: a.cpa_limit, show_keywords: a.show_keywords,
    memo: a.memo, active: a.active, client_token: a.client_token, created_at: a.created_at };
}
function clientPub(a) {
  return { id: a.id, name: a.name, cpa_good: a.cpa_good, cpa_limit: a.cpa_limit, margin_per_order: a.margin_per_order, show_keywords: a.show_keywords };
}
async function assertAdmin(actor) {
  if (!actor || !UUID_RE.test(actor)) return { ok: false, code: 400, error: "actor(uuid) required" };
  if (!supabase) return { ok: false, code: 500, error: "supabase service role 미구성" };
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", actor);
  if (error) return { ok: false, code: 500, error: error.message };
  if (!(data || []).some(r => ADMIN_ROLES.has(r.role))) return { ok: false, code: 403, error: "admin only" };
  return { ok: true };
}
async function getAdv(id) {
  const { data, error } = await supabase.from("ad_advertisers").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
async function getAdvByToken(token) {
  if (!token || !/^[a-z0-9]{20,40}$/i.test(token)) return null;
  const { data } = await supabase.from("ad_advertisers").select("*").eq("client_token", token).eq("active", true).maybeSingle();
  return data || null;
}
async function leadsMap(advId, since, until) {
  const { data } = await supabase.from("ad_leads").select("ymd,leads,note,entered_by").eq("advertiser_id", advId).gte("ymd", since).lte("ymd", until);
  const m = {}; for (const r of (data || [])) m[r.ymd] = { leads: r.leads, note: r.note, by: r.entered_by };
  return m;
}
// 광고주에게는 금액·키워드명을 숨긴 요약만 (입찰가/키워드 비공개 원칙)
const CLIENT_ACTION_TEXT = { "입찰 변경": "키워드 입찰 조정", "키워드 중지": "키워드 노출 중지", "키워드 재개": "키워드 노출 재개" };
function logForClient(l) {
  let detail = l.detail || "";
  if (CLIENT_ACTION_TEXT[l.action]) { const m = /—\s*(.+)$/.exec(detail); detail = m ? m[1] : ""; }
  detail = detail.replace(/\s*[·]?\s*(상한|바닥|입찰가?)\s*[\d,]+원/g, "").replace(/[\d,]+원\s*→\s*/g, "").replace(/[\d,]+원/g, "").replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim();
  return { id: l.id, at: l.at, actor: l.actor === "자동입찰" ? "자동입찰" : "올잇 마케팅", action: CLIENT_ACTION_TEXT[l.action] || l.action, detail };
}
async function logsList(advId, clientOnly) {
  let q = supabase.from("ad_change_log").select("id,at,actor,action,detail,visible_to_client").eq("advertiser_id", advId).order("at", { ascending: false }).limit(60);
  if (clientOnly) q = q.eq("visible_to_client", true);
  const { data } = await q;
  return clientOnly ? (data || []).map(logForClient) : (data || []);
}
// 광고주 화면 "실시간 관리 현황" — 오늘 점검 횟수·조정 건수, 이번 주 운영자 작업 수
async function careSummary(advId) {
  const todayStart = new Date(kstToday(0) + "T00:00:00+09:00").toISOString();
  const weekStart = new Date(addDays(kstToday(0), -6) + "T00:00:00+09:00").toISOString();
  const [{ data: runs }, { data: ops }] = await Promise.all([
    supabase.from("ad_autobid_runs").select("at,changed,alive,error").eq("advertiser_id", advId).eq("dry", false).gte("at", weekStart).order("at", { ascending: false }).limit(400),
    supabase.from("ad_change_log").select("at,action").eq("advertiser_id", advId).eq("visible_to_client", true).neq("actor", "자동입찰").gte("at", weekStart),
  ]);
  const all = runs || [];
  const t0 = new Date(todayStart).getTime();
  const r = all.filter(x => new Date(x.at).getTime() >= t0);
  return { checks_today: r.length, adjusted_today: r.reduce((a, x) => a + Number(x.changed || 0), 0), watched: (r[0] || all[0])?.alive || 0, last_check: (r[0] || all[0])?.at || null, ops_week: (ops || []).length };
}
function parseRange(q) {
  let since = q.since, until = q.until;
  if (!YMD_RE.test(until || "")) until = kstToday(0);
  if (!YMD_RE.test(since || "")) since = addDays(until, -6);
  if (since > until) since = until;
  if (daysBetween(since, until) > 31) since = addDays(until, -31);
  return { since, until };
}
function won(n) { return Number(n || 0).toLocaleString("ko-KR"); }
function num(v, d = null) { if (v === "" || v == null) return d; const n = Number(v); return Number.isFinite(n) ? Math.round(n) : d; }
function slugify(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || ("adv-" + Date.now().toString(36)); }

async function respondStats(res, adv, q, { client }) {
  const { since, until } = parseRange(q);
  const live = await fetchLive(adv, since, until, { daily: true });
  cacheDays(adv, live).catch(e => console.error("[ad-hub] cache", e?.message));
  const leads = await leadsMap(adv.id, since, until);
  const logs = await logsList(adv.id, !!client);
  const leadTotal = Object.values(leads).reduce((a, r) => a + Number(r.leads || 0), 0);
  const nv = naverClient(decrypt(adv.api_key_enc), decrypt(adv.api_secret_enc), adv.customer_id);
  const [autobid, ips, care] = await Promise.all([autobidSummary(adv.id).catch(() => null), ipSummary(nv), careSummary(adv.id).catch(() => null)]);
  return res.status(200).json({ ok: true, advertiser: client ? clientPub(adv) : pub(adv), since, until, ...live, leads, leadTotal, logs, autobid, ips, care, cron_ready: !!CRON_SECRET });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!supabase) return res.status(500).json({ ok: false, error: "supabase 미구성" });
  const q = req.query || {};
  const body = (req.method === "POST" && req.body && typeof req.body === "object") ? req.body : {};
  const mode = String(q.mode || body.mode || "");
  try {
    // ----- 광고주 열람 -----
    if (mode === "client") {
      const adv = await getAdvByToken(q.token);
      if (!adv) return res.status(404).json({ ok: false, error: "링크가 유효하지 않습니다" });
      return respondStats(res, adv, q, { client: true });
    }
    if (mode === "client_leads") {
      const adv = await getAdvByToken(body.token);
      if (!adv) return res.status(404).json({ ok: false, error: "링크가 유효하지 않습니다" });
      if (!YMD_RE.test(body.ymd || "")) return res.status(400).json({ ok: false, error: "ymd" });
      const { error } = await supabase.from("ad_leads").upsert({ advertiser_id: adv.id, ymd: body.ymd, leads: num(body.leads, 0), note: body.note || null, entered_by: "client", updated_at: new Date().toISOString() }, { onConflict: "advertiser_id,ymd" });
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true });
    }
    // ----- 크론 -----
    if (mode === "refresh") {
      const auth = String(req.headers.authorization || "");
      const cronOk = CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
      if (!cronOk) { const g = await assertAdmin(q.actor || body.actor); if (!g.ok) return res.status(g.code).json(g); }
      const { data: advs } = await supabase.from("ad_advertisers").select("*").eq("active", true);
      const since = kstToday(-1), until = kstToday(0), done = [];
      for (const adv of (advs || [])) {
        try { const live = await fetchLive(adv, since, until, { daily: true }); await cacheDays(adv, live); done.push({ id: adv.id, name: adv.name, ok: true, bizmoney: live.bizmoney }); }
        catch (e) { done.push({ id: adv.id, name: adv.name, ok: false, error: e?.message }); }
      }
      return res.status(200).json({ ok: true, since, until, done });
    }
    // ----- 자동입찰 실행 (pg_cron: ?cron=CRON_SECRET / 화면: actor) -----
    if (mode === "autobid") {
      const cronOk = CRON_SECRET && (String(q.cron || "") === CRON_SECRET || String(req.headers.authorization || "") === `Bearer ${CRON_SECRET}`);
      if (!cronOk) { const g = await assertAdmin(q.actor || body.actor); if (!g.ok) return res.status(g.code).json(g); }
      const dry = !(q.run === "1" || body.run === true || body.run === 1);
      const id = q.id || body.id;
      let advs;
      if (id) { if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, error: "id" }); const a = await getAdv(id); advs = a ? [a] : []; }
      else { const { data } = await supabase.from("ad_advertisers").select("*").eq("active", true); advs = data || []; }
      const results = [];
      for (const adv of advs) {
        try { const r = await runAutobid(adv, { dry }); results.push({ advertiser: adv.name, ...r }); }
        catch (e) { results.push({ advertiser: adv.name, error: e?.message || String(e) }); }
      }
      return res.status(200).json({ ok: true, dry, results });
    }
    // ----- 운영자 -----
    const gate = await assertAdmin(q.actor || body.actor);
    if (!gate.ok) return res.status(gate.code).json(gate);

    if (mode === "policies") {
      if (!UUID_RE.test(q.id || "")) return res.status(400).json({ ok: false, error: "id" });
      const adv = await getAdv(q.id); if (!adv) return res.status(404).json({ ok: false, error: "없음" });
      const nv = naverClient(decrypt(adv.api_key_enc), decrypt(adv.api_secret_enc), adv.customer_id);
      const [groups, { data: pols }, { data: runs }] = await Promise.all([
        listGroups(nv, adv).catch(() => []),
        supabase.from("ad_autobid_policies").select("*").eq("advertiser_id", adv.id),
        supabase.from("ad_autobid_runs").select("id,at,dry,alive,changed,raised,lowered,capped,no_est,changes,error").eq("advertiser_id", adv.id).order("at", { ascending: false }).limit(10),
      ]);
      const byGroup = Object.fromEntries((pols || []).map(p => [p.adgroup_id, p]));
      return res.status(200).json({ ok: true, groups: groups.map(g => ({ ...g, policy: byGroup[g.id] || null })), runs: runs || [], cron_ready: !!CRON_SECRET });
    }
    if (mode === "policy_set") {
      if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST" });
      if (!UUID_RE.test(body.id || "") || !body.adgroup_id) return res.status(400).json({ ok: false, error: "id/adgroup_id" });
      const adv = await getAdv(body.id); if (!adv) return res.status(404).json({ ok: false, error: "없음" });
      if (body.enabled !== false) {
        const nv = naverClient(decrypt(adv.api_key_enc), decrypt(adv.api_secret_enc), adv.customer_id);
        const g = (await listGroups(nv, adv)).find(x => x.id === String(body.adgroup_id));
        if (g && !g.autobidOk) return res.status(400).json({ ok: false, error: `${g.type} 그룹은 자동입찰 대상이 아닙니다 (파워링크만 가능)` });
      }
      const rowP = {
        advertiser_id: adv.id, adgroup_id: String(body.adgroup_id), adgroup_name: body.adgroup_name ? String(body.adgroup_name).slice(0, 120) : null,
        enabled: body.enabled !== false, target_pos: Math.max(1, Math.min(5, num(body.target_pos, 1))),
        cap: Math.max(70, num(body.cap, 5000)), floor_bid: Math.max(70, num(body.floor_bid, 300)),
        margin: Math.min(2, Math.max(1, Number(body.margin) || 1.1)), lower_ok: body.lower_ok !== false, updated_at: new Date().toISOString(),
      };
      if (rowP.floor_bid > rowP.cap) rowP.floor_bid = rowP.cap;
      const { data, error } = await supabase.from("ad_autobid_policies").upsert(rowP, { onConflict: "advertiser_id,adgroup_id" }).select("*").single();
      if (error) return res.status(500).json({ ok: false, error: error.message });
      await supabase.from("ad_change_log").insert({ advertiser_id: adv.id, actor: body.actor_name || "운영자", action: rowP.enabled ? "자동입찰 설정" : "자동입찰 해제",
        detail: `${rowP.adgroup_name || rowP.adgroup_id}: ${rowP.enabled ? `목표 ${rowP.target_pos}위 · 상한 ${won(rowP.cap)}원 · 바닥 ${won(rowP.floor_bid)}원${rowP.lower_ok ? "" : " · 올리기만"}` : "자동입찰 끔"}`, visible_to_client: true });
      return res.status(200).json({ ok: true, policy: data });
    }

    if (mode === "overview") {
      // 관리자 메인 — 광고주별 오늘 요약 (병렬). 광고주가 많아지면 캐시 필요
      const { data: advs } = await supabase.from("ad_advertisers").select("*").eq("active", true).order("created_at", { ascending: true });
      const since = kstToday(-1), until = kstToday(0);
      const rows = await Promise.all((advs || []).map(async (adv) => {
        try {
          const nv = naverClient(decrypt(adv.api_key_enc), decrypt(adv.api_secret_enc), adv.customer_id);
          const [live, autobid, ips, leads] = await Promise.all([
            fetchLive(adv, since, until, { daily: true }), autobidSummary(adv.id).catch(() => null), ipSummary(nv), leadsMap(adv.id, until, until),
          ]);
          cacheDays(adv, live).catch(() => {});
          const today = (live.days || []).find(d => d.ymd === until) || { impressions: 0, clicks: 0, cost: 0, rank: null };
          const yday = (live.days || []).find(d => d.ymd === since) || { clicks: 0, cost: 0 };
          const { data: hist } = await supabase.from("ad_daily_stats").select("ymd,cost").eq("advertiser_id", adv.id).gte("ymd", addDays(until, -7)).lt("ymd", until);
          const byDay = {}; for (const r of (hist || [])) byDay[r.ymd] = (byDay[r.ymd] || 0) + Number(r.cost || 0);
          const days = Object.values(byDay); const avgDay = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length * 1.1) : 0;
          return { ...pub(adv), ok: true, today: { ...today, costVat: Math.round(today.cost * 1.1), lead: leads[until]?.leads ?? null }, yday: { clicks: yday.clicks, costVat: Math.round(yday.cost * 1.1) },
            bizmoney: live.bizmoney, avgDay, bizDays: live.bizmoney != null && avgDay > 0 ? live.bizmoney / avgDay : null, autobid, ips, campaigns: (live.campaigns || []).length };
        } catch (e) { return { ...pub(adv), ok: false, error: e?.message || String(e) }; }
      }));
      return res.status(200).json({ ok: true, since, until, advertisers: rows, cron_ready: !!CRON_SECRET });
    }
    if (mode === "list") {
      const { data, error } = await supabase.from("ad_advertisers").select("*").order("created_at", { ascending: true });
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, advertisers: (data || []).map(pub) });
    }
    if (mode === "add" || mode === "update") {
      if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST" });
      const patch = {};
      if (body.name != null) patch.name = String(body.name).trim();
      if (body.slug != null) patch.slug = slugify(body.slug);
      if (body.customer_id != null) patch.customer_id = String(body.customer_id).trim();
      if (body.campaign_filter !== undefined) patch.campaign_filter = body.campaign_filter ? String(body.campaign_filter).trim() : null;
      if (body.margin_per_order !== undefined) patch.margin_per_order = num(body.margin_per_order);
      if (body.cpa_good !== undefined) patch.cpa_good = num(body.cpa_good);
      if (body.cpa_limit !== undefined) patch.cpa_limit = num(body.cpa_limit);
      if (body.show_keywords !== undefined) patch.show_keywords = !!body.show_keywords;
      if (body.memo !== undefined) patch.memo = body.memo ? String(body.memo) : null;
      if (body.active !== undefined) patch.active = !!body.active;
      // 올데이 봇이 쓰는 서버 환경변수(NAVER_AD_*) 그대로 등록 — 비밀값을 화면에 다시 입력할 필요 없음
      if (body.use_env) {
        const pre = body.use_env === "yusol" ? "YUSOL_AD" : "NAVER_AD"; // 올데이 봇 / 유솔 봇이 쓰는 변수 이름
        const k = process.env[`${pre}_API_KEY`], sc = process.env[`${pre}_SECRET`], cid = process.env[`${pre}_CUSTOMER_ID`];
        if (!k || !sc || !cid) return res.status(400).json({ ok: false, error: `서버에 ${pre}_API_KEY / ${pre}_SECRET / ${pre}_CUSTOMER_ID 가 없습니다` });
        body.api_key = k; body.api_secret = sc; patch.customer_id = String(cid).trim();
      }
      if (body.api_key) patch.api_key_enc = encrypt(String(body.api_key).trim());
      if (body.api_secret) patch.api_secret_enc = encrypt(String(body.api_secret).trim());
      // 마진만 주면 판정선 자동 (효율 = 마진의 50%, 상한 = 마진의 100%)
      if (patch.margin_per_order && patch.cpa_good == null && body.cpa_good === undefined) patch.cpa_good = Math.round(patch.margin_per_order * 0.5);
      if (patch.margin_per_order && patch.cpa_limit == null && body.cpa_limit === undefined) patch.cpa_limit = patch.margin_per_order;

      if (mode === "add") {
        if (!patch.name || !patch.customer_id || !patch.api_key_enc || !patch.api_secret_enc) return res.status(400).json({ ok: false, error: "이름·CUSTOMER_ID·API 키·비밀키는 필수" });
        if (!patch.slug) patch.slug = slugify(patch.name);
        patch.client_token = crypto.randomBytes(16).toString("hex");
        // 연결 확인 — 캠페인 목록이 열려야 저장
        try { await naverClient(body.api_key.trim(), body.api_secret.trim(), patch.customer_id).get("/ncc/campaigns"); }
        catch (e) { return res.status(400).json({ ok: false, error: "네이버 연결 실패 — 키/CUSTOMER_ID 확인: " + (e?.message || "") }); }
        const { data, error } = await supabase.from("ad_advertisers").insert(patch).select("*").single();
        if (error) return res.status(500).json({ ok: false, error: error.message });
        await supabase.from("ad_change_log").insert({ advertiser_id: data.id, actor: body.actor_name || "운영자", action: "광고주 등록", detail: `${data.name} (계정 ${data.customer_id}) 관리 시작`, visible_to_client: true });
        return res.status(200).json({ ok: true, advertiser: pub(data) });
      }
      if (!UUID_RE.test(body.id || "")) return res.status(400).json({ ok: false, error: "id" });
      patch.updated_at = new Date().toISOString();
      if (patch.api_key_enc || patch.api_secret_enc || patch.customer_id) {
        const cur = await getAdv(body.id); if (!cur) return res.status(404).json({ ok: false, error: "없음" });
        const k = body.api_key ? body.api_key.trim() : decrypt(cur.api_key_enc);
        const s = body.api_secret ? body.api_secret.trim() : decrypt(cur.api_secret_enc);
        try { await naverClient(k, s, patch.customer_id || cur.customer_id).get("/ncc/campaigns"); }
        catch (e) { return res.status(400).json({ ok: false, error: "네이버 연결 실패: " + (e?.message || "") }); }
      }
      const { data, error } = await supabase.from("ad_advertisers").update(patch).eq("id", body.id).select("*").single();
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, advertiser: pub(data) });
    }
    if (mode === "remove") {
      if (!UUID_RE.test(body.id || "")) return res.status(400).json({ ok: false, error: "id" });
      const { error } = await supabase.from("ad_advertisers").update({ active: false, updated_at: new Date().toISOString() }).eq("id", body.id);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true });
    }
    if (mode === "rotate_token") {
      if (!UUID_RE.test(body.id || "")) return res.status(400).json({ ok: false, error: "id" });
      const token = crypto.randomBytes(16).toString("hex");
      const { error } = await supabase.from("ad_advertisers").update({ client_token: token }).eq("id", body.id);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, client_token: token });
    }
    if (mode === "stats") {
      if (!UUID_RE.test(q.id || "")) return res.status(400).json({ ok: false, error: "id" });
      const adv = await getAdv(q.id); if (!adv) return res.status(404).json({ ok: false, error: "없음" });
      return respondStats(res, adv, q, { client: false });
    }
    if (mode === "keywords") {
      if (!UUID_RE.test(q.id || "")) return res.status(400).json({ ok: false, error: "id" });
      const adv = await getAdv(q.id); if (!adv) return res.status(404).json({ ok: false, error: "없음" });
      const { since, until } = parseRange(q);
      const r = await keywordsCached(adv, since, until, q.fresh === "1");
      return res.status(200).json({ ok: true, since, until, ...r });
    }
    if (mode === "setbid" || mode === "lockkw") {
      if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST" });
      if (!UUID_RE.test(body.id || "") || !body.keywordId || !body.adgroupId) return res.status(400).json({ ok: false, error: "id/keywordId/adgroupId" });
      const adv = await getAdv(body.id); if (!adv) return res.status(404).json({ ok: false, error: "없음" });
      const nv = naverClient(decrypt(adv.api_key_enc), decrypt(adv.api_secret_enc), adv.customer_id);
      let detail;
      if (mode === "setbid") {
        const bid = num(body.bid); if (!bid || bid < 70) return res.status(400).json({ ok: false, error: "입찰가는 70원 이상" });
        await nv.put("/ncc/keywords", [{ nccKeywordId: body.keywordId, nccAdgroupId: body.adgroupId, bidAmt: bid, useGroupBidAmt: false }], "fields=bidAmt");
        detail = `${body.keyword || body.keywordId}: ${body.prevBid ? won(body.prevBid) + "원 → " : ""}${won(bid)}원`;
      } else {
        const lock = !!body.lock;
        await nv.put("/ncc/keywords", [{ nccKeywordId: body.keywordId, nccAdgroupId: body.adgroupId, userLock: lock }], "fields=userLock");
        detail = `${body.keyword || body.keywordId}: ${lock ? "중지" : "재개"}`;
      }
      await supabase.from("ad_change_log").insert({ advertiser_id: adv.id, actor: body.actor_name || "운영자", action: mode === "setbid" ? "입찰 변경" : "키워드 " + (body.lock ? "중지" : "재개"), detail: body.reason ? `${detail} — ${body.reason}` : detail, visible_to_client: true });
      // 캐시 무효화 (다음 조회 때 새로 받음)
      await supabase.from("ad_keyword_cache").delete().eq("advertiser_id", adv.id);
      return res.status(200).json({ ok: true, detail });
    }
    if (mode === "ips" || mode === "ip_add" || mode === "ip_del") {
      const id = q.id || body.id;
      if (!UUID_RE.test(id || "")) return res.status(400).json({ ok: false, error: "id" });
      const adv = await getAdv(id); if (!adv) return res.status(404).json({ ok: false, error: "없음" });
      const nv = naverClient(decrypt(adv.api_key_enc), decrypt(adv.api_secret_enc), adv.customer_id);
      if (mode === "ip_add") {
        if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST" });
        const raw = String(body.ips || "").split(/[\s,]+/).map(x => x.trim()).filter(x => IPV4_RE.test(x)).slice(0, 20);
        const skippedMobile = raw.filter(ip => MOBILE_CGNAT.test(ip) && !body.force);
        const ips = raw.filter(ip => !skippedMobile.includes(ip));
        if (!ips.length) return res.status(400).json({ ok: false, error: raw.length ? "모바일 공용 대역 — 통신사 사용자 전체가 막힙니다. 그래도 등록하려면 강제 체크" : "IPv4 주소를 입력하세요", skippedMobile });
        const memo = String(body.memo || "허브 수동등록").slice(0, 30);
        const have = new Set((await ipList(nv)).map(x => x.ip));
        const results = [];
        for (const ip of ips) {
          if (have.has(ip)) { results.push({ ip, ok: true, dup: true }); continue; }
          try { await nv.post("/tool/ip-exclusions", { filterIp: ip, memo }); results.push({ ip, ok: true }); }
          catch (e) { results.push({ ip, ok: false, error: e?.message }); }
        }
        const added = results.filter(r => r.ok && !r.dup).map(r => r.ip);
        if (added.length) await supabase.from("ad_change_log").insert({ advertiser_id: adv.id, actor: body.actor_name || "운영자", action: "IP 차단", detail: `${added.length}개 노출제한 등록${body.memo ? ` — ${body.memo}` : ""}`, visible_to_client: true });
        return res.status(200).json({ ok: results.every(r => r.ok), results, skippedMobile });
      }
      if (mode === "ip_del") {
        if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST" });
        const ids = (Array.isArray(body.ids) ? body.ids : String(body.ids || "").split(",")).map(x => String(x).trim()).filter(x => /^\d+$/.test(x)).slice(0, 50);
        if (!ids.length) return res.status(400).json({ ok: false, error: "ids" });
        await nv.del("/tool/ip-exclusions", "ipFilterIds=" + ids.join(","));
        await supabase.from("ad_change_log").insert({ advertiser_id: adv.id, actor: body.actor_name || "운영자", action: "IP 차단 해제", detail: `${ids.length}개 노출제한 해제`, visible_to_client: true });
        return res.status(200).json({ ok: true, removed: ids.length });
      }
      const list = await ipList(nv);
      return res.status(200).json({ ok: true, list: list.map(x => ({ ...x, mobile: MOBILE_CGNAT.test(x.ip) })), total: list.length, limit: 600 });
    }
    if (mode === "leads") {
      if (!UUID_RE.test(body.id || "") || !YMD_RE.test(body.ymd || "")) return res.status(400).json({ ok: false, error: "id/ymd" });
      const { error } = await supabase.from("ad_leads").upsert({ advertiser_id: body.id, ymd: body.ymd, leads: num(body.leads, 0), note: body.note || null, entered_by: "owner", updated_at: new Date().toISOString() }, { onConflict: "advertiser_id,ymd" });
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true });
    }
    if (mode === "log") {
      if (!UUID_RE.test(body.id || "") || !body.action) return res.status(400).json({ ok: false, error: "id/action" });
      const { error } = await supabase.from("ad_change_log").insert({ advertiser_id: body.id, actor: body.actor_name || "운영자", action: String(body.action).slice(0, 80), detail: body.detail ? String(body.detail).slice(0, 1000) : null, visible_to_client: body.visible_to_client !== false });
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true });
    }
    if (mode === "logs") {
      if (!UUID_RE.test(q.id || "")) return res.status(400).json({ ok: false, error: "id" });
      return res.status(200).json({ ok: true, logs: await logsList(q.id, false) });
    }
    return res.status(400).json({ ok: false, error: "unknown mode" });
  } catch (e) {
    console.error("[ad-hub]", mode, e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
