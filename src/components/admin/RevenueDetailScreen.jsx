// 2026-06-03 — 매출 자세히 화면.
//   사장님 시안: 월 선택 + 4요약 + 원청별 + 기사별.
//   2026-06-16 — 작업별 탭 추가 (사장님 spec): 원청별 / 기사별 / 작업별 3뷰.
//     · 작업별: 고객명 / 원청 / 기사 / 종류 / 매출 / 회사 마진. PC=표 / 모바일=카드.
//     · 작업별 기본 = "오늘" (이번달 토글 별도). 종류 필터(전체/세척/냉매/기타).
//     · 데이터 = getTasksByYmRange (computeRevenueByYmRange 와 동일 필터 → 합계 정합).
//   데이터 = RevenueOverviewBlock 와 동일 dataset (isTrackARemittance + KST).
//   usol_n (트랙 B) 제외 — 정합 일관.
import { useState, useMemo, useRef } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { todayYmd, toKstYmd } from "../../utils/dateLabel.js";
import { useIsPc } from "../../utils/useIsPc.js";
import {
  computeRevenueByYmRange,
  computeRevenueByPrincipal,
  computeRevenueByEngineer,
  getMonthRange,
  getTasksByYmRange,
} from "../../utils/revenueStats.js";
// 2026-07-20 — 5종 통일 (SERVICE_KIND_META). 옛 자체 3종 (cleaning/refrigerant/other) 폐기.
import {
  getServiceKind,
  SERVICE_KIND_META,
  SERVICE_KIND_ORDER,
} from "../../utils/workTypeKind.js";
import { EngineerTaskModal } from "./EngineerTaskList.jsx";

// 2026-07-09 — 일별 네비용 헬퍼. selectedDay ("YYYY-MM-DD") ±1 일 이동.
function shiftYmd(ymd, delta) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
// 2026-07-09 — "YYYY-MM-DD" → "M/D(요일)" (일별 라벨).
const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];
function fmtDayLabel(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(y, m - 1, d);
  return `${m}/${d} (${DOW_KR[dt.getDay()]})`;
}

function fmtKRW(n) { return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`; }

// 2026-07-24 v4 — 마진 초록 (손익 화면 회사 몫과 동일 색 언어) + 기사 청록.
//   "초록 금액 = 회사 마진" 범례 한 줄이 라벨 반복을 대체 (사장님 spec).
const MARGIN_GREEN = "#28A96A";
const ENG_CYAN     = "#0EA5C6";

// 상태 칩 (✓ 완료 / 진행·대기 / 🚗 출장 / ✗ 취소)
function StatusChip({ tone = "mut", children }) {
  const style = {
    ok:   { background: "rgba(43,182,115,0.14)",  color: "#2BB673" },
    warn: { background: "rgba(251,191,36,0.14)",  color: "#D97706" },
    bad:  { background: "rgba(248,113,113,0.14)", color: "#DC2626" },
    mut:  { background: "rgba(128,128,128,0.12)", color: "inherit" },
  }[tone] || {};
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, borderRadius: 999, padding: "2px 8px",
      display: "inline-flex", alignItems: "center", gap: 3,
      whiteSpace: "nowrap", opacity: tone === "mut" ? 0.75 : 1,
      ...style,
    }}>{children}</span>
  );
}

// 마진 막대 — 2026-07-24 v4.1 (사장님 확정): 기간 전체 회사 마진에서 차지하는 비중.
//   "오늘 번 돈은 누가 만들었나"가 한눈에. (1위 대비·마진율 이중 표시 폐기.)
function MarginBar({ t, share, color }) {
  const w = Math.max(0, Math.min(100, Math.round((share || 0) * 100)));
  return (
    <div style={{
      height: 8, background: t.bgInset || "rgba(128,128,128,0.12)",
      borderRadius: "0 4px 4px 0", overflow: "hidden", position: "relative",
      marginTop: 8,
    }}>
      <span style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${w}%`, background: color, borderRadius: "0 4px 4px 0" }}/>
    </div>
  );
}

// 2026-07-20 — 5종 통일. workTypeKind.getServiceKind 사용 (설치/누설/기타 정확 분류).
//   옛 자체 3종 (cleaning/refrigerant/other) 폐기 — 누설·설치가 "기타" 로 뭉치는 사고 해결.
function kindOfTask(task) {
  return SERVICE_KIND_META[getServiceKind(task)] || SERVICE_KIND_META.other;
}

