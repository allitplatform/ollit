// 2026-07-29 — 마케팅 조감 PC 전용 재설계. 사장님 요청: "모바일을 바탕으로 조금 더 풍부하게".
//   기존 PC 화면(MarketingScreen.jsx, 1547줄)은 그대로 보존 — 이 파일이 대신 쓰인다(AdminApp.jsx isPc 분기).
//   되돌리려면 AdminApp.jsx 에서 MarketingScreenPc → MarketingScreen 으로 한 줄만 바꾸면 됨.
//   구조: 모바일과 같은 카드 순서(⓪지금실시간 페이스미터 → 시간대 → 지역 → CPA판정 → 퍼널/매출)를 기본으로 하되,
//   PC 화면 폭을 활용해 ⑤광고가 만든 일감 · ⑥키워드별 성과 · ⑦키워드 검색 도구(전부 PC 전용 심화 기능,
//   모바일엔 공간 문제로 뺐던 것)를 그대로 붙였다. 계산 공식은 전부 기존 PC 파일의 useMemo를 그대로 복사
//   (숫자가 어긋나면 안 되므로) — 지역 랭킹만 모바일과 동일하게 "오늘 + 올데이케어(자체) 원청 전체"로 통일.
//   목표/한계(25,000/35,300원)도 모바일·ads-console.html과 동일한 고정값으로 통일.

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { todayYmd, toKstYmd } from "../../utils/dateLabel.js";
import { listInquiries } from "../../lib/inquiriesDb.js";
import { parseRegion } from "../../utils/regionParser.js";
import { computeRevenueByYmRange } from "../../utils/revenueStats.js";
import { canSeeField } from "../../data/permissions.js";

const SELF_PRINCIPAL_CODE = "allday";
const ADC_TOKEN = "82ae0c34ae8eeec0f6932b82"; // 대표용 읽기전용 — api/ad-console.js (시간대 흐름 전용)
const GOAL_CPA = 25000, LIMIT_CPA = 35300; // 앱 전체 공통 눈금 (모바일·ads-console.html과 동일, 7/28 확정)
const PERIOD_OPTS = [
  { id: "today", label: "오늘" },
  { id: "week",  label: "이번주" },
  { id: "month", label: "이번달" },
];

function _startOfWeekMonYmd() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function _startOfMonthYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function _rangeForPeriod(period) {
  const today = todayYmd();
  if (period === "today") return { start: today, end: today };
  if (period === "week")  return { start: _startOfWeekMonYmd(), end: today };
  if (period === "month") return { start: _startOfMonthYmd(), end: today };
  return { start: today, end: today };
}
function _kwClass(word) {
  const w = String(word || "");
  if (/셀프|DIY|필터청소|필터 청소|곰팡이제거|청소방법|청소가격|청소비용/.test(w)) return "noise";
  return "work";
}
function _fmtKRW(n) { return Number(n || 0).toLocaleString("ko-KR"); }
function _pctText(num, den) { if (!den) return "0.0%"; return ((num / den) * 100).toFixed(1) + "%"; }
function _statusColor(v, goal) {
  if (v == null) return "#94A3B8";
  if (v <= goal * 0.6) return "#16A34A";
  if (v <= goal) return "#D97706";
  return "#DC2626";
}

