// 2026-07-29 — 마케팅 조감 모바일 전용 화면. PC용 MarketingScreen.jsx 는 그대로 유지(건드리지 않음).
//   사장님 피드백(7/29): 기존 화면 순서/우선순위 이상함 + 정보 과다(한눈에 안 들어옴) + 동시에 디테일 필요,
//   모바일 화면 크기 안 맞아서 깨짐(4열 그리드·raw table 가로스크롤). 시간대별 그래프는 좋았음(아침 리포트 스타일),
//   지역 랭킹은 다르게 그려달라 요청.
//   → 요약(⓪ 지금 실시간 + 시간대 그래프)을 맨 위로, CPA 판정은 한 줄 + 접어서 그룹별 상세,
//     지역은 막대그래프로 재설계, 퍼널/매출은 "더보기" 아코디언 안으로.
//   계산 공식은 PC 화면과 100% 동일(같은 useMemo 공식을 그대로 복사) — 숫자가 어긋나면 안 되므로.
//   PC 파일을 리팩터링해서 공유 훅으로 뽑는 대신 이 파일에 필요한 만큼만 별도 구현한 이유:
//   PC 쪽은 이미 정교하고(⑥ 키워드까지) 잘 도는 코드라 손대다 깨뜨릴 위험을 피하기 위해서다.

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { todayYmd, toKstYmd } from "../../utils/dateLabel.js";
import { listInquiries } from "../../lib/inquiriesDb.js";
import { parseRegion } from "../../utils/regionParser.js";
import { computeRevenueByYmRange } from "../../utils/revenueStats.js";
import { canSeeField } from "../../data/permissions.js";

const SELF_PRINCIPAL_CODE = "allday";
const ADC_TOKEN = "82ae0c34ae8eeec0f6932b82"; // 대표용 읽기전용 — api/ad-console.js (시간대 흐름 전용)
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
function _fmtKRW(n) { return Number(n || 0).toLocaleString("ko-KR"); }
function _pctText(num, den) { if (!den) return "0.0%"; return ((num / den) * 100).toFixed(1) + "%"; }
function _statusColor(v, goal) {
  if (v == null) return "#94A3B8";
  if (v <= goal * 0.6) return "#16A34A";
  if (v <= goal) return "#D97706";
  return "#DC2626";
}

