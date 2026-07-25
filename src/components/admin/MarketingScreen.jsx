// 2026-07-24 — 마케팅 조감 화면 (운영자 PC).
//   1단계: DB 기반 3블록.
//     ① 홈페이지 접수 퍼널  — 총 접수(스팸 포함) / 유효(converted) / 완료 + 스팸률·취소율.
//     ② 완료 매출·회사이익  — 홈페이지 유입 완료 작업만 필터. 기간: completed_at.
//     ③ 지역 top5           — 홈페이지 유입 task 주소 집계 (미상 제외). 기간: created_at.
//   2단계 (2026-07-25): 네이버 검색광고 API 연동 → 블록④ 활성화.
//     GET /api/ad-report?since&until&actor. salesAmt VAT 별도 → 클라에서 ×1.1 로 실청구액 CPA.
//     CPA vs 완료 1건당 회사이익 비교 (초록=남는 장사, 빨강=적자).
//   ⚠️ 2026-07-25 정정 — 블록④ CPA 분모 교체.
//     기존: 홈페이지 폼(inquiries) 완료건. 이건 자체 유입의 일부일 뿐이다.
//     전화·당근·네이버쇼핑 유입이 전부 "올데이케어" 원청으로 들어오므로 폼 기준 분모는
//     실제의 약 1/3 이었고, 그 결과 흑자인 광고가 적자로 표시됐다 (7월: 92건 vs 실제 319건).
//     → 광고 CPA 분모 = principalCode === "allday" 완료건 (자체 유입 전체).
//     블록①②③ 은 "홈페이지 폼" 분석이므로 그대로 둔다 (성격이 다름).
//   3단계 (2026-07-25): 블록⑤ 일별 광고비 vs 자체유입 대조.
//     유입경로(tasks.channel) 미기록 상태에서 광고 기여분을 역산하기 위한 화면.
//     광고비 하위 1/3 일자의 평균 접수 = "자연유입 기준선", 그 위 초과분 = 광고 기여 추정.

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { todayYmd, toKstYmd } from "../../utils/dateLabel.js";
import { listInquiries } from "../../lib/inquiriesDb.js";
import { parseRegion } from "../../utils/regionParser.js";
import { computeRevenueByYmRange } from "../../utils/revenueStats.js";
import { canSeeField } from "../../data/permissions.js";

// 자체 유입(직영) 원청 코드. 홈페이지·전화·당근·네이버쇼핑 등 우리가 직접 딴 건이 전부 여기로 들어온다.
const SELF_PRINCIPAL_CODE = "allday";

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
  if (period === "today") return { start: today,                end: today };
  if (period === "week")  return { start: _startOfWeekMonYmd(), end: today };
  if (period === "month") return { start: _startOfMonthYmd(),   end: today };
  return { start: today, end: today };
}

function _fmtKRW(n) {
  return Number(n || 0).toLocaleString("ko-KR");
}
function _pctText(num, den) {
  if (!den) return "0.0%";
  return ((num / den) * 100).toFixed(1) + "%";
}