export function MarketingScreenPc({ t, apiTasks = [], user, onBack }) {
  const [period, setPeriod] = useState("month");
  const [showDailyTable, setShowDailyTable] = useState(false);
  const [showKwTable, setShowKwTable] = useState(false);
  const [kwShowAll, setKwShowAll] = useState(false);
  const [openTool, setOpenTool] = useState(false);

  // ⑦ 검색량 조회
  const [seeds, setSeeds] = useState("에어컨청소,에어컨세척,에어컨가스충전,벽걸이에어컨청소,시스템에어컨청소");
  const [tool, setTool] = useState(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [toolError, setToolError] = useState("");
  const [toolOnlyMissing, setToolOnlyMissing] = useState(true);
  const [toolWorkOnly, setToolWorkOnly] = useState(true);
  const [toolShowAll, setToolShowAll] = useState(false);

  const [allInquiries, setAllInquiries] = useState([]);
  const [homepageTaskIds, setHomepageTaskIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const actorId = user?.user_id || user?.id;
    if (!actorId) {
      setAllInquiries([]);
      setHomepageTaskIds(new Set());
      setLoading(false);
      return () => { alive = false; };
    }
    listInquiries(actorId, null).then(rows => {
      if (!alive) return;
      const list = rows || [];
      setAllInquiries(list);
      const ids = new Set();
      for (const r of list) {
        if (r.status === "converted" && r.task_id) ids.add(String(r.task_id));
      }
      setHomepageTaskIds(ids);
      setLoading(false);
    }).catch(e => {
      if (!alive) return;
      setError(String(e?.message || e));
      setAllInquiries([]);
      setHomepageTaskIds(new Set());
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user?.user_id, user?.id]);

  const { start, end } = useMemo(() => _rangeForPeriod(period), [period]);

  // ── ① 접수 퍼널 ──────────────────────────────────────────────
  const funnel = useMemo(() => {
    const inRange = (allInquiries || []).filter(x => {
      const c = x.created_at || x.createdAt;
      if (!c) return false;
      const k = toKstYmd(c);
      return k && k >= start && k <= end;
    });
    const total = inRange.length;
    const spam = inRange.filter(x => x.status === "spam").length;
    const converted = inRange.filter(x => x.status === "converted" && x.task_id);
    const taskById = new Map();
    for (const t2 of (apiTasks || [])) { if (t2 && t2.id) taskById.set(String(t2.id), t2); }
    let completed = 0, canceled = 0;
    for (const cv of converted) {
      const tk = taskById.get(String(cv.task_id));
      if (!tk) continue;
      const st = tk.status || "";
      if (st === "취소") { canceled += 1; continue; }
      if (st === "완료" || tk.completedAt || tk.completed_at) completed += 1;
    }
    return { total, spam, valid: converted.length, completed, canceled };
  }, [allInquiries, apiTasks, start, end]);

  // ── ② 완료 매출·회사이익 ────────────────────────────────────
  const revenue = useMemo(() => {
    if (!canSeeField(user, "task.total_amount")) return null;
    const filtered = (apiTasks || []).filter(t2 => t2 && t2.id && homepageTaskIds.has(String(t2.id)));
    return computeRevenueByYmRange(filtered, start, end, user);
  }, [apiTasks, homepageTaskIds, start, end, user]);

  const selfTasks = useMemo(() => (apiTasks || []).filter(t2 => {
    if (!t2) return false;
    const code = t2.principalCode || t2.principal_code || "";
    return code === SELF_PRINCIPAL_CODE;
  }), [apiTasks]);

  const selfRevenue = useMemo(() => {
    if (!canSeeField(user, "task.total_amount")) return null;
    return computeRevenueByYmRange(selfTasks, start, end, user);
  }, [selfTasks, start, end, user]);

  // ── 📍 지역 랭킹 (2026-07-29 — 모바일과 동일 기준: "오늘" + 올데이케어(자체) 원청 접수 전체) ──
  const regionTop = useMemo(() => {
    const todayK = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const tasksInRange = (apiTasks || []).filter(x => {
      if (!x || x.status === "취소") return false;
      const code = x.principalCode || x.principal_code || "";
      if (code !== SELF_PRINCIPAL_CODE) return false;
      const c = x.createdAt || x.created_at || x.receivedAt || x.received_at;
      if (!c) return false;
      const k = toKstYmd(c);
      return k === todayK;
    });
    const map = new Map();
    let unknown = 0;
    for (const tk of tasksInRange) {
      const addr = tk.address || tk.fullAddress || tk.주소 || "";
      const { key, label } = parseRegion(addr);
      if (key === "미상") { unknown += 1; continue; }
      if (!map.has(key)) map.set(key, { key, label, count: 0 });
      map.get(key).count += 1;
    }
    const sorted = [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return { rows: sorted, unknown, grandTotal: tasksInRange.length };
  }, [apiTasks]);

  const cancelRate = funnel.valid > 0 ? _pctText(funnel.canceled, funnel.valid) : "-";
  const spamRate = funnel.total > 0 ? _pctText(funnel.spam, funnel.total) : "-";

  // ── ④ 네이버 검색광고 (기간 필터 적용) ──────────────────────
  const [ad, setAd] = useState(null);
  const [adLoading, setAdLoading] = useState(false);
  const [adError, setAdError] = useState("");

  useEffect(() => {
    let alive = true;
    const actorId = user?.user_id || user?.id;
    if (!actorId) { setAd(null); return () => { alive = false; }; }
    setAdLoading(true);
    setAdError("");
    fetch(`/api/ad-report?since=${encodeURIComponent(start)}&until=${encodeURIComponent(end)}&actor=${encodeURIComponent(actorId)}&daily=1&keywords=1`)
      .then(r => r.json())
      .then(j => { if (!alive) return; setAd(j || null); setAdLoading(false); })
      .catch(e => { if (!alive) return; setAdError(String(e?.message || e)); setAd(null); setAdLoading(false); });
    return () => { alive = false; };
  }, [user?.user_id, user?.id, start, end]);

  // ── ⓪ 지금 실시간 (항상 오늘, 5분 갱신, 페이스미터 디자인 — 모바일과 동일) ──
  // 2026-07-29 — 카드가 통째로 사라지는 문제 진단용: loading/error 상태를 따로 잡아
  //   "왜 안 뜨는지" 화면에 그대로 보이게 함 (예전엔 liveAd 실패 시 조용히 카드 자체가 없어졌음).
  const [liveAd, setLiveAd] = useState(null);
  const [liveAdLoading, setLiveAdLoading] = useState(true);
  const [liveAdError, setLiveAdError] = useState("");
  useEffect(() => {
    let alive = true;
    const actorId = user?.user_id || user?.id;
    if (!actorId) { setLiveAdLoading(false); setLiveAdError("로그인 정보 없음(actorId 없음)"); return () => { alive = false; }; }
    const load = () => {
      setLiveAdLoading(true);
      const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      fetch(`/api/ad-report?since=${today}&until=${today}&actor=${encodeURIComponent(actorId)}&live=1`)
        .then(r => r.json())
        .then(j => {
          if (!alive) return;
          if (j && j.ok) { setLiveAd(j); setLiveAdError(""); }
          else { setLiveAd(null); setLiveAdError(String(j?.error || "API 응답에 ok:true 없음")); }
          setLiveAdLoading(false);
        })
        .catch(e => { if (!alive) return; setLiveAd(null); setLiveAdError(String(e?.message || e)); setLiveAdLoading(false); });
    };
    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(iv); };
  }, [user?.user_id, user?.id]);

  const liveView = useMemo(() => {
    if (!liveAd) return null;
    const rawCost = liveAd.live?.spendRealtime != null
      ? Math.max(Number(liveAd.live.spendRealtime), Number(liveAd.cost || 0))
      : Number(liveAd.cost || 0);
    const costVat = Math.round(rawCost * 1.1);
    const jobs = liveAd.live?.jobsToday ?? null;
    const per = jobs > 0 ? Math.round(costVat / jobs) : null;
    let verdict;
    if (per != null && per <= GOAL_CPA)        verdict = { label: "적정",          color: "#16A34A" };
    else if (per != null && per <= LIMIT_CPA)  verdict = { label: "주의",          color: "#D97706" };
    else if (per != null)                      verdict = { label: "적자선 초과",   color: "#DC2626" };
    else if (costVat >= GOAL_CPA)              verdict = { label: "접수 0 — 확인", color: "#DC2626" };
    else                                       verdict = { label: "집계중",        color: "#94A3B8" };
    const lr = liveAd.live?.lastRun;
    const lrMin = lr ? Math.round((Date.now() - new Date(lr.at).getTime()) / 60000) : null;
    const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
    const kstH = kstNow.getUTCHours() + kstNow.getUTCMinutes() / 60;
    const ran = Math.min(Math.max(kstH - 8, 0.25), 12);
    const proj = kstH < 20 ? Math.round(costVat * 12 / ran) : costVat;
    return { costVat, jobs, per, verdict, lrMin, lrWatched: lr?.watched, proj };
  }, [liveAd]);

  // ── 🕐 시간대별 (별도 소스 — api/ad-console trend, 오늘 전용) ──
  const [hourTrend, setHourTrend] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch(`/api/ad-console?token=${ADC_TOKEN}&trend=1`, { cache: "no-store" })
        .then(r => r.json())
        .then(j => { if (alive) setHourTrend(j || null); })
        .catch(() => { if (alive) setHourTrend(null); });
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const hourRows = useMemo(() => {
    if (!hourTrend?.jobsH) return [];
    const cum = new Array(24).fill(null);
    (hourTrend.spend || []).forEach(p => {
      const k = new Date(new Date(p.at).getTime() + 9 * 3600e3);
      cum[k.getUTCHours()] = Math.round(p.won * 1.1);
    });
    const nowH = new Date(Date.now() + 9 * 3600e3).getUTCHours();
    let carry = null;
    const cf = cum.map(v => { if (v != null) carry = v; return carry; });
    const rows = []; let prev = 0;
    for (let h = 0; h <= nowH; h++) {
      const c = cf[h], jb = (hourTrend.jobsH[h] || 0), yb = ((hourTrend.jobsHY || [])[h] || 0);
      if (c == null) { if (jb || yb) rows.push({ h, won: null, jb, yb }); continue; }
      const won = Math.max(0, c - prev); prev = c;
      rows.push({ h, won, jb, yb });
    }
    return rows;
  }, [hourTrend]);
  const maxHourWon = Math.max(1, ...hourRows.map(r => r.won || 0));

  const adCostVat = ad?.ok ? Math.round(Number(ad.cost || 0) * 1.1) : 0;
  const selfCount = selfRevenue?.count || 0;
  const cpaVat = ad?.ok && selfCount > 0 ? Math.round(adCostVat / selfCount) : null;
  const profitPerJob = selfRevenue && selfCount > 0 ? Math.round(Number(selfRevenue.owner || 0) / selfCount) : null;
  const cpaVerdictColor = (cpaVat != null && profitPerJob != null) ? (cpaVat < profitPerJob ? "#16A34A" : "#DC2626") : null;
  const breakEvenJobs = (profitPerJob != null && profitPerJob > 0 && adCostVat > 0) ? Math.ceil(adCostVat / profitPerJob) : null;

  // ── ⑤ 일별 광고비 vs 자체유입 ────────────────────────────────
  const daily = useMemo(() => {
    const adDays = new Map();
    for (const d of (ad?.days || [])) { if (d && d.ymd) adDays.set(String(d.ymd), d); }
    const canMoney = canSeeField(user, "task.total_amount");
    const rows = [];
    const cur = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (cur <= last && rows.length < 200) {
      const ymd = cur.toISOString().slice(0, 10);
      const a = adDays.get(ymd);
      let received = 0;
      for (const x of selfTasks) {
        const c = x.createdAt || x.created_at || x.receivedAt || x.received_at;
        if (c && toKstYmd(c) === ymd) received += 1;
      }
      const rv = canMoney ? computeRevenueByYmRange(selfTasks, ymd, ymd, user) : null;
      rows.push({
        ymd,
        cost: a ? Math.round(Number(a.cost || 0) * 1.1) : 0,
        clicks: a ? Number(a.clicks || 0) : 0,
        impressions: a ? Number(a.impressions || 0) : 0,
        received,
        done: rv?.count || 0,
        owner: Number(rv?.owner || 0),
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    const totalCost = rows.reduce((sum, r) => sum + r.cost, 0);
    if (rows.length < 5 || totalCost <= 0) return { rows, baseline: null };
    const sorted = [...rows].sort((a, b) => a.cost - b.cost);
    const k = Math.max(3, Math.floor(rows.length / 3));
    const lowDays = sorted.slice(0, k);
    const baseline = lowDays.reduce((sum, r) => sum + r.received, 0) / k;
    const totalReceived = rows.reduce((sum, r) => sum + r.received, 0);
    const adDrivenRecv = rows.reduce((sum, r) => sum + Math.max(0, r.received - baseline), 0);
    const convRate = totalReceived > 0 ? (selfCount / totalReceived) : 0;
    const adDrivenDone = Math.round(adDrivenRecv * convRate);
    return {
      rows, baseline, lowDayCount: k,
      lowDayAvgCost: Math.round(lowDays.reduce((sum, r) => sum + r.cost, 0) / k),
      totalReceived, adDrivenRecv: Math.round(adDrivenRecv), convRate, adDrivenDone,
    };
  }, [ad, selfTasks, start, end, user, selfCount]);

  const adProfit = (profitPerJob != null && daily.adDrivenDone != null) ? daily.adDrivenDone * profitPerJob : null;
  const adNet = adProfit != null ? adProfit - adCostVat : null;

  // ── ⑥ 키워드별 성과 ────────────────────────────────────────
  const kw = useMemo(() => {
    const meta = ad?.keywordMeta || null;
    const rows = (ad?.keywords || []).map(k => ({
      ...k,
      costVat: Math.round(Number(k.cost || 0) * 1.1),
      ctr: k.impressions > 0 ? (k.clicks / k.impressions) : 0,
      cpc: k.clicks > 0 ? Math.round(Number(k.cost || 0) * 1.1 / k.clicks) : 0,
    }));
    if (rows.length === 0) return { rows: [], avgRank: null, meta };
    let impSum = 0, rankSum = 0;
    for (const r of rows) { if (r.impressions > 0 && r.avgRnk > 0) { impSum += r.impressions; rankSum += r.avgRnk * r.impressions; } }
    const avgRank = impSum > 0 ? (rankSum / impSum) : null;
    return { rows, avgRank, meta };
  }, [ad]);
  const kwLiveRate = (kw.meta && kw.meta.total > 0) ? (kw.meta.live / kw.meta.total) : null;

  const convFactor = useMemo(() => {
    const naverConv = (ad?.adGroups || []).reduce((sum, g) => sum + Number(g.conv || 0), 0);
    if (naverConv <= 0) return null;
    if (daily.adDrivenDone == null || daily.adDrivenDone <= 0) return null;
    const f = daily.adDrivenDone / naverConv;
    return f > 1.05 ? { f, naverConv, real: daily.adDrivenDone } : null;
  }, [ad, daily]);

  const liveRank = useMemo(() => {
    let impSum = 0, rankSum = 0, n = 0;
    for (const g of (ad?.adGroups || [])) {
      const imp = Number(g.impressions || 0), rk = Number(g.avgRnk || 0);
      if (imp > 0 && rk > 0) { impSum += imp; rankSum += rk * imp; n += 1; }
    }
    return impSum > 0 ? { rank: rankSum / impSum, groups: n } : null;
  }, [ad]);

  const groups = useMemo(() => {
    let tClk = 0, tConv = 0;
    for (const g of (ad?.adGroups || [])) { tClk += Number(g.clicks || 0); tConv += Number(g.conv || 0); }
    const needClicks = tConv > 0 ? Math.max(20, Math.ceil((tClk / tConv) * 2)) : 20;
    const rows = (ad?.adGroups || []).map(g => {
      const costVat = Math.round(Number(g.cost || 0) * 1.1);
      const conv = Number(g.conv || 0);
      const convAdj = convFactor ? conv * convFactor.f : conv;
      const cpaRaw = conv > 0 ? Math.round(costVat / conv) : null;
      const cpa = convAdj > 0 ? Math.round(costVat / convAdj) : null;
      let status;
      if (costVat < 10000 && g.impressions < 100) {
        status = { key: "dead", label: "안 돌아감", color: "#94A3B8" };
      } else if (cpa == null) {
        status = Number(g.clicks || 0) < needClicks
          ? { key: "few", label: "아직 모름", color: "#94A3B8" }
          : { key: "noconv", label: "전환 없음", color: "#DC2626" };
      } else if (profitPerJob != null && cpa > profitPerJob) {
        status = { key: "over", label: "비쌈", color: "#DC2626" };
      } else if (profitPerJob != null && cpa < profitPerJob * 0.5) {
        status = { key: "cheap", label: "더 써도 됨", color: "#16A34A" };
      } else {
        status = { key: "ok", label: "적정", color: "#D97706" };
      }
      return { ...g, costVat, conv, cpa, cpaRaw, status };
    });
    const totalCost = rows.reduce((a, b) => a + b.costVat, 0);
    return { rows, totalCost, needClicks };
  }, [ad, profitPerJob, convFactor]);

  const groupConcentration = useMemo(() => {
    const rows = groups.rows;
    if (rows.length === 0 || groups.totalCost <= 0) return null;
    let acc = 0, n = 0;
    for (const r of [...rows].sort((a, b) => b.costVat - a.costVat)) { acc += r.costVat; n += 1; if (acc >= groups.totalCost * 0.9) break; }
    return { n, total: rows.length, pct: Math.round((acc / groups.totalCost) * 100) };
  }, [groups]);

  const kwVerdict = (() => {
    const r = (liveRank && liveRank.rank) != null ? liveRank.rank : kw.avgRank;
    const deadN = (kw.meta && kw.meta.dead > 0) ? kw.meta.dead : 0;
    if (r == null) {
      if (kwLiveRate != null && kwLiveRate < 0.5 && deadN > 0) {
        return {
          color: "#DC2626",
          head: `조사한 키워드 ${_fmtKRW(kw.meta.total)}개 중 ${_fmtKRW(deadN)}개가 한 번도 안 떴습니다`,
          body: "노출이 아예 없어 원인을 가릴 수 없습니다. 광고그룹이 켜져 있는지, 예산이 걸려 있는지부터 확인하세요.",
        };
      }
      return null;
    }
    if (r <= 2.5) {
      const minBidMost = kw.meta && kw.meta.deadMinBidPct > 0.6;
      return {
        color: "#2563EB",
        head: `입찰가는 잘 맞춰져 있습니다 (뜨는 광고 평균 ${r.toFixed(1)}위)`,
        body: "지금 나가고 있는 광고는 전부 검색 결과 맨 위 1~2번째 자리에 붙어 있습니다. 입찰가를 더 올려도 올라갈 자리가 없습니다."
            + (deadN > 0
                ? ` 안 뜨는 키워드 ${_fmtKRW(deadN)}개는 입찰가 문제가 아닙니다`
                  + (minBidMost ? " — 최저가로도 1~2위가 나오는 걸 보면 경쟁자 자체가 없습니다" : "")
                  + ". 그 단어를 검색하는 사람이 없어서입니다."
                : "")
            + " 예산이 남는 이유가 이것입니다. 돈을 더 쓰려면 검색량이 있는 새 키워드를 찾거나 다른 채널로 넓혀야 합니다.",
      };
    }
    if (r <= 3.5) {
      return {
        color: "#D97706",
        head: `조금 밀려 있습니다 (뜨는 광고 평균 ${r.toFixed(1)}위)`,
        body: "돈 되는 그룹의 입찰가를 올리면 노출이 늘고 예산도 더 쓸 수 있습니다. 아래 표에서 광고비 큰 것부터 손보세요.",
      };
    }
    return {
      color: "#DC2626",
      head: `많이 밀려 있습니다 (뜨는 광고 평균 ${r.toFixed(1)}위)`,
      body: "순위가 낮아 노출 기회를 놓치고 있습니다. 입찰가 올리는 것이 가장 먼저 할 일입니다."
          + (deadN > 0 ? ` 안 뜨는 키워드 ${_fmtKRW(deadN)}개도 같은 원인일 가능성이 큽니다.` : ""),
    };
  })();

  // ⑦ 검색량 조회
  const runKeywordTool = () => {
    const actorId = user?.user_id || user?.id;
    if (!actorId) { setToolError("로그인 정보 없음"); return; }
    const list = seeds.split(",").map(x => x.trim()).filter(Boolean);
    if (list.length === 0) { setToolError("씨앗 단어를 하나 이상 넣으세요"); return; }
    setToolLoading(true); setToolError(""); setToolShowAll(false);
    fetch(`/api/ad-report?since=${encodeURIComponent(start)}&until=${encodeURIComponent(end)}`
        + `&actor=${encodeURIComponent(actorId)}&tool=1&seeds=${encodeURIComponent(list.join(","))}`)
      .then(r => r.json())
      .then(j => {
        if (j && j.ok && j.tool) { setTool(j.tool); }
        else { setTool(null); setToolError(String(j?.error || "조회 실패")); }
        setToolLoading(false);
      })
      .catch(e => { setTool(null); setToolError(String(e?.message || e)); setToolLoading(false); });
  };
  const toolRows = useMemo(() => {
    const all = (tool?.rows || []).map(r => ({ ...r, cls: _kwClass(r.keyword) }));
    const work = all.filter(r => r.cls === "work");
    const workMissing = work.filter(r => !r.registered);
    const head = { count: workMissing.length, vol: workMissing.reduce((a, b) => a + Number(b.total || 0), 0), noise: all.length - work.length };
    let f = toolWorkOnly ? work : all;
    if (toolOnlyMissing) f = f.filter(r => !r.registered);
    return { all, filtered: f, view: toolShowAll ? f : f.slice(0, 40), head };
  }, [tool, toolOnlyMissing, toolWorkOnly, toolShowAll]);

  const groupsSorted = useMemo(() => [...groups.rows].sort((a, b) => b.costVat - a.costVat), [groups]);
  const kwSorted = useMemo(() => [...kw.rows].sort((a, b) => b.costVat - a.costVat), [kw]);
  const kwView = kwShowAll ? kwSorted : kwSorted.slice(0, 40);

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Pretendard', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 24px", borderBottom: `1px solid ${t.border}`, background: t.bgElevated, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex", alignItems: "center" }} aria-label="뒤로">
          <ArrowLeft size={20}/>
        </button>
        <div style={{ fontSize: 18, fontWeight: 800 }}>📈 마케팅</div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 24px 60px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ⓪ 지금 실시간 — 페이스미터. liveView 가 null 이어도 카드 자체는 항상 보이게(원인 진단용). */}
        {!liveView && (
          <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 16, padding: "14px 22px", fontSize: 12.5, color: t.textMuted, fontWeight: 700 }}>
            🔴 지금 실시간 — {liveAdLoading ? "불러오는 중…" : `데이터 없음 (${liveAdError || "원인 미상"})`}
          </div>
        )}
        {liveView && (
          <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 16, padding: "18px 22px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>🔴 지금 실시간</span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: liveView.verdict.color, background: `${liveView.verdict.color}1F`, borderRadius: 999, padding: "3px 12px" }}>{liveView.verdict.label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 28, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.1 }}>
                  {liveView.per != null ? _fmtKRW(liveView.per) : "-"}
                  <span style={{ fontSize: 15, color: t.textMuted, fontWeight: 700, marginLeft: 4 }}>원/건</span>
                </div>
                <div style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600, marginTop: 4 }}>
                  오늘 {_fmtKRW(liveView.costVat)}원 써서 {liveView.jobs ?? "?"}건 접수
                  {liveView.lrMin != null && ` · 자동입찰 ${liveView.lrMin < 1 ? "방금" : `${liveView.lrMin}분 전`} 실행`}
                </div>
              </div>
              <div style={{ flex: "1 1 320px", minWidth: 280 }}>
                <div style={{ position: "relative", height: 22, background: t.bgInset || "rgba(148,163,184,.15)", borderRadius: 8, marginBottom: 6 }}>
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: `${liveView.per != null ? Math.min(100, liveView.per / LIMIT_CPA * 100) : 0}%`,
                    background: "linear-gradient(90deg, #F4A73A, " + liveView.verdict.color + ")",
                    borderRadius: 8, transition: "width .3s",
                  }}/>
                  <div style={{ position: "absolute", top: -4, bottom: -4, width: 2, left: `${GOAL_CPA / LIMIT_CPA * 100}%`, background: t.text }}/>
                  <div style={{ position: "absolute", top: -16, left: `${GOAL_CPA / LIMIT_CPA * 100}%`, transform: "translateX(-50%)", fontSize: 9.5, fontWeight: 800, color: t.text, whiteSpace: "nowrap" }}>목표 {_fmtKRW(GOAL_CPA)}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: t.textMuted, fontWeight: 700 }}>
                  <span>0원</span><span>한계 {_fmtKRW(LIMIT_CPA)}원</span>
                </div>
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginTop: 8 }}>
                  {liveView.per != null && liveView.jobs > 0
                    ? `📈 이 속도면 오늘 마감쯤 약 ${_fmtKRW(liveView.proj)}원 · 감시 ${_fmtKRW(liveView.lrWatched || 0)}개`
                    : (liveView.lrMin != null ? `감시 ${_fmtKRW(liveView.lrWatched || 0)}개` : "⚪ 자동입찰 기록 없음")}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🕐 시간대별 지출·접수 — 막대그래프 (PC: 세로 바 차트) */}
        {hourRows.length > 0 && (
          <Card t={t} title="🕐 시각별 지출 · 접수" sub="막대 위 숫자=접수건수 · 건당 2.5만↓ 초록 · 3.53만↑ 빨강(적자선) · 항상 오늘">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 130, marginTop: 4 }}>
              {hourRows.map(r => {
                const p = (r.won && r.jb) ? Math.round(r.won / r.jb) : null;
                const barH = Math.max(3, Math.round((r.won || 0) / maxHourWon * 104));
                const col = p != null ? _statusColor(p, GOAL_CPA) : (t.bgInset || "rgba(148,163,184,.25)");
                return (
                  <div key={r.h} title={`${r.h}시 · ${r.won == null ? "-" : _fmtKRW(r.won) + "원"} · ${r.jb}건`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: p != null ? col : t.textMuted }}>{r.jb || ""}</span>
                    <div style={{ width: "100%", height: barH, background: col, borderRadius: 3 }}/>
                    <span style={{ fontSize: 8.5, color: t.textMuted, fontWeight: 700 }}>{r.h}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* 📍 오늘 지역 랭킹  +  ① 퍼널 · ② 매출 (2열) */}
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16, alignItems: "start" }}>
          <Card t={t} title="📍 오늘 지역 랭킹" sub="오늘 올데이케어(자체) 원청 접수 전체 · 기간 필터와 무관">
            {regionTop.rows.length === 0 ? (
              <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>오늘 데이터 없음</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
                  {[0, 1].map(colIdx => {
                    const half = Math.ceil(regionTop.rows.length / 2);
                    const slice = regionTop.rows.slice(colIdx * half, colIdx * half + half);
                    const maxRegion = Math.max(1, ...regionTop.rows.map(r => r.count));
                    return (
                      <div key={colIdx}>
                        {slice.map((r, i) => {
                          const idx = colIdx * half + i;
                          const pct = (r.count / maxRegion) * 100;
                          return (
                            <div key={r.key} style={{ marginBottom: 8 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: idx === 0 ? t.accent : t.textMuted }}>{idx + 1}</span>
                                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: t.text }}>{r.label}</span>
                                <span className="mono" style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: t.text }}>{r.count}건</span>
                              </div>
                              <div style={{ height: 12, borderRadius: 5, background: t.bgInset || "rgba(148,163,184,.12)", overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: t.accent, borderRadius: 5, minWidth: r.count > 0 ? 4 : 0 }}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 4, paddingTop: 6, borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", fontSize: 10.5, color: t.textMuted, fontWeight: 700 }}>
                  <span>주소 미상 {regionTop.unknown}건</span>
                  <span>오늘 합계 {regionTop.grandTotal}건</span>
                </div>
              </>
            )}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card t={t} title="① 홈페이지 접수 퍼널" sub="기간: 접수(inquiry.created_at) 기준">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                <MiniStat t={t} label="총 접수" value={funnel.total} accent/>
                <MiniStat t={t} label="유효" value={funnel.valid}/>
                <MiniStat t={t} label="완료" value={funnel.completed} sub={funnel.valid > 0 ? _pctText(funnel.completed, funnel.valid) : null}/>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: t.textMuted, fontWeight: 700, marginTop: 10 }}>
                <span>스팸률 {spamRate} ({funnel.spam}건)</span>
                <span>취소율 {cancelRate} ({funnel.canceled}건)</span>
              </div>
            </Card>
            {loading ? (
              <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>불러오는 중…</div>
            ) : revenue && (
              <Card t={t} title="② 완료 매출 · 회사이익" sub="기간: 완료(completed_at) 기준 · 홈페이지 유입만">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  <MiniStat t={t} label="완료 건수" value={revenue.count}/>
                  <MiniStat t={t} label="완료 매출" value={_fmtKRW(revenue.total)} suffix="원" accent/>
                  <MiniStat t={t} label="회사 이익" value={_fmtKRW(revenue.owner)} suffix="원" highlight={revenue.owner > 0 ? "#16A34A" : (revenue.owner < 0 ? "#DC2626" : null)}/>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* 기간 필터 (아래 광고 성과 블록에 적용) */}
        <div style={{ display: "flex", gap: 8 }}>
          {PERIOD_OPTS.map(opt => {
            const on = period === opt.id;
            return (
              <button key={opt.id} onClick={() => setPeriod(opt.id)} style={{
                padding: "7px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${on ? t.accent : t.border}`, background: on ? `${t.accent}1F` : "transparent", color: on ? t.accent : t.textMuted,
              }}>{opt.label}</button>
            );
          })}
        </div>

        {/* 💰 광고 CPA 판정 */}
        <Card t={t} title="💰 광고 CPA 판정" sub={`분모: 자체유입(전화포함) 완료 ${selfCount}건 · 기간: ${PERIOD_OPTS.find(o => o.id === period)?.label}`}>
          {adLoading ? (
            <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>조회 중…</div>
          ) : (adError || !ad || ad.ok === false) ? (
            <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>광고 API 조회 실패</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 700 }}>광고비 {_fmtKRW(adCostVat)}원 ÷ CPA</span>
                <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: cpaVerdictColor || t.text }}>
                  {cpaVat != null ? _fmtKRW(cpaVat) + "원" : "-"}
                </span>
              </div>
              {(cpaVat != null && profitPerJob != null) && (
                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: cpaVerdictColor, textAlign: "right" }}>
                  {cpaVat < profitPerJob ? `✓ 남는 장사 (건당 +${_fmtKRW(profitPerJob - cpaVat)}원)` : `✗ 적자 (건당 −${_fmtKRW(cpaVat - profitPerJob)}원)`}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8, fontSize: 11.5, color: t.textMuted, fontWeight: 600 }}>
                {breakEvenJobs != null && <span>손익분기 {_fmtKRW(breakEvenJobs)}건 이상 광고유입이면 본전</span>}
                {groupConcentration && <span>상위 {groupConcentration.n}개 그룹이 광고비 {groupConcentration.pct}% 사용 (전체 {groupConcentration.total}개 중)</span>}
              </div>

              {kwVerdict && (
                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, borderLeft: `3px solid ${kwVerdict.color}`, background: `${kwVerdict.color}12` }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: kwVerdict.color, marginBottom: 3 }}>{kwVerdict.head}</div>
                  <div style={{ fontSize: 11.5, color: t.textSecondary, fontWeight: 600, lineHeight: 1.5 }}>{kwVerdict.body}</div>
                </div>
              )}

              {groupsSorted.length > 0 && (
                <div style={{ marginTop: 14, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${t.border}`, color: t.textMuted, fontWeight: 800, fontSize: 10.5 }}>
                        <td style={{ padding: "5px 6px", textAlign: "left" }}>그룹</td>
                        <td style={{ padding: "5px 6px", textAlign: "right" }}>광고비</td>
                        <td style={{ padding: "5px 6px", textAlign: "right" }}>전환</td>
                        <td style={{ padding: "5px 6px", textAlign: "right" }}>CPA</td>
                        <td style={{ padding: "5px 6px", textAlign: "center" }}>판정</td>
                      </tr>
                    </thead>
                    <tbody>
                      {groupsSorted.map(g => (
                        <tr key={g.id || g.name} style={{ borderBottom: `1px solid ${t.border}` }}>
                          <td style={{ padding: "6px", fontWeight: 700, color: t.text, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</td>
                          <td className="mono" style={{ padding: "6px", textAlign: "right", color: t.textMuted }}>{_fmtKRW(g.costVat)}원</td>
                          <td className="mono" style={{ padding: "6px", textAlign: "right", color: t.textMuted }}>{g.conv}</td>
                          <td className="mono" style={{ padding: "6px", textAlign: "right", fontWeight: 800, color: t.text }}>{g.cpa != null ? _fmtKRW(g.cpa) + "원" : "-"}</td>
                          <td style={{ padding: "6px", textAlign: "center" }}>
                            <span style={{ padding: "2px 8px", borderRadius: 999, background: `${g.status.color}22`, color: g.status.color, fontSize: 10, fontWeight: 900, whiteSpace: "nowrap" }}>{g.status.label}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 6 }}>
                    ⓘ 클릭 {groups.needClicks}회 미만인 그룹은 "아직 모름"으로 판정 보류 (통계적으로 의미 없음)
                    {convFactor && ` · 네이버 집계 전환에 ×${convFactor.f.toFixed(2)} 보정 적용(실제 완료 ${convFactor.real}건 vs 네이버 ${convFactor.naverConv}건)`}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* ⑤ 광고가 만든 일감 */}
        <Card t={t} title="📈 광고가 만든 일감" sub="자연유입 기준선(광고비 적은 날 평균) 대비 초과분을 광고 기여로 추정">
          {daily.baseline == null ? (
            <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>데이터 부족(5일 미만) — 기준선 계산 안 됨</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
                <MiniStat t={t} label="자연유입 기준선" value={daily.baseline.toFixed(1)} suffix="건/일"/>
                <MiniStat t={t} label="광고유입 추정" value={_fmtKRW(daily.adDrivenRecv)} suffix="건"/>
                <MiniStat t={t} label="광고완료 환산" value={_fmtKRW(daily.adDrivenDone)} suffix="건" accent/>
                <MiniStat t={t} label="광고가 만든 이익" value={adProfit != null ? _fmtKRW(adProfit) : "-"} suffix="원"/>
                <MiniStat t={t} label="순이익(이익−광고비)" value={adNet != null ? _fmtKRW(adNet) : "-"} suffix="원" highlight={adNet != null ? (adNet > 0 ? "#16A34A" : "#DC2626") : null}/>
              </div>
              <button onClick={() => setShowDailyTable(v => !v)} style={{
                width: "100%", marginTop: 12, padding: "8px 10px", background: t.bgInset || "rgba(148,163,184,.06)", border: `1px solid ${t.border}`,
                borderRadius: 8, color: t.textMuted, fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}>
                일별 상세 {showDailyTable ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
              </button>
              {showDailyTable && (
                <div style={{ marginTop: 8, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${t.border}`, color: t.textMuted, fontWeight: 800, fontSize: 10 }}>
                        <td style={{ padding: "4px 6px", textAlign: "left" }}>날짜</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>광고비</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>클릭</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>접수</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>완료</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>회사이익</td>
                      </tr>
                    </thead>
                    <tbody>
                      {daily.rows.map(r => (
                        <tr key={r.ymd} style={{ borderBottom: `1px solid ${t.border}` }}>
                          <td style={{ padding: "4px 6px", color: t.text }}>{r.ymd}</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", color: t.textMuted }}>{_fmtKRW(r.cost)}</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", color: t.textMuted }}>{r.clicks}</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", color: t.text }}>{r.received}</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", color: t.text }}>{r.done}</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", color: t.text }}>{_fmtKRW(r.owner)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>

        {/* ⑥ 키워드별 성과 */}
        <Card t={t} title="🔑 키워드별 성과" sub="avgRnk 낮을수록 상위 노출 · 노출 0 = 등록만 되고 실제로는 안 뜨는 키워드">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 11.5, color: t.textMuted, fontWeight: 600, marginBottom: 8 }}>
            <span>평균 노출순위 {kw.avgRank != null ? kw.avgRank.toFixed(1) + "위" : "-"}</span>
            {kwLiveRate != null && <span>노출된 키워드 비율 {_pctText(kw.meta.live, kw.meta.total)} ({kw.meta.live}/{kw.meta.total})</span>}
          </div>
          {kwSorted.length === 0 ? (
            <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>키워드 데이터 없음</div>
          ) : (
            <>
              <button onClick={() => setShowKwTable(v => !v)} style={{
                width: "100%", padding: "8px 10px", background: t.bgInset || "rgba(148,163,184,.06)", border: `1px solid ${t.border}`,
                borderRadius: 8, color: t.textMuted, fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}>
                키워드 표 ({kwSorted.length}개) {showKwTable ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
              </button>
              {showKwTable && (
                <div style={{ marginTop: 8, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${t.border}`, color: t.textMuted, fontWeight: 800, fontSize: 10 }}>
                        <td style={{ padding: "4px 6px", textAlign: "left" }}>키워드</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>노출</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>클릭</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>CTR</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>CPC</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>평균순위</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>전환</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>광고비</td>
                      </tr>
                    </thead>
                    <tbody>
                      {kwView.map((k, i) => (
                        <tr key={k.keyword || i} style={{ borderBottom: `1px solid ${t.border}` }}>
                          <td style={{ padding: "4px 6px", color: t.text, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.keyword}</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", color: t.textMuted }}>{_fmtKRW(k.impressions)}</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", color: t.textMuted }}>{_fmtKRW(k.clicks)}</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", color: t.textMuted }}>{(k.ctr * 100).toFixed(1)}%</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", color: t.textMuted }}>{_fmtKRW(k.cpc)}</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", color: k.avgRnk > 0 ? t.text : t.textMuted }}>{k.avgRnk > 0 ? k.avgRnk.toFixed(1) : "-"}</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", color: t.text }}>{k.conv || 0}</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, color: t.text }}>{_fmtKRW(k.costVat)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!kwShowAll && kwSorted.length > 40 && (
                    <button onClick={() => setKwShowAll(true)} style={{ marginTop: 8, background: "transparent", border: "none", color: t.accent, fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                      나머지 {kwSorted.length - 40}개 더 보기
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </Card>

        {/* ⑦ 키워드 검색 도구 */}
        <button onClick={() => setOpenTool(v => !v)} style={{
          padding: "10px 0", background: "transparent", border: `1px dashed ${t.border}`,
          borderRadius: 10, color: t.textMuted, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
        }}>
          🔍 키워드 검색 도구 (연관 검색량 조회) {openTool ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>
        {openTool && (
          <Card t={t} title="🔍 키워드 검색 도구" sub="씨앗 단어를 네이버에 던져 연관 키워드를 검색량과 함께 조회">
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <input value={seeds} onChange={e => setSeeds(e.target.value)} placeholder="씨앗 단어(쉼표로 구분)" style={{
                flex: "1 1 320px", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 12.5, fontFamily: "inherit",
              }}/>
              <button onClick={runKeywordTool} disabled={toolLoading} style={{
                padding: "8px 16px", borderRadius: 8, border: "none", background: t.accent, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              }}>{toolLoading ? "조회 중…" : "조회"}</button>
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 11.5, fontWeight: 700, color: t.textMuted }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                <input type="checkbox" checked={toolOnlyMissing} onChange={e => setToolOnlyMissing(e.target.checked)}/> 미등록만
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                <input type="checkbox" checked={toolWorkOnly} onChange={e => setToolWorkOnly(e.target.checked)}/> 우리 일 관련만
              </label>
            </div>
            {toolError && <div style={{ color: "#DC2626", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{toolError}</div>}
            {tool && (
              <>
                <div style={{ fontSize: 11.5, color: t.textMuted, fontWeight: 600, marginBottom: 8 }}>
                  미등록(우리 일 관련) {toolRows.head.count}개 · 합계 검색량 {_fmtKRW(toolRows.head.vol)} · 노이즈(DIY 등) {toolRows.head.noise}개 제외됨
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${t.border}`, color: t.textMuted, fontWeight: 800, fontSize: 10 }}>
                        <td style={{ padding: "4px 6px", textAlign: "left" }}>키워드</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>월간 검색량</td>
                        <td style={{ padding: "4px 6px", textAlign: "center" }}>등록 여부</td>
                      </tr>
                    </thead>
                    <tbody>
                      {toolRows.view.map((r, i) => (
                        <tr key={r.keyword || i} style={{ borderBottom: `1px solid ${t.border}` }}>
                          <td style={{ padding: "4px 6px", color: t.text }}>{r.keyword}</td>
                          <td className="mono" style={{ padding: "4px 6px", textAlign: "right", color: t.text }}>{_fmtKRW(r.total)}</td>
                          <td style={{ padding: "4px 6px", textAlign: "center", color: r.registered ? "#16A34A" : "#DC2626", fontWeight: 800 }}>{r.registered ? "등록됨" : "미등록"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!toolShowAll && toolRows.filtered.length > 40 && (
                    <button onClick={() => setToolShowAll(true)} style={{ marginTop: 8, background: "transparent", border: "none", color: t.accent, fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                      나머지 {toolRows.filtered.length - 40}개 더 보기
                    </button>
                  )}
                </div>
              </>
            )}
          </Card>
        )}

        <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600, lineHeight: 1.6, padding: "4px 2px" }}>
          ⓘ 홈페이지 유입 판별: 접수함 converted 상태 기준(v3). 2026-06-28 이전 전환분은 소급 불가.
        </div>
      </div>
    </div>
  );
}

function Card({ t, title, sub, children }) {
  return (
    <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14, padding: "16px 18px 15px" }}>
      <div style={{ marginBottom: 11 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ t, label, value, sub, suffix, accent, highlight }) {
  const color = highlight || (accent ? t.accent : t.text);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 10px", background: t.bgInset || "rgba(148,163,184,.05)", borderRadius: 8, textAlign: "center" }}>
      <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>{label}</span>
      <span className="mono" style={{ fontSize: 16, fontWeight: 800, color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}{suffix && <span style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 700, marginLeft: 2 }}>{suffix}</span>}
      </span>
      {sub && <span style={{ fontSize: 9.5, color: t.textMuted, fontWeight: 600 }}>{sub}</span>}
    </div>
  );
}

export default MarketingScreenPc;