export function MarketingScreenMobile({ t, apiTasks = [], user, onBack }) {
  const [period, setPeriod] = useState("month");
  const [openGroups, setOpenGroups] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);

  // ── 접수/전환 원천 데이터 (PC ①②와 동일 소스) ──────────────────────────────
  const [allInquiries, setAllInquiries] = useState([]);
  const [homepageTaskIds, setHomepageTaskIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const actorId = user?.user_id || user?.id;
    if (!actorId) { setAllInquiries([]); setHomepageTaskIds(new Set()); setLoading(false); return () => { alive = false; }; }
    listInquiries(actorId, null).then(rows => {
      if (!alive) return;
      const list = rows || [];
      setAllInquiries(list);
      const ids = new Set();
      for (const r of list) { if (r.status === "converted" && r.task_id) ids.add(String(r.task_id)); }
      setHomepageTaskIds(ids);
      setLoading(false);
    }).catch(() => { if (alive) { setAllInquiries([]); setHomepageTaskIds(new Set()); setLoading(false); } });
    return () => { alive = false; };
  }, [user?.user_id, user?.id]);

  const { start, end } = useMemo(() => _rangeForPeriod(period), [period]);

  // ── 퍼널 (PC ①과 동일 공식) ─────────────────────────────────────────────
  const funnel = useMemo(() => {
    const inRange = (allInquiries || []).filter(x => {
      const c = x.created_at || x.createdAt;
      if (!c) return false;
      const k = toKstYmd(c);
      return k && k >= start && k <= end;
    });
    const total = inRange.length;
    const spam  = inRange.filter(x => x.status === "spam").length;
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

  const revenue = useMemo(() => {
    if (!canSeeField(user, "task.total_amount")) return null;
    const filtered = (apiTasks || []).filter(t2 => t2 && t2.id && homepageTaskIds.has(String(t2.id)));
    return computeRevenueByYmRange(filtered, start, end, user);
  }, [apiTasks, homepageTaskIds, start, end, user]);

  // ── 자체유입(원청 allday) — CPA 분모 (PC ④와 동일) ──────────────────────
  const selfTasks = useMemo(() => (apiTasks || []).filter(t2 => {
    if (!t2) return false;
    const code = t2.principalCode || t2.principal_code || "";
    return code === SELF_PRINCIPAL_CODE;
  }), [apiTasks]);
  const selfRevenue = useMemo(() => {
    if (!canSeeField(user, "task.total_amount")) return null;
    return computeRevenueByYmRange(selfTasks, start, end, user);
  }, [selfTasks, start, end, user]);
  const selfCount    = selfRevenue?.count || 0;
  const profitPerJob = selfRevenue && selfCount > 0 ? Math.round(Number(selfRevenue.owner || 0) / selfCount) : null;

  // ── 지역 랭킹 (2026-07-29 수정 — 홈페이지 유입만이 아니라 "오늘" 올데이케어(자체) 원청
  //   접수 전체 기준으로 변경. 기간 필터와 무관하게 항상 오늘. selfTasks 와 동일한
  //   principalCode==="allday" 판별을 쓰되, 날짜만 오늘로 고정.
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

  // ── ④ 광고 지출·CPA (기간: since~until) ─────────────────────────────────
  const [ad, setAd] = useState(null);
  const [adLoading, setAdLoading] = useState(false);
  const [adError, setAdError] = useState("");
  useEffect(() => {
    let alive = true;
    const actorId = user?.user_id || user?.id;
    if (!actorId) { setAd(null); return () => { alive = false; }; }
    setAdLoading(true); setAdError("");
    fetch(`/api/ad-report?since=${encodeURIComponent(start)}&until=${encodeURIComponent(end)}&actor=${encodeURIComponent(actorId)}&daily=1&keywords=1`)
      .then(r => r.json())
      .then(j => { if (alive) { setAd(j || null); setAdLoading(false); } })
      .catch(e => { if (alive) { setAdError(String(e?.message || e)); setAd(null); setAdLoading(false); } });
    return () => { alive = false; };
  }, [user?.user_id, user?.id, start, end]);

  const adCostVat = ad?.ok ? Math.round(Number(ad.cost || 0) * 1.1) : 0;
  const cpaVat = ad?.ok && selfCount > 0 ? Math.round(adCostVat / selfCount) : null;
  const cpaVerdictColor = (cpaVat != null && profitPerJob != null) ? (cpaVat < profitPerJob ? "#16A34A" : "#DC2626") : null;
  const breakEvenJobs = (profitPerJob != null && profitPerJob > 0 && adCostVat > 0) ? Math.ceil(adCostVat / profitPerJob) : null;

  // ── ⓪ 지금 실시간 (항상 오늘, 5분마다) ──────────────────────────────────
  // 2026-07-29 — 카드가 통째로 사라지는 문제 진단용: loading/error 상태를 따로 잡음.
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

  // 2026-07-29 — 목표/한계를 profitPerJob 동적값 대신 앱 전체에서 이미 쓰는 고정값(25,000/35,300,
  //   ads-console.html·시각별 카드와 동일)으로 통일 — "지금 쓰는 돈이 적정선인지" 를 매번 다른 기준 대신
  //   항상 같은 눈금으로 판단하게. 페이스미터 디자인(C안) 채택 — 마감 예상 지출(proj) 도 다시 계산.
  const GOAL_CPA = 25000, LIMIT_CPA = 35300;
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
    else if (costVat >= GOAL_CPA)               verdict = { label: "접수 0 — 확인", color: "#DC2626" };
    else                                        verdict = { label: "집계중",        color: "#94A3B8" };
    const lr = liveAd.live?.lastRun;
    const lrMin = lr ? Math.round((Date.now() - new Date(lr.at).getTime()) / 60000) : null;
    // 페이스: 광고 시간 08~20시 기준, 지금까지 속도로 마감 예상 (PC ⓪ 와 동일 공식)
    const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
    const kstH = kstNow.getUTCHours() + kstNow.getUTCMinutes() / 60;
    const ran = Math.min(Math.max(kstH - 8, 0.25), 12);
    const proj = kstH < 20 ? Math.round(costVat * 12 / ran) : costVat;
    return { costVat, jobs, per, verdict, lrMin, lrWatched: lr?.watched, proj };
  }, [liveAd]);

  // ── 시간대별 지출·접수 (api/ad-console.js trend — 오늘 전용, 별도 소스) ──
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

  // ── 그룹별 광고 성과 (PC ⑥ 축약판 — 접힌 상세) ───────────────────────────
  const groups = useMemo(() => {
    const rows = (ad?.adGroups || []).map(g => {
      const costVat = Math.round(Number(g.cost || 0) * 1.1);
      const conv = Number(g.conv || 0);
      const cpa = conv > 0 ? Math.round(costVat / conv) : null;
      let status;
      if (costVat < 10000 && g.impressions < 100) status = { label: "안 돌아감", color: "#94A3B8" };
      else if (cpa == null) status = { label: "아직 모름", color: "#94A3B8" };
      else if (profitPerJob != null && cpa > profitPerJob) status = { label: "비쌈", color: "#DC2626" };
      else if (profitPerJob != null && cpa < profitPerJob * 0.5) status = { label: "더 써도 됨", color: "#16A34A" };
      else status = { label: "적정", color: "#D97706" };
      return { id: g.id || g.name, name: g.name, costVat, conv, cpa, status };
    }).sort((a, b) => b.costVat - a.costVat);
    return rows;
  }, [ad, profitPerJob]);

  const cancelRate = funnel.valid > 0 ? _pctText(funnel.canceled, funnel.valid) : "-";
  const spamRate = funnel.total > 0 ? _pctText(funnel.spam, funnel.total) : "-";
  const maxRegion = Math.max(1, ...regionTop.rows.map(r => r.count));
  const regionShown = regionTop.rows.slice(0, 8);
  const regionRest = regionTop.rows.slice(8).reduce((a, r) => a + r.count, 0);

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, paddingBottom: "calc(40px + env(safe-area-inset-bottom))", fontFamily: "'Pretendard', sans-serif" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: `1px solid ${t.border}`, background: t.bgElevated, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex", alignItems: "center" }} aria-label="뒤로">
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>📈 마케팅</div>
      </div>

      <div style={{ padding: "12px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ⓪ 지금 실시간 — 페이스미터 디자인(C안, 사장님 선택 7/29). 최우선 요약, 기간필터 무관 항상 오늘.
            "지금 쓰는 돈이 적정선인지" 를 막대 하나로 바로 보이게 — 채움 길이=지금 건당비용, 검정 세로선=목표(25,000원). */}
{!liveView && (
          <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 16, padding: "12px 16px", fontSize: 11.5, color: t.textMuted, fontWeight: 700 }}>
            🔴 지금 실시간 — {liveAdLoading ? "불러오는 중…" : `데이터 없음 (${liveAdError || "원인 미상"})`}
          </div>
        )}
                {liveView && (
          <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 16, padding: "14px 16px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>🔴 지금 실시간</span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: liveView.verdict.color, background: `${liveView.verdict.color}1F`, borderRadius: 999, padding: "3px 10px" }}>{liveView.verdict.label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, marginBottom: 2 }}>
              {liveView.per != null ? _fmtKRW(liveView.per) : "-"}
              <span style={{ fontSize: 14, color: t.textMuted, fontWeight: 700, marginLeft: 3 }}>원/건</span>
            </div>
            <div style={{ fontSize: 11, color: t.textSecondary, fontWeight: 600, marginBottom: 12 }}>
              오늘 {_fmtKRW(liveView.costVat)}원 써서 {liveView.jobs ?? "?"}건 접수
              {liveView.lrMin != null && ` · 자동입찰 ${liveView.lrMin < 1 ? "방금" : `${liveView.lrMin}분 전`} 실행`}
            </div>
            <div style={{ position: "relative", height: 26, background: t.bgInset || "rgba(148,163,184,.15)", borderRadius: 8, marginBottom: 6 }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${liveView.per != null ? Math.min(100, liveView.per / LIMIT_CPA * 100) : 0}%`,
                background: "linear-gradient(90deg, #F4A73A, " + liveView.verdict.color + ")",
                borderRadius: 8, transition: "width .3s",
              }}/>
              <div style={{ position: "absolute", top: -4, bottom: -4, width: 2, left: `${GOAL_CPA / LIMIT_CPA * 100}%`, background: t.text }}/>
              <div style={{ position: "absolute", top: -16, left: `${GOAL_CPA / LIMIT_CPA * 100}%`, transform: "translateX(-50%)", fontSize: 9, fontWeight: 800, color: t.text, whiteSpace: "nowrap" }}>목표</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: t.textMuted, fontWeight: 700, marginBottom: 10 }}>
              <span>0원</span><span>한계 {_fmtKRW(LIMIT_CPA)}원</span>
            </div>
            <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600 }}>
              {liveView.per != null && liveView.jobs > 0
                ? `📈 이 속도면 오늘 마감쯤 약 ${_fmtKRW(liveView.proj)}원 · 감시 ${_fmtKRW(liveView.lrWatched || 0)}개`
                : (liveView.lrMin != null ? `감시 ${_fmtKRW(liveView.lrWatched || 0)}개` : "⚪ 자동입찰 기록 없음")}
            </div>
          </div>
        )}

        {/* 시간대별 지출·접수 */}
        {hourRows.length > 0 && (
          <Card t={t} title="🕐 시각별 지출 · 접수" sub="건당 2.5만↓ 초록 · 3.53만↑ 빨강(적자선)">
            {hourRows.map(r => {
              const p = (r.won && r.jb) ? Math.round(r.won / r.jb) : null;
              return (
                <div key={r.h} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11.5 }}>
                  <span style={{ width: 30, flexShrink: 0, fontWeight: 700, color: t.textSecondary }}>{r.h}시</span>
                  <span style={{ flex: 1, color: t.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.won == null ? "-" : _fmtKRW(r.won) + "원"} · {r.jb}건{r.yb ? ` (어제 ${r.yb})` : ""}
                  </span>
                  <span style={{ width: 56, flexShrink: 0, textAlign: "right", fontWeight: 800, color: p ? _statusColor(p, 25000) : t.textMuted }}>
                    {p ? _fmtKRW(p) : "-"}
                  </span>
                </div>
              );
            })}
          </Card>
        )}


        {/* 지역 랭킹 — 막대그래프. 2026-07-29 — "오늘" + 올데이케어(자체) 원청 접수 전체 기준으로 변경.
            기간 필터와 무관 (⓪지금실시간·시간대별과 같은 그룹). */}
        <Card t={t} title="📍 오늘 지역 랭킹" sub="오늘 올데이케어(자체) 원청 접수 전체 · 기간 필터와 무관">
          {regionShown.length === 0 ? (
            <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>오늘 데이터 없음</div>
          ) : (
            <>
              {regionShown.map((r, idx) => {
                const pct = (r.count / maxRegion) * 100;
                return (
                  <div key={r.key} style={{ marginBottom: 9 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: idx === 0 ? t.accent : t.textMuted }}>{idx + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: t.text, wordBreak: "keep-all" }}>{r.label}</span>
                      <span className="mono" style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: t.text }}>{r.count}건</span>
                    </div>
                    <div style={{ height: 14, borderRadius: 5, background: t.bgInset || "rgba(148,163,184,.12)", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: t.accent, borderRadius: 5, minWidth: r.count > 0 ? 4 : 0 }}/>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 4, paddingTop: 6, borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", fontSize: 10.5, color: t.textMuted, fontWeight: 700 }}>
                <span>{regionRest > 0 ? `그 외 지역 ${_fmtKRW(regionRest)}건` : " "}</span>
                <span>주소 미상 {regionTop.unknown}건 · 오늘 합계 {regionTop.grandTotal}건</span>
              </div>
            </>
          )}
        </Card>
        {/* 기간 필터 (아래 카드들에 적용) */}
        <div style={{ display: "flex", gap: 6 }}>
          {PERIOD_OPTS.map(opt => {
            const on = period === opt.id;
            return (
              <button key={opt.id} type="button" onClick={() => setPeriod(opt.id)} style={{
                flex: 1, padding: "8px 0", background: on ? t.accent : "transparent",
                border: `1px solid ${on ? t.accent : t.border}`, borderRadius: 10,
                color: on ? "#fff" : t.textSecondary, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>{opt.label}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600, marginTop: -6 }}>
          {start === end ? `${start} (하루)` : `${start} ~ ${end}`} · KST 기준 아래 카드들
        </div>

        {/* 광고 CPA 판정 (한 줄 요약 + 접이식 그룹 상세) */}
        <Card t={t} title="💰 광고 CPA 판정" sub={`분모: 자체유입(전화포함) 완료 ${selfCount}건`}>
          {adLoading ? (
            <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>조회 중…</div>
          ) : (adError || !ad || ad.ok === false) ? (
            <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>광고 API 조회 실패</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>광고비 {_fmtKRW(adCostVat)}원 ÷ CPA</span>
                <span className="mono" style={{ fontSize: 17, fontWeight: 800, color: cpaVerdictColor || t.text }}>
                  {cpaVat != null ? _fmtKRW(cpaVat) + "원" : "-"}
                </span>
              </div>
              {(cpaVat != null && profitPerJob != null) && (
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: cpaVerdictColor, textAlign: "right" }}>
                  {cpaVat < profitPerJob ? `✓ 남는 장사 (건당 +${_fmtKRW(profitPerJob - cpaVat)}원)` : `✗ 적자 (건당 −${_fmtKRW(cpaVat - profitPerJob)}원)`}
                </div>
              )}
              {breakEvenJobs != null && (
                <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
                  손익분기 {_fmtKRW(breakEvenJobs)}건 이상 광고유입이면 본전
                </div>
              )}
              {groups.length > 0 && (
                <>
                  <button onClick={() => setOpenGroups(v => !v)} style={{
                    width: "100%", marginTop: 10, padding: "8px 10px",
                    background: t.bgInset || "rgba(148,163,184,.06)", border: `1px solid ${t.border}`,
                    borderRadius: 8, color: t.textMuted, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  }}>
                    그룹별 자세히 {openGroups ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                  </button>
                  {openGroups && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      {groups.map(g => (
                        <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${t.border}`, fontSize: 12 }}>
                          <span style={{ flex: 1, fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                          <span className="mono" style={{ color: t.textMuted }}>{_fmtKRW(g.costVat)}원</span>
                          <span style={{ padding: "2px 8px", borderRadius: 999, background: `${g.status.color}22`, color: g.status.color, fontSize: 10, fontWeight: 900, whiteSpace: "nowrap" }}>{g.status.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Card>

        {/* 더 자세히 — 퍼널·매출 (아코디언) */}
        <button onClick={() => setOpenDetail(v => !v)} style={{
          padding: "10px 0", background: "transparent", border: `1px dashed ${t.border}`,
          borderRadius: 10, color: t.textMuted, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
        }}>
          접수 퍼널 · 매출 자세히 {openDetail ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>

        {openDetail && (
          <>
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
          </>
        )}

        <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, lineHeight: 1.6, padding: "4px 2px" }}>
          ⓘ 홈페이지 유입 판별: 접수함 converted 상태 기준(v3). 2026-06-28 이전 전환분은 소급 불가.
        </div>
      </div>
    </div>
  );
}

function Card({ t, title, sub, children }) {
  return (
    <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12, padding: "13px 14px 12px" }}>
      <div style={{ marginBottom: 9 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{title}</div>
        {sub && <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ t, label, value, sub, suffix, accent, highlight }) {
  const color = highlight || (accent ? t.accent : t.text);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "9px 10px", background: t.bgInset || "rgba(148,163,184,.05)", borderRadius: 8, textAlign: "center" }}>
      <span style={{ fontSize: 9.5, color: t.textMuted, fontWeight: 700 }}>{label}</span>
      <span className="mono" style={{ fontSize: 15, fontWeight: 800, color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}{suffix && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginLeft: 2 }}>{suffix}</span>}
      </span>
      {sub && <span style={{ fontSize: 9, color: t.textMuted, fontWeight: 600 }}>{sub}</span>}
    </div>
  );
}

export default MarketingScreenMobile;