export function MarketingScreen({ t, apiTasks = [], user, onBack }) {
  // 2026-07-25 — 기본 "이번달". "오늘"이면 오늘 접수→오늘 완료가 사실상 없어 항상 N/0/0 표기됨.
  const [period, setPeriod] = useState("month");
  // 2026-07-25 — 스팸 포함 모든 status (null = 전체) 를 1회 호출로. 클라에서 status 별 분류.
  const [allInquiries, setAllInquiries] = useState([]);
  // converted inquiries 의 task_id Set — 홈페이지 유입 task 판별 진실 소스 (v3).
  const [homepageTaskIds, setHomepageTaskIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

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

  // ── 블록 ① — 접수 퍼널 (기간: inquiries.created_at 기준) ─────────────────────
  //   총 접수(스팸 포함) → 유효(converted) → 완료. 스팸률 별도 표기.
  //   new/contacted 는 구조적으로 0(운영 흐름상 즉시 converted/spam) — "전환율" 지표 폐기.
  const funnel = useMemo(() => {
    const inRange = (allInquiries || []).filter(x => {
      const c = x.created_at || x.createdAt;
      if (!c) return false;
      const k = toKstYmd(c);
      return k && k >= start && k <= end;
    });
    const total     = inRange.length;
    const spam      = inRange.filter(x => x.status === "spam").length;
    const converted = inRange.filter(x => x.status === "converted" && x.task_id);
    // converted → 실제 task 조회. status 로 완료/취소 판정.
    const taskById = new Map();
    for (const t2 of (apiTasks || [])) {
      if (t2 && t2.id) taskById.set(String(t2.id), t2);
    }
    let completed = 0;
    let canceled  = 0;
    for (const cv of converted) {
      const tk = taskById.get(String(cv.task_id));
      if (!tk) continue;
      const st = tk.status || "";
      // 2026-07-25 — 취소를 먼저 배제. DB에 status='취소'인데 completed_at 이 남은 task 18건 실재 →
      //   기존 (st === "완료" || tk.completedAt || tk.completed_at) 이 취소를 완료로 이중 계상.
      if (st === "취소") { canceled += 1; continue; }
      if (st === "완료" || tk.completedAt || tk.completed_at) completed += 1;
    }
    return {
      total,
      spam,
      valid: converted.length,
      completed,
      canceled,
    };
  }, [allInquiries, apiTasks, start, end]);

  // ── 블록 ② — 완료 매출·회사이익 (기간: completed_at 기준) ────────────────────
  //   apiTasks 를 homepageTaskIds 로 미리 필터 → computeRevenueByYmRange 통과.
  const revenue = useMemo(() => {
    if (!canSeeField(user, "task.total_amount")) return null;
    const filtered = (apiTasks || []).filter(t2 => t2 && t2.id && homepageTaskIds.has(String(t2.id)));
    return computeRevenueByYmRange(filtered, start, end, user);
  }, [apiTasks, homepageTaskIds, start, end, user]);

  // ── 자체 유입(올데이케어 원청) 완료 실적 — 블록④ CPA 의 분모 ────────────────
  //   2026-07-25 정정. 광고는 폼 접수만 만드는 게 아니라 전화·당근·네이버쇼핑 유입도 만든다.
  //   그 전부가 올데이케어 원청으로 들어오므로 광고 성과의 분모는 이쪽이 맞다.
  //   ⚠️ 한계: 유입경로(tasks.channel) 가 기록되지 않아, 이 중 몇 건이 광고에서 왔는지는
  //   아직 알 수 없다. 따라서 아래 CPA 는 "가장 유리하게 본 값"(하한 CPA)이다.
  const selfTasks = useMemo(() => (apiTasks || []).filter(t2 => {
    if (!t2) return false;
    const code = t2.principalCode || t2.principal_code || "";
    return code === SELF_PRINCIPAL_CODE;
  }), [apiTasks]);

  const selfRevenue = useMemo(() => {
    if (!canSeeField(user, "task.total_amount")) return null;
    return computeRevenueByYmRange(selfTasks, start, end, user);
  }, [selfTasks, start, end, user]);

  // ── 블록 ③ — 지역 top5 (기간: task.created_at 기준, 홈페이지 유입만) ────────
  //   2026-07-25 — "미상"(주소 파싱 실패) 은 순위에서 제외하고 하단에 별도 표기.
  const regionTop5 = useMemo(() => {
    const tasksInRange = (apiTasks || []).filter(x => {
      if (!x || x.status === "취소") return false;
      if (!homepageTaskIds.has(String(x.id))) return false;
      const c = x.createdAt || x.created_at || x.receivedAt || x.received_at;
      if (!c) return false;
      const k = toKstYmd(c);
      return k && k >= start && k <= end;
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
    const rankedTotal = tasksInRange.length - unknown;
    return { rows: sorted.slice(0, 5), total: rankedTotal, unknown, grandTotal: tasksInRange.length };
  }, [apiTasks, homepageTaskIds, start, end]);

  const cancelRate = funnel.valid > 0
    ? _pctText(funnel.canceled, funnel.valid)
    : "-";
  const spamRate = funnel.total > 0
    ? _pctText(funnel.spam, funnel.total)
    : "-";

  // ── 블록 ④ — 네이버 검색광고 (기간: since~until, KST) ───────────────────────
  //   salesAmt 는 VAT 별도 → ×1.1 로 실청구액 산출. CPA 는 실청구액 기준.
  const [ad, setAd] = useState(null);          // { ok, cost, clicks, impressions, cpc, ctr, ... } | null
  const [adLoading, setAdLoading] = useState(false);
  const [adError, setAdError]     = useState("");

  useEffect(() => {
    let alive = true;
    const actorId = user?.user_id || user?.id;
    if (!actorId) { setAd(null); return () => { alive = false; }; }
    setAdLoading(true);
    setAdError("");
    fetch(`/api/ad-report?since=${encodeURIComponent(start)}&until=${encodeURIComponent(end)}&actor=${encodeURIComponent(actorId)}&daily=1`)
      .then(r => r.json())
      .then(j => {
        if (!alive) return;
        setAd(j || null);
        setAdLoading(false);
      })
      .catch(e => {
        if (!alive) return;
        setAdError(String(e?.message || e));
        setAd(null);
        setAdLoading(false);
      });
    return () => { alive = false; };
  }, [user?.user_id, user?.id, start, end]);

  const adCostVat        = ad?.ok ? Math.round(Number(ad.cost || 0) * 1.1) : 0;
  // 2026-07-25 정정 — 분모: 홈페이지 폼 완료건(funnel.completed) → 자체유입 완료건(selfRevenue.count)
  const selfCount        = selfRevenue?.count || 0;
  const cpaVat           = ad?.ok && selfCount > 0
    ? Math.round(adCostVat / selfCount)
    : null;
  const profitPerJob     = selfRevenue && selfCount > 0
    ? Math.round(Number(selfRevenue.owner || 0) / selfCount)
    : null;
  const cpaVerdictColor  = (cpaVat != null && profitPerJob != null)
    ? (cpaVat < profitPerJob ? "#16A34A" : "#DC2626")
    : null;
  // 손익분기 건수 — 광고비를 회수하는 데 필요한 최소 완료건 수.
  //   자체유입 중 이 수만큼만 광고에서 왔으면 본전. 유입경로 미기록이라 실제 기여분은 미상.
  const breakEvenJobs    = (profitPerJob != null && profitPerJob > 0 && adCostVat > 0)
    ? Math.ceil(adCostVat / profitPerJob)
    : null;

  // ── 블록 ⑤ — 일별 광고비 vs 자체유입 ───────────────────────────────────────
  //   왜 접수(completed 아님)와 짝짓나: 접수→완료까지 며칠 걸린다. 같은 날 완료매출은
  //   며칠 전 광고의 결과라 당일 광고비와 나란히 놓으면 인과가 어긋난다.
  //   자연유입 기준선: 광고비가 가장 적었던 날들의 평균 접수. 광고 없이도 들어오는 양.
  //   광고 기여 추정 = Σ max(0, 그날 접수 − 기준선) → 완료율 곱해 완료건으로 환산.
  const daily = useMemo(() => {
    const adDays = new Map();
    for (const d of (ad?.days || [])) {
      if (d && d.ymd) adDays.set(String(d.ymd), d);
    }
    const canMoney = canSeeField(user, "task.total_amount");
    const rows = [];
    const cur  = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (cur <= last && rows.length < 200) {
      const ymd = cur.toISOString().slice(0, 10);
      const a   = adDays.get(ymd);
      let received = 0;
      for (const x of selfTasks) {
        const c = x.createdAt || x.created_at || x.receivedAt || x.received_at;
        if (c && toKstYmd(c) === ymd) received += 1;
      }
      const rv = canMoney ? computeRevenueByYmRange(selfTasks, ymd, ymd, user) : null;
      rows.push({
        ymd,
        cost:        a ? Math.round(Number(a.cost || 0) * 1.1) : 0,
        clicks:      a ? Number(a.clicks || 0) : 0,
        impressions: a ? Number(a.impressions || 0) : 0,
        received,
        done:  rv?.count || 0,
        owner: Number(rv?.owner || 0),
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    const totalCost = rows.reduce((sum, r) => sum + r.cost, 0);
    // 5일 미만이거나 광고비 자체가 0 이면 기준선 비교가 성립하지 않는다.
    if (rows.length < 5 || totalCost <= 0) return { rows, baseline: null };

    const sorted   = [...rows].sort((a, b) => a.cost - b.cost);
    const k        = Math.max(3, Math.floor(rows.length / 3));
    const lowDays  = sorted.slice(0, k);
    const baseline = lowDays.reduce((sum, r) => sum + r.received, 0) / k;

    const totalReceived = rows.reduce((sum, r) => sum + r.received, 0);
    const adDrivenRecv  = rows.reduce((sum, r) => sum + Math.max(0, r.received - baseline), 0);
    const convRate      = totalReceived > 0 ? (selfCount / totalReceived) : 0;
    const adDrivenDone  = Math.round(adDrivenRecv * convRate);

    return {
      rows,
      baseline,
      lowDayCount:   k,
      lowDayAvgCost: Math.round(lowDays.reduce((sum, r) => sum + r.cost, 0) / k),
      totalReceived,
      adDrivenRecv:  Math.round(adDrivenRecv),
      convRate,
      adDrivenDone,
    };
  }, [ad, selfTasks, start, end, user, selfCount]);

  const maxDayCost = Math.max(1, ...daily.rows.map(r => r.cost));

  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      color: t.text,
      paddingBottom: "calc(40px + env(safe-area-inset-bottom))",
      fontFamily: "'Pretendard', sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgElevated,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: t.text,
          display: "flex", alignItems: "center",
        }} aria-label="뒤로">
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>
          📈 마케팅 조감
        </div>
      </div>

      {/* 기간 필터 */}
      <div style={{ padding: "12px 16px 4px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PERIOD_OPTS.map(opt => {
            const on = period === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                style={{
                  padding: "6px 14px",
                  background: on ? t.accent : "transparent",
                  border: `1px solid ${on ? t.accent : t.border}`,
                  borderRadius: 999,
                  color: on ? "#fff" : t.textSecondary,
                  fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginTop: 8 }}>
          {start === end ? `${start} (하루)` : `${start} ~ ${end}`} · KST
        </div>
        {/* v3 안내 문구 (원청 기준 금지 + 2026-06-28 이후만 정확) */}
        <div style={{
          fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 6,
          padding: "6px 10px",
          background: t.bgInset || "rgba(148, 163, 184, 0.08)",
          borderRadius: 6,
          lineHeight: 1.5,
        }}>
          ⓘ 홈페이지 유입 판별: 접수함 <b>converted 상태 inquiries.task_id</b> 기반 (v3).
          원청 코드 기준(v2) 은 폐기. <b>2026-06-28 (Mig 152) 이전 전환분은 소급 불가</b> — 그 이전 데이터는 홈페이지 유입 여부 판정 불가.
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
          불러오는 중…
        </div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: "center", color: "#DC2626", fontSize: 12 }}>
          조회 실패: {error}
        </div>
      ) : (
        <div style={{
          padding: "12px 16px 20px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 12,
        }}>
          {/* ① 홈페이지 접수 퍼널 */}
          <Panel t={t} title="① 홈페이지 접수 퍼널" subtitle="기간: 접수(inquiry.created_at) 기준">
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
            }}>
              <FunnelStep t={t} label="총 접수 (스팸 포함)" value={funnel.total} accent/>
              <FunnelStep t={t} label="유효 (converted)"    value={funnel.valid}/>
              <FunnelStep t={t}
                label="완료"
                value={funnel.completed}
                sub={funnel.valid > 0 ? _pctText(funnel.completed, funnel.valid) + " 완료율" : null}
              />
            </div>
            <div style={{
              marginTop: 12,
              padding: "8px 12px",
              background: t.bgInset || "rgba(148, 163, 184, 0.06)",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>스팸률 (총 접수 대비)</span>
              <span className="mono" style={{
                fontSize: 15, fontWeight: 800,
                color: funnel.spam > 0 ? "#6B7280" : t.text,
                fontVariantNumeric: "tabular-nums",
              }}>
                {spamRate} <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 4 }}>
                  ({funnel.spam}건)
                </span>
              </span>
            </div>
            <div style={{
              marginTop: 6,
              padding: "8px 12px",
              background: t.bgInset || "rgba(148, 163, 184, 0.06)",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>취소율 (유효 대비)</span>
              <span className="mono" style={{
                fontSize: 15, fontWeight: 800,
                color: funnel.canceled > 0 ? "#DC2626" : t.text,
                fontVariantNumeric: "tabular-nums",
              }}>
                {cancelRate} <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 4 }}>
                  ({funnel.canceled}건)
                </span>
              </span>
            </div>
          </Panel>

          {/* ② 완료 매출·회사이익 */}
          <Panel t={t} title="② 완료 매출 · 회사이익" subtitle="기간: 완료(task.completed_at) 기준 · 홈페이지 유입만 · ①의 완료와 집계 기준이 다름(완료 시각 기준)">
            {revenue == null ? (
              <div style={{ padding: 16, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                매출 조회 권한 없음
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
              }}>
                <Metric t={t} label="완료 건수"  value={revenue.count}/>
                <Metric t={t} label="완료 매출"  value={_fmtKRW(revenue.total)} suffix="원" accent/>
                <Metric t={t} label="회사 이익"  value={_fmtKRW(revenue.owner)} suffix="원"
                        highlight={revenue.owner > 0 ? "#16A34A" : (revenue.owner < 0 ? "#DC2626" : null)}/>
              </div>
            )}
          </Panel>

          {/* ③ 지역 top5 */}
          <Panel t={t} title="③ 지역 top5" subtitle="기간: 접수(task.created_at) 기준 · 홈페이지 유입만 · 주소 파싱 실패(미상)는 순위 제외">
            {regionTop5.grandTotal === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                이 기간 홈페이지 유입 없음
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {regionTop5.rows.map((r, idx) => {
                  const pct = regionTop5.total > 0 ? (r.count / regionTop5.total) * 100 : 0;
                  return (
                    <div key={r.key} style={{
                      display: "grid",
                      gridTemplateColumns: "28px minmax(0, 1fr) 60px",
                      gap: 10, alignItems: "center",
                      padding: "8px 4px",
                    }}>
                      <span className="mono" style={{
                        fontSize: 13, fontWeight: 800,
                        color: idx === 0 ? t.accent : t.textMuted,
                        textAlign: "center",
                      }}>{idx + 1}</span>
                      <div style={{
                        display: "flex", flexDirection: "column", gap: 3,
                        minWidth: 0,
                      }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700, color: t.text,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{r.label}</span>
                        <div style={{
                          height: 4, background: t.bgInset || "rgba(148, 163, 184, 0.15)",
                          borderRadius: 2, overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${pct.toFixed(1)}%`, height: "100%",
                            background: t.accent, borderRadius: 2,
                          }}/>
                        </div>
                      </div>
                      <span className="mono" style={{
                        fontSize: 13, fontWeight: 800, color: t.text,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}>{r.count} <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>건</span></span>
                    </div>
                  );
                })}
                {regionTop5.rows.length === 0 && (
                  <div style={{ padding: "12px 4px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                    이 기간 순위 대상 없음 (전부 주소 미상)
                  </div>
                )}
                {regionTop5.unknown > 0 && (
                  <div style={{
                    marginTop: 4,
                    padding: "6px 4px",
                    borderTop: `1px dashed ${t.border}`,
                    display: "flex", justifyContent: "space-between",
                    fontSize: 11, color: t.textMuted, fontWeight: 700,
                  }}>
                    <span>주소 미상 (순위 제외)</span>
                    <span className="mono" style={{ color: t.text }}>{regionTop5.unknown}건</span>
                  </div>
                )}
                <div style={{
                  marginTop: 4,
                  padding: "6px 4px",
                  borderTop: `1px solid ${t.border}`,
                  display: "flex", justifyContent: "space-between",
                  fontSize: 11, color: t.textMuted, fontWeight: 700,
                }}>
                  <span>홈페이지 유입 합계</span>
                  <span className="mono" style={{ color: t.text }}>{regionTop5.grandTotal}건</span>
                </div>
              </div>
            )}
          </Panel>

          {/* ④ 광고 지출·CPA (네이버 검색광고) */}
          <Panel t={t} title="④ 광고 지출 · CPA" subtitle="네이버 검색광고 · 분모는 자체유입(올데이케어) 완료건 · 광고비/CPA 는 VAT 포함(실청구)">
            {adLoading ? (
              <div style={{ padding: 20, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                광고 지표 조회 중…
              </div>
            ) : (adError || !ad || ad.ok === false) ? (
              <div style={{ padding: 16, textAlign: "center", color: t.textMuted, fontSize: 12, lineHeight: 1.5 }}>
                광고 API 조회 실패
                {(adError || ad?.error) && (
                  <div style={{ marginTop: 4, fontSize: 10, color: t.textSecondary }}>
                    {adError || ad?.error}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 8,
                }}>
                  <Metric t={t} label="광고비 (VAT 포함)" value={_fmtKRW(adCostVat)}     suffix="원" accent/>
                  <Metric t={t} label="클릭"               value={_fmtKRW(ad.clicks)}    suffix="회"/>
                  <Metric t={t} label="CPC"                value={_fmtKRW(ad.cpc)}       suffix="원"/>
                  <Metric t={t} label="CTR"                value={(Number(ad.ctr || 0) * 100).toFixed(2)} suffix="%"/>
                </div>
                <div style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  background: t.bgInset || "rgba(148, 163, 184, 0.06)",
                  borderRadius: 8,
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>
                      CPA (VAT 포함) — 광고비 ÷ 자체유입 완료({selfCount}건)
                    </span>
                    <span className="mono" style={{
                      fontSize: 16, fontWeight: 800,
                      color: cpaVerdictColor || t.text,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {cpaVat != null ? _fmtKRW(cpaVat) + "원" : "-"}
                    </span>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>
                      완료 1건당 회사이익 — 이익 ÷ 자체유입 완료({selfCount}건)
                    </span>
                    <span className="mono" style={{
                      fontSize: 13, fontWeight: 700, color: t.text,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {profitPerJob != null ? _fmtKRW(profitPerJob) + "원" : "-"}
                    </span>
                  </div>
                  {(cpaVat != null && profitPerJob != null) && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 11, fontWeight: 700,
                      color: cpaVerdictColor,
                      textAlign: "right",
                    }}>
                      {cpaVat < profitPerJob
                        ? `✓ 남는 장사 (건당 +${_fmtKRW(profitPerJob - cpaVat)}원)`
                        : `✗ 적자 (건당 −${_fmtKRW(cpaVat - profitPerJob)}원)`}
                    </div>
                  )}
                </div>
                {breakEvenJobs != null && (
                  <div style={{
                    marginTop: 8,
                    padding: "8px 10px",
                    background: t.bgInset || "rgba(148, 163, 184, 0.06)",
                    borderRadius: 8,
                    fontSize: 11, fontWeight: 700, color: t.textMuted, lineHeight: 1.5,
                  }}>
                    손익분기 <span className="mono" style={{ color: t.text, fontWeight: 800 }}>{_fmtKRW(breakEvenJobs)}건</span>
                    {selfCount > 0 && (
                      <> — 자체유입 {_fmtKRW(selfCount)}건 중 {(breakEvenJobs / selfCount * 100).toFixed(0)}% 이상이 광고 유입이면 본전</>
                    )}
                  </div>
                )}
                <div style={{
                  marginTop: 8, fontSize: 10, color: t.textMuted, fontWeight: 600, lineHeight: 1.5,
                }}>
                  ⓘ 네이버 salesAmt 는 VAT 별도 (원본 {_fmtKRW(Math.round(Number(ad.cost || 0)))}원).
                  카드 실청구는 VAT 포함 (×1.1). CPA·손익 판단은 실청구액 기준.
                  <br/>
                  ⚠️ 분모는 자체유입(전화·홈페이지·당근·네이버쇼핑) 완료 전체다. 유입경로가 기록되지
                  않아 이 중 광고 기여분을 아직 가려낼 수 없으므로, 위 CPA 는 가장 유리하게 본 값이다.
                </div>
              </>
            )}
          </Panel>

          {/* ⑤ 일별 광고비 vs 자체유입 */}
          {ad?.ok && !adLoading && daily.rows.length >= 5 && (
            <Panel t={t} title="⑤ 일별 광고비 vs 자체유입"
                   subtitle="광고 적게 쓴 날의 접수량 = 자연유입 기준선. 그 위 초과분이 광고가 만든 몫이다">
              {daily.baseline != null && (
                <div style={{
                  marginBottom: 10, padding: "10px 12px",
                  background: t.bgInset || "rgba(148, 163, 184, 0.06)",
                  borderRadius: 8, fontSize: 11, fontWeight: 700,
                  color: t.textMuted, lineHeight: 1.6,
                }}>
                  자연유입 기준선{" "}
                  <span className="mono" style={{ color: t.text, fontWeight: 800 }}>
                    하루 {daily.baseline.toFixed(1)}건
                  </span>{" "}
                  <span style={{ fontWeight: 600 }}>
                    (광고비 최저 {daily.lowDayCount}일 평균 · 그날 평균 광고비 {_fmtKRW(daily.lowDayAvgCost)}원)
                  </span>
                  <br/>
                  기준선 초과 접수{" "}
                  <span className="mono" style={{ color: t.text, fontWeight: 800 }}>
                    {_fmtKRW(daily.adDrivenRecv)}건
                  </span>{" "}
                  × 완료율 {(daily.convRate * 100).toFixed(0)}% ={" "}
                  <span className="mono" style={{ color: t.text, fontWeight: 800 }}>
                    광고 기여 완료 ≈ {_fmtKRW(daily.adDrivenDone)}건
                  </span>
                  {breakEvenJobs != null && (
                    <div style={{
                      marginTop: 6, paddingTop: 6,
                      borderTop: `1px dashed ${t.border}`,
                      fontSize: 12, fontWeight: 800,
                      color: daily.adDrivenDone >= breakEvenJobs ? "#16A34A" : "#DC2626",
                    }}>
                      {daily.adDrivenDone >= breakEvenJobs
                        ? `✓ 손익분기 ${_fmtKRW(breakEvenJobs)}건 넘김 (+${_fmtKRW(daily.adDrivenDone - breakEvenJobs)}건)`
                        : `✗ 손익분기 ${_fmtKRW(breakEvenJobs)}건 미달 (−${_fmtKRW(breakEvenJobs - daily.adDrivenDone)}건)`}
                    </div>
                  )}
                </div>
              )}

              <div style={{ overflowX: "auto" }}>
                <table className="mono" style={{
                  width: "100%", borderCollapse: "collapse",
                  fontSize: 11, fontVariantNumeric: "tabular-nums",
                }}>
                  <thead>
                    <tr style={{ color: t.textMuted, fontWeight: 800 }}>
                      <th style={{ textAlign: "left",  padding: "4px 6px" }}>날짜</th>
                      <th style={{ textAlign: "right", padding: "4px 6px" }}>광고비</th>
                      <th style={{ textAlign: "right", padding: "4px 6px" }}>클릭</th>
                      <th style={{ textAlign: "right", padding: "4px 6px" }}>접수</th>
                      <th style={{ textAlign: "right", padding: "4px 6px" }}>완료</th>
                      <th style={{ textAlign: "right", padding: "4px 6px" }}>회사이익</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.rows.map(r => {
                      const over = daily.baseline != null && r.received > daily.baseline;
                      return (
                        <tr key={r.ymd} style={{ borderTop: `1px solid ${t.border}` }}>
                          <td style={{ padding: "4px 6px", color: t.textMuted, fontWeight: 700 }}>
                            {r.ymd.slice(5)}
                          </td>
                          <td style={{ padding: "4px 6px", textAlign: "right", color: t.text }}>
                            <span style={{
                              display: "inline-block",
                              padding: "1px 4px", borderRadius: 4,
                              background: `rgba(255, 27, 141, ${(r.cost / maxDayCost * 0.22).toFixed(3)})`,
                            }}>{_fmtKRW(r.cost)}</span>
                          </td>
                          <td style={{ padding: "4px 6px", textAlign: "right", color: t.textMuted }}>{_fmtKRW(r.clicks)}</td>
                          <td style={{
                            padding: "4px 6px", textAlign: "right",
                            color: over ? "#16A34A" : t.text, fontWeight: over ? 800 : 700,
                          }}>{_fmtKRW(r.received)}</td>
                          <td style={{ padding: "4px 6px", textAlign: "right", color: t.textMuted }}>{_fmtKRW(r.done)}</td>
                          <td style={{ padding: "4px 6px", textAlign: "right", color: t.text }}>{_fmtKRW(r.owner)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{
                marginTop: 8, fontSize: 10, color: t.textMuted, fontWeight: 600, lineHeight: 1.5,
              }}>
                ⓘ 접수는 그날 들어온 자체유입 전부(취소 포함), 완료·이익은 그날 완료된 건 기준이라
                같은 줄이 같은 고객이 아니다. 접수→완료에 며칠 걸리기 때문이다.
                <br/>
                ⚠️ 요일 효과가 두 지표를 함께 흔든다(주말은 광고비도 접수도 적다). 기준선은 이를
                보정하지 않으므로 추정치다. 정확히 알려면 접수 시 유입경로 한 칸을 받아야 한다.
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function Panel({ t, title, subtitle, children }) {
  return (
    <div style={{
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
      padding: "14px 14px 12px",
    }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: "-0.2px" }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function Metric({ t, label, value, suffix, accent, highlight }) {
  const color = highlight || (accent ? t.accent : t.text);
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      padding: "10px 12px",
      background: t.bgInset || "rgba(148, 163, 184, 0.05)",
      borderRadius: 8,
      minWidth: 0,
    }}>
      <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      <span className="mono" style={{
        fontSize: 16, fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.3px",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {value}
        {suffix && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginLeft: 2 }}>{suffix}</span>}
      </span>
    </div>
  );
}

function FunnelStep({ t, label, value, sub, accent }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      padding: "12px 12px",
      background: accent ? (t.accentBg || "rgba(255, 27, 141, 0.08)") : (t.bgInset || "rgba(148, 163, 184, 0.05)"),
      border: `1px solid ${accent ? t.accent : "transparent"}`,
      borderRadius: 10,
      textAlign: "center",
    }}>
      <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      <span className="mono" style={{
        fontSize: 22, fontWeight: 800,
        color: accent ? t.accent : t.text,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.5px",
      }}>{Number(value || 0).toLocaleString("ko-KR")}</span>
      {sub && (
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>{sub}</span>
      )}
    </div>
  );
}

export default MarketingScreen;
