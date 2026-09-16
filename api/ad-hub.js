// 2026-09-16 — 광고 관리 허브 API (api/ad-hub.js)
// 여러 광고주의 네이버 검색광고 계정을 DB(ad_advertisers)로 관리하고, 성과 조회·접수 입력·변경 이력을 제공한다.
// 기존 ad-report.js(올데이) / yusol-ad.js(유솔) 와 독립 — 서로 영향 없음.
//
// 운영자(actor = 올잇 owner/admin uuid):
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
  };
}
const idsQs = (ids) => ids.map(i => `ids=${encodeURIComponent(i)}`).join("&");

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
  out.campaigns = camps.map(c => ({ id: c.nccCampaignId, name: c.name, status: c.status, dailyBudget: c.dailyBudget, userLock: c.userLock, ...(byId[c.nccCampaignId] || row({})) }))
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
  const all = await nv.get("/ncc/campaigns");
  const filt = adv.campaign_filter ? String(adv.campaign_filter).trim() : "";
  const camps = (Array.isArray(all) ? all : []).filter(c => !c.delFlag && (!filt || String(c.name || "").includes(filt)));
  const groups = [];
  for (const c of camps) {
    const gs = await nv.get("/ncc/adgroups", `nccCampaignId=${encodeURIComponent(c.nccCampaignId)}`);
    for (const g of (Array.isArray(gs) ? gs : [])) if (!g.delFlag) groups.push({ id: g.nccAdgroupId, name: g.name, campaign: c.name, bid: g.bidAmt, lock: g.userLock, status: g.status });
  }
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
async function logsList(advId, clientOnly) {
  let q = supabase.from("ad_change_log").select("id,at,actor,action,detail,visible_to_client").eq("advertiser_id", advId).order("at", { ascending: false }).limit(60);
  if (clientOnly) q = q.eq("visible_to_client", true);
  const { data } = await q; return data || [];
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
  return res.status(200).json({ ok: true, advertiser: client ? clientPub(adv) : pub(adv), since, until, ...live, leads, leadTotal, logs });
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
    // ----- 운영자 -----
    const gate = await assertAdmin(q.actor || body.actor);
    if (!gate.ok) return res.status(gate.code).json(gate);

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