// 2026-06-26 — onEngineerClick: 모바일에서 기사 행 클릭 시 부모(AdminApp) 로 올려 화면 전환.
//   PC 는 같은 화면 안에서 모달(EngineerTaskModal) 로 처리 — onEngineerClick 미호출.
export function RevenueDetailScreen({ t, apiTasks = [], user, onBack, onTaskClick, onEngineerClick }) {
  const isPc = useIsPc();
  // 2026-06-26 — PC 모달 상태. 모바일은 부모로 onEngineerClick 콜백 → 화면 전환.
  const [selectedEngineer, setSelectedEngineer] = useState(null);
  // 2026-06-16 — 탭 상태 (원청별 / 기사별 / 작업별).
  const [tab, setTab] = useState("principal"); // 'principal' | 'engineer' | 'task'
  // 2026-07-09 — 기간 mode: 'day' | 'month'. 기본 'month' (기존 동작 보존).
  //   · day  → startYmd = endYmd = selectedDay (KST toKstYmd 매칭)
  //   · month → getMonthRange(year, month)
  //   · 원청별/기사별/작업별 3탭 모두 이 mode 로 통합 집계.
  const today = todayYmd();
  const [y0, m0] = today.split("-").map(Number);
  // 2026-07-09 — 진입 기본 'day' (오늘). 월별 토글은 유지.
  const [mode, setMode] = useState("day"); // 'day' | 'month'
  const [year, setYear]   = useState(y0);
  const [month, setMonth] = useState(m0);
  const [selectedDay, setSelectedDay] = useState(today); // "YYYY-MM-DD"
  const dayPickerRef = useRef(null);

  function prevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else             { setMonth(month - 1); }
  }
  function nextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else              { setMonth(month + 1); }
  }
  // 2026-07-09 — 일별 이동. year/month state 도 selectedDay 에 맞춰 sync.
  function shiftDay(delta) {
    const next = shiftYmd(selectedDay, delta);
    setSelectedDay(next);
    const [ny, nm] = next.split("-").map(Number);
    setYear(ny);
    setMonth(nm);
  }
  function openDayPicker() {
    const el = dayPickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch (_) {}
    }
    el.focus();
    el.click();
  }
  function handleDayPickerChange(e) {
    const v = e.target.value;
    if (!v) return;
    setSelectedDay(v);
    const [ny, nm] = v.split("-").map(Number);
    setYear(ny);
    setMonth(nm);
  }

  // 2026-07-09 — 3탭 공용 기간. mode 에 따라 자동 결정.
  const { start: startYmd, end: endYmd } = useMemo(() => {
    if (mode === "day") return { start: selectedDay, end: selectedDay };
    return getMonthRange(year, month);
  }, [mode, selectedDay, year, month]);

  const summary = useMemo(
    () => computeRevenueByYmRange(apiTasks, startYmd, endYmd, user),
    [apiTasks, startYmd, endYmd, user]
  );
  const byPrincipal = useMemo(
    () => computeRevenueByPrincipal(apiTasks, startYmd, endYmd, user),
    [apiTasks, startYmd, endYmd, user]
  );

  // 2026-07-09 — 원청별 접수/완료 카운트 (사장님 spec, 트랙 무관, KST 범위).
  //   · 접수 = createdAt KST in [startYmd, endYmd] + status !== "취소"
  //   · 완료 = completedAt KST in [startYmd, endYmd] + status === "완료"
  //   · byPrincipal 는 트랙 A 완료 매출 dataset 만 대상 → usol_n 원청은 이 화면 미노출 (원 정합).
  //   · 즉 접수/완료 병합은 byPrincipal 에 있는 원청 code 만 대상.
  const principalCounts = useMemo(() => {
    const received = new Map();
    const done     = new Map();
    for (const t of (apiTasks || [])) {
      if (!t) continue;
      const code = String(t.principalCode || t.principal_code || "").trim();
      if (!code) continue;
      const created = t.createdAt || t.created_at;
      if (created && t.status !== "취소") {
        const k = toKstYmd(created);
        if (k && k >= startYmd && k <= endYmd) {
          received.set(code, (received.get(code) || 0) + 1);
        }
      }
      const completed = t.completedAt || t.completed_at;
      if (completed && t.status === "완료") {
        const k = toKstYmd(completed);
        if (k && k >= startYmd && k <= endYmd) {
          done.set(code, (done.get(code) || 0) + 1);
        }
      }
    }
    return { received, done };
  }, [apiTasks, startYmd, endYmd]);

  // byPrincipal + 접수/완료 병합.
  const byPrincipalWithCounts = useMemo(() => {
    return byPrincipal.map(row => ({
      ...row,
      received: principalCounts.received.get(row.code) || 0,
      done:     principalCounts.done.get(row.code)     || 0,
    }));
  }, [byPrincipal, principalCounts]);

  // 2026-07-09 — 기사별 / 작업별 자체 "오늘/이번달" 토글 폐기.
  //   상위 mode (day/month) 로 통합 → startYmd/endYmd 를 그대로 사용.
  //   owner_amount(회사 마진) 내림차순.
  const byEngineer = useMemo(() => {
    const raw = computeRevenueByEngineer(apiTasks, startYmd, endYmd, user);
    return raw.slice().sort((a, b) => (b.owner || 0) - (a.owner || 0));
  }, [apiTasks, startYmd, endYmd, user]);

  // ── 2026-07-24 — v4 재설계 (사장님 확정: "이 화면의 주인공은 회사 마진").
  //   [1] 기간 상태 카운트 — 완료 / 진행·대기 / 🚗 출장 전환 / ✗ 취소 (히어로 칩).
  //   기준: 완료·출장 = completedAt (없으면 예정일), 취소 = 취소시각(없으면 예정일),
  //         진행·대기 = 예정일이 기간 안인데 아직 종결 안 된 작업. best-effort 근사.
  const statusCounts = useMemo(() => {
    let done = 0, visit = 0, canceled = 0, pending = 0;
    const inRange = (ymd) => ymd && ymd >= startYmd && ymd <= endYmd;
    for (const tk of (apiTasks || [])) {
      if (!tk) continue;
      const sched = toKstYmd(tk.scheduledDate || tk.scheduled_date || tk.requestedDate || tk.workDate || "") || "";
      const comp  = toKstYmd(tk.completedAt || tk.completed_at || "") || "";
      if (tk.status === "완료") {
        if (inRange(comp)) done++;
      } else if (tk.status === "visit_only") {
        if (inRange(comp || sched)) visit++;
      } else if (tk.status === "취소") {
        const cx = toKstYmd(tk.canceledAt || tk.canceled_at || "") || sched;
        if (inRange(cx)) canceled++;
      } else if (inRange(sched)) {
        pending++;
      }
    }
    return { done, visit, canceled, pending };
  }, [apiTasks, startYmd, endYmd]);

  //   [2] 기사별 배정/완료/출장/취소/대기 집계 (사장님 spec: "오늘 몇 건 중 몇 건
  //       완료했고 취소·출장비로 끝냈는지") + byEngineer(마진·매출) 병합 + 건당·완료율.
  const engineerStatMap = useMemo(() => {
    const map = new Map();
    const inRange = (ymd) => ymd && ymd >= startYmd && ymd <= endYmd;
    const bump = (name, key) => {
      if (!name) return;
      const row = map.get(name) || { assigned: 0, doneCnt: 0, visit: 0, canceled: 0 };
      row[key]++;
      map.set(name, row);
    };
    for (const tk of (apiTasks || [])) {
      if (!tk) continue;
      const name = String(tk.assignedEngineer || tk.engineer || "").trim();
      if (!name) continue;
      const sched = toKstYmd(tk.scheduledDate || tk.scheduled_date || tk.requestedDate || tk.workDate || "") || "";
      const comp  = toKstYmd(tk.completedAt || tk.completed_at || "") || "";
      if (tk.status === "완료") {
        if (inRange(comp)) { bump(name, "assigned"); bump(name, "doneCnt"); }
      } else if (tk.status === "visit_only") {
        if (inRange(comp || sched)) { bump(name, "assigned"); bump(name, "visit"); }
      } else if (tk.status === "취소") {
        const cx = toKstYmd(tk.canceledAt || tk.canceled_at || "") || sched;
        if (inRange(cx)) { bump(name, "assigned"); bump(name, "canceled"); }
      } else if (inRange(sched)) {
        bump(name, "assigned");
      }
    }
    return map;
  }, [apiTasks, startYmd, endYmd]);

  const [engSort, setEngSort] = useState("margin"); // 'margin' | 'per' | 'rate' (월별만 노출)
  const byEngineerV4 = useMemo(() => {
    const rows = byEngineer.map(row => {
      const st = engineerStatMap.get(String(row.name || "").trim()) || { assigned: 0, doneCnt: 0, visit: 0, canceled: 0 };
      const doneN = st.doneCnt || Number(row.count) || 0;
      const per   = doneN > 0 ? Math.round((row.owner || 0) / doneN) : 0;
      const rate  = st.assigned > 0 ? Math.round((doneN / st.assigned) * 100) : null;
      const waiting = Math.max(0, st.assigned - doneN - st.visit - st.canceled);
      return { ...row, ...st, doneN, per, rate, waiting };
    });
    const sorted = rows.slice();
    if (mode === "month" && engSort === "per")       sorted.sort((a, b) => (b.per || 0) - (a.per || 0));
    else if (mode === "month" && engSort === "rate") sorted.sort((a, b) => (b.rate || 0) - (a.rate || 0));
    else                                             sorted.sort((a, b) => (b.owner || 0) - (a.owner || 0));
    return sorted;
  }, [byEngineer, engineerStatMap, mode, engSort]);

  //   [3] 작업별 부록 — 기간 안 출장 전환·취소 건 (본 리스트·합계와 분리 표시).
  const extraTasks = useMemo(() => {
    const inRange = (ymd) => ymd && ymd >= startYmd && ymd <= endYmd;
    const out = [];
    for (const tk of (apiTasks || [])) {
      if (!tk) continue;
      const sched = toKstYmd(tk.scheduledDate || tk.scheduled_date || tk.requestedDate || tk.workDate || "") || "";
      const comp  = toKstYmd(tk.completedAt || tk.completed_at || "") || "";
      if (tk.status === "visit_only" && inRange(comp || sched)) out.push({ task: tk, extraKind: "visit" });
      else if (tk.status === "취소") {
        const cx = toKstYmd(tk.canceledAt || tk.canceled_at || "") || sched;
        if (inRange(cx)) out.push({ task: tk, extraKind: "cancel" });
      }
    }
    return out;
  }, [apiTasks, startYmd, endYmd]);

  // 2026-06-16 — 작업별 탭 종류 필터 (전체/세척/냉매/기타). 기간은 상위 mode.
  const [taskKind, setTaskKind] = useState("all"); // 'all' | 'cleaning' | 'refrigerant' | 'other'

  // 작업별 리스트 (필터 + 정렬). 합계 검산용.
  const { taskList, taskTotalRevenue, taskTotalOwner } = useMemo(() => {
    const raw = getTasksByYmRange(apiTasks, startYmd, endYmd, user);
    const filtered = taskKind === "all"
      ? raw
      : raw.filter(tk => kindOfTask(tk).key === taskKind);
    const sorted = filtered.slice().sort((a, b) => {
      const aT = Number(a.totalAmount || a.총금액 || a.estimateTotal || 0);
      const bT = Number(b.totalAmount || b.총금액 || b.estimateTotal || 0);
      return bT - aT;
    });
    const sumTotal = sorted.reduce((s, x) => s + Number(x.totalAmount || x.총금액 || x.estimateTotal || 0), 0);
    const sumOwner = sorted.reduce((s, x) => s + Number(x.owner_amount || 0), 0);
    return { taskList: sorted, taskTotalRevenue: sumTotal, taskTotalOwner: sumOwner };
  }, [apiTasks, startYmd, endYmd, user, taskKind]);

  const isDay = mode === "day";
  const periodLabel = isDay ? fmtDayLabel(selectedDay) : `${year}년 ${month}월`;

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
          📊 매출 자세히
        </div>
      </div>

      {/* 2026-07-09 — 일별/월별 mode 세그먼트 + 기간 네비 */}
      <div style={{ padding: "14px 16px 0" }}>
        {/* mode 세그먼트 */}
        <div style={{
          display: "flex", gap: 4,
          padding: 3,
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          borderRadius: 999,
          marginBottom: 10,
          width: "fit-content",
        }}>
          {[
            { id: "day",   label: "일별" },
            { id: "month", label: "월별" },
          ].map(opt => {
            const on = mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                style={{
                  padding: "5px 16px",
                  background: on ? t.accent : "transparent",
                  border: "none",
                  borderRadius: 999,
                  color: on ? "#fff" : t.textSecondary,
                  fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
            );
          })}
        </div>
        {/* 기간 네비 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          padding: "10px 14px",
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          marginBottom: 14,
          position: "relative",
        }}>
          <button
            onClick={() => isDay ? shiftDay(-1) : prevMonth()}
            style={navBtnStyle(t)}
            aria-label={isDay ? "이전 날" : "이전 달"}>
            <ChevronLeft size={18}/>
          </button>
          <div style={{
            fontSize: 15, fontWeight: 800, color: t.text,
            minWidth: 130, textAlign: "center",
          }}>
            {periodLabel}
          </div>
          <button
            onClick={() => isDay ? shiftDay(1) : nextMonth()}
            style={navBtnStyle(t)}
            aria-label={isDay ? "다음 날" : "다음 달"}>
            <ChevronRight size={18}/>
          </button>
          {/* 일별 mode 에서만 달력 아이콘 (특정일 선택) */}
          {isDay && (
            <>
              <button
                onClick={openDayPicker}
                style={{ ...navBtnStyle(t), marginLeft: 4 }}
                aria-label="날짜 선택">
                <Calendar size={16}/>
              </button>
              {/* 숨겨진 native date picker (달력 아이콘 클릭 시 열림) */}
              <input
                ref={dayPickerRef}
                type="date"
                value={selectedDay}
                onChange={handleDayPickerChange}
                style={{
                  position: "absolute",
                  opacity: 0, pointerEvents: "none",
                  width: 1, height: 1, right: 12,
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* 2026-07-24 v4 — 마진 히어로 (사장님 확정: 큰 숫자 = 회사 마진, 메인 핑크).
          매출·마진율·프로·원청은 회색 보조 줄, 상태(완료/진행/출장/취소)는 칩. */}
      <div style={{ padding: "0 16px 4px" }}>
        <div style={{
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          borderTop: `3px solid ${t.accent}`,
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 14,
          fontVariantNumeric: "tabular-nums",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted }}>
            {isDay ? "오늘 회사 마진" : "이 달 회사 마진"}
          </div>
          <div className="mono" style={{
            fontSize: 26, fontWeight: 900, color: t.accent,
            letterSpacing: "-0.5px", marginTop: 2,
          }}>{fmtKRW(summary.owner)}</div>
          <div className="mono" style={{
            fontSize: 11, color: t.textSecondary, fontWeight: 600, marginTop: 4,
          }}>
            매출 {fmtKRW(summary.total)}
            {summary.total > 0 ? ` · 마진율 ${Math.round((summary.owner / summary.total) * 100)}%` : ""}
          </div>
          <div className="mono" style={{
            fontSize: 10.5, color: t.textMuted, fontWeight: 600, marginTop: 2,
          }}>
            프로 {fmtKRW(summary.engineer)} · 원청 {fmtKRW(summary.principal)} · {summary.count}건
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 9, flexWrap: "wrap" }}>
            <StatusChip tone="ok">✓ 완료 {statusCounts.done}</StatusChip>
            {statusCounts.pending > 0 && <StatusChip tone="mut">진행·대기 {statusCounts.pending}</StatusChip>}
            {statusCounts.visit > 0 && <StatusChip tone="warn">🚗 출장 {statusCounts.visit}</StatusChip>}
            {statusCounts.canceled > 0 && <StatusChip tone="bad">✗ 취소 {statusCounts.canceled}</StatusChip>}
          </div>
        </div>

        {/* 2026-06-16 — 탭 바 (원청별 / 기사별 / 작업별) */}
        <TabBar t={t} tab={tab} setTab={setTab}/>

        {/* 2026-07-24 v4 — 마진 색 범례 (카드 안 "마진" 라벨 반복 제거 — 사장님 spec) */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 9.5, color: t.textMuted, fontWeight: 600,
          margin: "0 2px 8px",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 3, background: MARGIN_GREEN, display: "inline-block" }}/>
          초록 금액 = 회사 마진
          <span style={{ marginLeft: "auto" }}>
            {tab === "principal" && `${byPrincipalWithCounts.length}개 · 마진 내림차순`}
            {tab === "engineer" && `${byEngineerV4.length}명`}
          </span>
        </div>

        {/* 원청별 — 2026-07-24 v4: 마진 큰 초록 숫자 + 매출·마진율 보조 + 비중 막대 */}
        {tab === "principal" && (
          <PrincipalCardList t={t}
            rows={byPrincipalWithCounts.slice().sort((a, b) => (b.owner || 0) - (a.owner || 0))}
            totalOwner={summary.owner}
            emptyText={`${isDay ? "이 날" : "이 달"} 매출 데이터 없음`}/>
        )}

        {/* 기사별 — 2026-07-24 v4: 카드형 (마진 주인공 + 배정/완료/출장/취소 칩 + 건당).
             월별 모드는 정렬 3종 (총마진/건당/완료율 — 사장님 spec "건수 대비 마진"). */}
        {tab === "engineer" && (
          <>
            {mode === "month" && (
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                {[
                  { id: "margin", label: "총마진순" },
                  { id: "per",    label: "건당순" },
                  { id: "rate",   label: "완료율순" },
                ].map(opt => {
                  const on = engSort === opt.id;
                  return (
                    <button key={opt.id} type="button" onClick={() => setEngSort(opt.id)} style={{
                      padding: "5px 11px", borderRadius: 999,
                      background: on ? (t.accentBg || "rgba(255,27,141,0.1)") : "transparent",
                      border: `1px solid ${on ? t.accent : t.border}`,
                      color: on ? t.accent : t.textSecondary,
                      fontSize: 10.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                    }}>{opt.label}</button>
                  );
                })}
              </div>
            )}
            <EngineerCardListV4 t={t}
              rows={byEngineerV4}
              totalOwner={summary.owner}
              emptyText={`${isDay ? "이 날" : "이 달"} 회사 마진 데이터 없음`}
              onRowClick={(row) => {
                // 클릭 시점 상위 mode 기간 그대로 이어받기.
                const payload = {
                  ...row,
                  startYmd,
                  endYmd,
                  periodLabel: isDay ? fmtDayLabel(selectedDay) : `${year}년 ${month}월`,
                };
                if (isPc) {
                  setSelectedEngineer(payload);
                } else {
                  onEngineerClick?.(payload);
                }
              }}
            />
          </>
        )}

        {/* 작업별 — PC=표, 모바일=카드. 상위 mode 기간, 종류 필터(전체/세척/냉매/기타). */}
        {tab === "task" && (
          <TaskView
            t={t}
            isPc={isPc}
            isDay={isDay}
            tasks={taskList}
            sumTotal={taskTotalRevenue}
            sumOwner={taskTotalOwner}
            kind={taskKind}
            setKind={setTaskKind}
            onTaskClick={onTaskClick}
            extraTasks={extraTasks}
          />
        )}
      </div>

      {/* 2026-06-26 — PC 기사 클릭 모달 (모바일은 부모 화면 전환 사용). */}
      {isPc && selectedEngineer && (
        <EngineerTaskModal
          t={t}
          apiTasks={apiTasks}
          user={user}
          engineer={selectedEngineer}
          startYmd={selectedEngineer.startYmd}
          endYmd={selectedEngineer.endYmd}
          periodLabel={selectedEngineer.periodLabel}
          onClose={() => setSelectedEngineer(null)}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 탭 바 (원청별 / 기사별 / 작업별)
// ──────────────────────────────────────────────────────────────────
function TabBar({ t, tab, setTab }) {
  const tabs = [
    { id: "principal", label: "원청별" },
    { id: "engineer",  label: "기사별" },
    { id: "task",      label: "작업별" },
  ];
  return (
    <div style={{
      display: "flex", gap: 4,
      marginBottom: 10,
      borderBottom: `1px solid ${t.border}`,
      paddingBottom: 0,
    }}>
      {tabs.map(opt => {
        const active = tab === opt.id;
        return (
          <button key={opt.id} type="button"
            onClick={() => setTab(opt.id)}
            style={{
              padding: "8px 14px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${active ? t.accent : "transparent"}`,
              color: active ? t.accent : t.textSecondary,
              fontSize: 13, fontWeight: active ? 800 : 600,
              cursor: "pointer", fontFamily: "inherit",
              marginBottom: -1,
            }}>{opt.label}</button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 작업별 뷰 — PC=표 / 모바일=카드. 기간·종류 필터 + 하단 합계.
// ──────────────────────────────────────────────────────────────────
function TaskView({ t, isPc, isDay, tasks, sumTotal, sumOwner, kind, setKind, onTaskClick, extraTasks = [] }) {
  return (
    <>
      {/* 2026-07-09 — 자체 기간 토글 폐기 (상위 mode 사용). 종류 필터만 유지. */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8,
        marginTop: 4, marginBottom: 10,
        alignItems: "center",
      }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            { id: "all", label: "전체" },
            ...SERVICE_KIND_ORDER.map(k => ({ id: k, label: SERVICE_KIND_META[k].label })),
          ].map(opt => {
            const active = kind === opt.id;
            return (
              <button key={opt.id} type="button"
                onClick={() => setKind(opt.id)}
                style={{
                  padding: "5px 10px",
                  background: active ? (t.bgInset || "rgba(255,255,255,0.06)") : "transparent",
                  border: `1px solid ${active ? t.text : t.border}`,
                  borderRadius: 999,
                  color: active ? t.text : t.textSecondary,
                  fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
            );
          })}
        </div>
        <span style={{
          marginLeft: "auto",
          fontSize: 11, color: t.textMuted, fontWeight: 700,
        }}>
          {tasks.length}건
        </span>
      </div>

      {tasks.length === 0 ? (
        <div style={{
          padding: "30px 14px", textAlign: "center",
          color: t.textMuted, fontSize: 12,
          background: t.bgElevated, border: `1px solid ${t.border}`,
          borderRadius: 10, marginBottom: 14,
        }}>{isDay ? "이 날" : "이 달"} / 선택 종류의 작업이 없음</div>
      ) : isPc ? (
        <TaskTable t={t} tasks={tasks} onTaskClick={onTaskClick}/>
      ) : (
        <TaskCardList t={t} tasks={tasks} onTaskClick={onTaskClick}/>
      )}

      {/* 2026-07-24 v4 — 부록: 기간 안 🚗 출장 전환·✗ 취소 건 (본 합계와 분리, 모바일만).
          사장님 spec: "취소나 출장비를 받아서 끝냈는지도 궁금" — 그날 전체 그림 제공. */}
      {!isPc && extraTasks.length > 0 && (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: t.textMuted, margin: "2px 2px 6px" }}>
            그 외 — 출장 전환 {extraTasks.filter(e => e.extraKind === "visit").length}건 ·
            취소 {extraTasks.filter(e => e.extraKind === "cancel").length}건 (합계 제외)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {extraTasks.map(({ task, extraKind }, i) => {
              const isVisit = extraKind === "visit";
              const owner = Number(task.owner_amount || 0);
              const travel = Number(task.travelFee || task.travel_fee || task.totalAmount || 0);
              return (
                <button key={task.id || i} type="button"
                  onClick={() => onTaskClick && onTaskClick(task)}
                  style={{
                    background: t.bgElevated, border: `1px solid ${t.border}`,
                    borderRadius: 10, padding: "10px 14px",
                    cursor: onTaskClick ? "pointer" : "default",
                    fontFamily: "inherit", textAlign: "left",
                    opacity: isVisit ? 0.9 : 0.7, width: "100%",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, color: t.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{task.customer || task.customerName || "—"}</span>
                    <StatusChip tone={isVisit ? "warn" : "bad"}>{isVisit ? "🚗 출장 전환" : "✗ 취소"}</StatusChip>
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    marginTop: 5,
                  }}>
                    <span style={{ fontSize: 10.5, color: t.textSecondary, fontWeight: 600 }}>
                      {task.principal || task.principalName || "—"} · {task.assignedEngineer || task.engineer || "—"}
                    </span>
                    <span className="mono" style={{
                      fontSize: 12.5, fontWeight: 800,
                      color: isVisit ? MARGIN_GREEN : t.textMuted,
                    }}>{isVisit ? `${fmtKRW(owner)}${travel > 0 ? ` / 출장비 ${fmtKRW(travel)}` : ""}` : fmtKRW(0)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* 하단 합계 — 매출현황 총매출 검산용. 2026-07-24 v4: 마진(초록) 우선. */}
      {tasks.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr auto auto",
          gap: 16, alignItems: "baseline",
          padding: "12px 14px",
          background: t.bgElevated, border: `1px solid ${t.border}`,
          borderRadius: 10, marginBottom: 14,
          fontVariantNumeric: "tabular-nums",
        }}>
          <span style={{ fontSize: 12, color: t.text, fontWeight: 800 }}>
            합계 ({tasks.length}건)
          </span>
          <span className="mono" style={{
            fontSize: 12, fontWeight: 700, color: t.textMuted,
            letterSpacing: "-0.3px",
          }}>매출 {fmtKRW(sumTotal)}</span>
          <span className="mono" style={{
            fontSize: 13, fontWeight: 800, color: MARGIN_GREEN,
            letterSpacing: "-0.3px", minWidth: 100, textAlign: "right",
          }}>{fmtKRW(sumOwner)}</span>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// 작업별 PC 표 — 고객명 / 원청 / 기사 / 종류(뱃지) / 매출 / 회사 마진(핑크)
// ──────────────────────────────────────────────────────────────────
function TaskTable({ t, tasks, onTaskClick }) {
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 10, overflow: "hidden", marginBottom: 14,
      fontVariantNumeric: "tabular-nums",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto minmax(0, 1.2fr) minmax(0, 1.2fr)",
        gap: 10,
        padding: "9px 14px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgInset || "rgba(255,255,255,0.02)",
      }}>
        <Th t={t} align="left">고객명</Th>
        <Th t={t} align="left">원청</Th>
        <Th t={t} align="left">기사</Th>
        <Th t={t} align="center">종류</Th>
        <Th t={t} align="right">매출</Th>
        <Th t={t} align="right">회사 마진</Th>
      </div>
      {/* 행 */}
      {tasks.map((task, idx) => {
        const kind = kindOfTask(task);
        const total = Number(task.totalAmount || task.총금액 || task.estimateTotal || 0);
        const owner = Number(task.owner_amount || 0);
        return (
          <button
            key={task.id || idx}
            type="button"
            onClick={() => onTaskClick && onTaskClick(task)}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto minmax(0, 1.2fr) minmax(0, 1.2fr)",
              gap: 10, width: "100%",
              padding: "10px 14px",
              borderTop: idx === 0 ? "none" : `1px solid ${t.border}`,
              background: "transparent", border: "none",
              cursor: onTaskClick ? "pointer" : "default",
              fontFamily: "inherit",
              alignItems: "center",
              textAlign: "left",
            }}>
            <Td t={t} align="left" strong>{task.customer || task.customerName || "—"}</Td>
            <Td t={t} align="left">{task.principal || task.principalName || "—"}</Td>
            <Td t={t} align="left">{task.assignedEngineer || task.engineer || "—"}</Td>
            <Td t={t} align="center"><KindBadge kind={kind}/></Td>
            <Td t={t} align="right" mono>{fmtKRW(total)}</Td>
            <Td t={t} align="right" mono green>{fmtKRW(owner)}</Td>
          </button>
        );
      })}
    </div>
  );
}

function Th({ t, align, children }) {
  return (
    <div style={{
      fontSize: 10, color: t.textMuted, fontWeight: 700,
      letterSpacing: 0.3,
      textAlign: align,
    }}>{children}</div>
  );
}

function Td({ t, align, children, strong, mono, accent, green }) {
  return (
    <div className={mono ? "mono" : ""} style={{
      fontSize: 12,
      fontWeight: strong ? 800 : 600,
      color: green ? MARGIN_GREEN : (accent ? t.accent : t.text),
      textAlign: align,
      letterSpacing: mono ? "-0.3px" : 0,
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      fontVariantNumeric: mono ? "tabular-nums" : "normal",
    }}>{children}</div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 작업별 모바일 카드 — 동일 정보, 카드 형태.
// ──────────────────────────────────────────────────────────────────
function TaskCardList({ t, tasks, onTaskClick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
      {tasks.map((task, idx) => {
        const kind = kindOfTask(task);
        const total = Number(task.totalAmount || task.총금액 || task.estimateTotal || 0);
        const owner = Number(task.owner_amount || 0);
        // 2026-06-19 — 종류·수량 압축 결합 (사장님 spec: 원청·기사 줄 끝에).
        const itemSummary = (() => {
          const items = Array.isArray(task.workItems) ? task.workItems : [];
          const live = items.filter(it => !(it.isCanceled ?? it.is_canceled));
          if (live.length === 0) return "";
          const first = live[0];
          const label = first.appliance || first.applianceLabel || first.workType || "";
          const qty = Number(first.qty) || 1;
          if (!label) return "";
          const more = live.length - 1;
          return more > 0 ? `${label} 외 ${more}` : `${label} ×${qty}`;
        })();
        return (
          <button
            key={task.id || idx}
            type="button"
            onClick={() => onTaskClick && onTaskClick(task)}
            style={{
              background: t.bgElevated,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              padding: "12px 14px",
              cursor: onTaskClick ? "pointer" : "default",
              fontFamily: "inherit",
              textAlign: "left",
              display: "flex", flexDirection: "column", gap: 8,
              fontVariantNumeric: "tabular-nums",
            }}>
            {/* 1줄 — 고객명 + 종류 뱃지 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                flex: 1, minWidth: 0,
                fontSize: 14, fontWeight: 800, color: t.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{task.customer || task.customerName || "—"}</span>
              <KindBadge kind={kind}/>
            </div>
            {/* 2줄 — 원청 · 기사 · 종류수량 (2026-06-19) */}
            <div style={{ fontSize: 11, color: t.textSecondary, fontWeight: 600 }}>
              {task.principal || task.principalName || "—"} · {task.assignedEngineer || task.engineer || "—"}
              {itemSummary ? ` · ${itemSummary}` : ""}
            </div>
            {/* 3줄 — 2026-07-24 v4: 마진(초록 큰 숫자, 좌) + 매출(회색 보조, 우).
                 "마진" 라벨은 상단 범례가 전담 — 사장님 spec. */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              paddingTop: 4, borderTop: `1px dashed ${t.border}`,
            }}>
              <span className="mono" style={{
                fontSize: 15, fontWeight: 900, color: MARGIN_GREEN,
                letterSpacing: "-0.4px",
              }}>{fmtKRW(owner)}</span>
              <span className="mono" style={{
                fontSize: 11, fontWeight: 600, color: t.textMuted,
                letterSpacing: "-0.3px",
              }}>매출 {fmtKRW(total)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function KindBadge({ kind }) {
  return (
    <span style={{
      background: `${kind.color}22`,
      color: kind.color,
      fontSize: 10, fontWeight: 800,
      padding: "3px 8px", borderRadius: 999,
      whiteSpace: "nowrap",
    }}>{kind.label}</span>
  );
}

function navBtnStyle(t) {
  return {
    background: "transparent",
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
    color: t.text,
    display: "flex", alignItems: "center",
    fontFamily: "inherit",
  };
}

function SummaryBox({ t, icon, label, value, accent }) {
  return (
    <div style={{
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12 }}>{icon}</span>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>
          {label}
        </span>
      </div>
      <div className="mono" style={{
        fontSize: 17, fontWeight: 800,
        color: accent ? t.accent : t.text,
        letterSpacing: "-0.3px",
      }}>
        {fmtKRW(value)}
      </div>
    </div>
  );
}

function SectionHeader({ t, title, sub, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      marginTop: 10, marginBottom: 6,
    }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{title}</span>
      {sub && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>{sub}</span>}
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}

// 2026-06-19 — 원청별 카드형 (사장님 spec: 매출/마진 세로 쌓기).
// 2026-07-09 — 접수/완료 컬럼 추가 (사장님 spec):
//   · 접수 = 선택 기간 createdAt KST + 취소 제외
//   · 완료 = 선택 기간 completedAt KST + status='완료'
//   1줄: 원청명(좌) + 접수 M · 완료 N(우)
//   2줄: 매출 ₩... (좌, accent) · 마진 ₩... (우, text)
// 2026-07-24 v4 — 마진이 주인공 (사장님 확정):
//   1줄: 원청명 + [완료 N / 접수 M] 칩
//   2줄: 초록 마진 큰 숫자 (좌) · 매출 ₩ + 마진율 % (우, 회색 보조)
//   3줄: 마진 막대 — 연한 = 1위 대비, 진한 = 마진율.
function PrincipalCardList({ t, rows, totalOwner = 0, emptyText }) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{
        padding: "18px 14px", textAlign: "center",
        color: t.textMuted, fontSize: 12,
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 10, marginBottom: 14,
      }}>{emptyText}</div>
    );
  }
  const denom = Math.max(1, Number(totalOwner) || 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      {rows.map((row, idx) => {
        const owner = Number(row.owner) || 0;
        const total = Number(row.total) || 0;
        const rate  = total > 0 ? owner / total : 0;
        const share = owner / denom;
        return (
          <div key={(row.code || row.id || row.name || idx) + "_" + idx} style={{
            background: t.bgElevated,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: "11px 14px",
            fontVariantNumeric: "tabular-nums",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontSize: 13, fontWeight: 800, color: t.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                minWidth: 0, flex: 1,
              }}>{row.name || "—"}</span>
              <StatusChip tone="mut">완료 {row.done || 0} / 접수 {row.received || 0}</StatusChip>
            </div>
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              gap: 10, marginTop: 6,
            }}>
              <span className="mono" style={{
                fontSize: 16, fontWeight: 900, color: MARGIN_GREEN,
                letterSpacing: "-0.4px", whiteSpace: "nowrap",
              }}>{fmtKRW(owner)}</span>
              <span className="mono" style={{
                fontSize: 11, fontWeight: 600, color: t.textMuted,
                whiteSpace: "nowrap",
              }}>매출 {fmtKRW(total)}{total > 0 ? ` · ${Math.round(rate * 100)}%` : ""}</span>
            </div>
            <MarginBar t={t} share={share} color={MARGIN_GREEN}/>
            <div className="mono" style={{ fontSize: 9.5, color: t.textMuted, marginTop: 4 }}>
              전체 마진의 {Math.round(share * 100)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 2026-07-24 v4 — 기사별 카드 (사장님 확정):
//   1줄: 기사명 + 상태 칩 (✓ 완료/배정 · 🚗 출장 · ✗ 취소 · 대기)
//   2줄: 초록 마진 큰 숫자 · 매출 보조
//   3줄: 청록 막대 (1위 대비 / 진한 = 마진율) + 건당 ₩ 풋노트.
function EngineerCardListV4({ t, rows, totalOwner = 0, emptyText, onRowClick }) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{
        padding: "18px 14px", textAlign: "center",
        color: t.textMuted, fontSize: 12,
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 10, marginBottom: 14,
      }}>{emptyText}</div>
    );
  }
  const denom = Math.max(1, Number(totalOwner) || 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      {rows.map((row, idx) => {
        const owner = Number(row.owner) || 0;
        const total = Number(row.total) || 0;
        const share = owner / denom;
        return (
          <button
            key={(row.code || row.id || row.name || idx) + "_" + idx}
            type="button"
            onClick={() => onRowClick && onRowClick(row)}
            style={{
              background: t.bgElevated,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              padding: "11px 14px",
              cursor: onRowClick ? "pointer" : "default",
              fontFamily: "inherit", textAlign: "left",
              fontVariantNumeric: "tabular-nums",
              width: "100%",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 13, fontWeight: 800, color: t.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                minWidth: 0, flex: 1,
              }}>{row.name || "—"}</span>
              <span style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <StatusChip tone={row.rate != null && row.rate < 80 ? "warn" : "ok"}>
                  ✓ {row.doneN}{row.assigned > 0 ? `/${row.assigned}` : ""}{row.rate != null ? ` · ${row.rate}%` : ""}
                </StatusChip>
                {row.visit > 0 && <StatusChip tone="warn">🚗 {row.visit}</StatusChip>}
                {row.canceled > 0 && <StatusChip tone="bad">✗ {row.canceled}</StatusChip>}
                {row.waiting > 0 && <StatusChip tone="mut">대기 {row.waiting}</StatusChip>}
              </span>
            </div>
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              gap: 10, marginTop: 6,
            }}>
              <span className="mono" style={{
                fontSize: 16, fontWeight: 900, color: MARGIN_GREEN,
                letterSpacing: "-0.4px", whiteSpace: "nowrap",
              }}>{fmtKRW(owner)}</span>
              <span className="mono" style={{
                fontSize: 11, fontWeight: 600, color: t.textMuted, whiteSpace: "nowrap",
              }}>매출 {fmtKRW(total)}</span>
            </div>
            <MarginBar t={t} share={share} color={ENG_CYAN}/>
            <div className="mono" style={{ fontSize: 9.5, color: t.textMuted, marginTop: 4 }}>
              전체 마진의 {Math.round(share * 100)}%{row.per > 0 ? ` · 건당 ${fmtKRW(row.per)}` : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// 2026-06-26 — onRowClick 추가. 있으면 행을 button 으로 감싸 클릭 가능 (기사별 탭용).
function Table({ t, columns, rows, emptyText, onRowClick }) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{
        padding: "18px 14px", textAlign: "center",
        color: t.textMuted, fontSize: 12,
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 10, marginBottom: 14,
      }}>{emptyText}</div>
    );
  }
  const gridCols = columns.map(c => c.width || "minmax(0, 1fr)").join(" ");
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 10, overflow: "hidden", marginBottom: 14,
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: gridCols,
        gap: 8,
        padding: "8px 12px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgInset || "rgba(255,255,255,0.02)",
      }}>
        {columns.map(c => (
          <div key={c.key} style={{
            fontSize: 10, color: t.textMuted, fontWeight: 700,
            textAlign: c.align || "left",
          }}>{c.label}</div>
        ))}
      </div>
      {rows.map((row, idx) => {
        const inner = columns.map(c => {
          const v = row[c.key];
          const text = c.format ? c.format(v) : (v ?? "");
          return (
            <div key={c.key} className={c.format === fmtKRW ? "mono" : ""} style={{
              fontSize: 12, fontWeight: 700,
              color: c.accent ? t.accent : t.text,
              textAlign: c.align || "left",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{text}</div>
          );
        });
        const rowKey = (row.code || row.id || row.name || idx) + "_" + idx;
        const baseStyle = {
          display: "grid",
          gridTemplateColumns: gridCols,
          gap: 8,
          padding: "9px 12px",
          borderTop: idx === 0 ? "none" : `1px solid ${t.border}`,
          alignItems: "center",
        };
        if (onRowClick) {
          return (
            <button
              key={rowKey}
              type="button"
              onClick={() => onRowClick(row)}
              style={{
                ...baseStyle,
                width: "100%",
                background: "transparent", border: "none",
                cursor: "pointer", fontFamily: "inherit",
                textAlign: "left",
              }}
            >{inner}</button>
          );
        }
        return (
          <div key={rowKey} style={baseStyle}>{inner}</div>
        );
      })}
    </div>
  );
}

export default RevenueDetailScreen;
