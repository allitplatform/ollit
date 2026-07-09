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
  pickServiceCode,
} from "../../utils/revenueStats.js";
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

// 2026-06-16 — service code → 종류 라벨/색.
const SERVICE_KIND = {
  cleaning:    { key: "cleaning",    label: "세척", color: "#0EA5E9" },
  refrigerant: { key: "refrigerant", label: "냉매", color: "#FFB800" },
  other:       { key: "other",       label: "기타", color: "#9CA3AF" },
};
function kindOfTask(task) {
  const code = pickServiceCode(task);
  if (code === "cleaning")    return SERVICE_KIND.cleaning;
  if (code === "refrigerant") return SERVICE_KIND.refrigerant;
  return SERVICE_KIND.other;
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

      {/* 4 요약 */}
      <div style={{ padding: "0 16px 4px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <SummaryBox t={t} icon="💰" label="매출"        value={summary.total}     accent/>
          <SummaryBox t={t} icon="📈" label="회사 마진"    value={summary.owner}     accent/>
          <SummaryBox t={t} icon="👷" label="프로 정산"    value={summary.engineer}/>
          <SummaryBox t={t} icon="🤝" label="원청 수수료"  value={summary.principal}/>
        </div>
        <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 14 }}>
          {isDay ? "이 날" : "이 달"} {summary.count}건 · 트랙 A (유솔N·추가선택 제외)
        </div>

        {/* 2026-06-16 — 탭 바 (원청별 / 기사별 / 작업별) */}
        <TabBar t={t} tab={tab} setTab={setTab}/>

        {/* 원청별 — 카드형 세로 쌓기 (2026-06-19 사장님 spec) — 표 폐기, 잘림 0
              2026-07-09 — 각 카드에 접수/완료 건수 추가 (사장님 spec, KST 트랙 무관). */}
        {tab === "principal" && (
          <>
            <SectionHeader t={t} title="원청별" sub={`${byPrincipalWithCounts.length}개 · 매출 내림차순`}/>
            <PrincipalCardList t={t} rows={byPrincipalWithCounts} emptyText={`${isDay ? "이 날" : "이 달"} 매출 데이터 없음`}/>
          </>
        )}

        {/* 기사별 표 — 2026-07-09: 자체 토글 폐기, 상위 mode(일/월) 로 통합. */}
        {tab === "engineer" && (
          <>
            <SectionHeader
              t={t}
              title="기사별"
              sub={`${byEngineer.length}명 · 회사마진 내림차순`}
            />
            <Table t={t}
              columns={[
                { key: "name",  label: "기사",     align: "left",  width: "minmax(0, 1.4fr)" },
                { key: "count", label: "건수",     align: "right", width: "minmax(0, 0.7fr)" },
                { key: "owner", label: "회사 마진", align: "right", format: fmtKRW, accent: true, width: "minmax(0, 1.9fr)" },
              ]}
              rows={byEngineer}
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
function TaskView({ t, isPc, isDay, tasks, sumTotal, sumOwner, kind, setKind, onTaskClick }) {
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
            { id: "all",         label: "전체" },
            { id: "cleaning",    label: "세척" },
            { id: "refrigerant", label: "냉매" },
            { id: "other",       label: "기타" },
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

      {/* 하단 합계 — 매출현황 총매출 검산용. */}
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
            fontSize: 13, fontWeight: 800, color: t.text,
            letterSpacing: "-0.3px",
          }}>{fmtKRW(sumTotal)}</span>
          <span className="mono" style={{
            fontSize: 13, fontWeight: 800, color: t.accent,
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
            <Td t={t} align="right" mono accent>{fmtKRW(owner)}</Td>
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

function Td({ t, align, children, strong, mono, accent }) {
  return (
    <div className={mono ? "mono" : ""} style={{
      fontSize: 12,
      fontWeight: strong ? 800 : 600,
      color: accent ? t.accent : t.text,
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
            {/* 3줄 — 매출 + 회사 마진 (핑크) */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              paddingTop: 4, borderTop: `1px dashed ${t.border}`,
            }}>
              <div>
                <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginRight: 6 }}>매출</span>
                <span className="mono" style={{
                  fontSize: 13, fontWeight: 800, color: t.text,
                  letterSpacing: "-0.3px",
                }}>{fmtKRW(total)}</span>
              </div>
              <div>
                <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginRight: 6 }}>회사 마진</span>
                <span className="mono" style={{
                  fontSize: 14, fontWeight: 800, color: t.accent,
                  letterSpacing: "-0.3px",
                }}>{fmtKRW(owner)}</span>
              </div>
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
function PrincipalCardList({ t, rows, emptyText }) {
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      {rows.map((row, idx) => (
        <div key={(row.code || row.id || row.name || idx) + "_" + idx} style={{
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          padding: "10px 14px",
          display: "flex", flexDirection: "column", gap: 6,
          fontVariantNumeric: "tabular-nums",
        }}>
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            gap: 10,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 800, color: t.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              minWidth: 0, flex: 1,
            }}>{row.name || "—"}</span>
            <span style={{
              display: "flex", alignItems: "baseline", gap: 8,
              fontSize: 11, fontWeight: 700, color: t.textSecondary,
              flexShrink: 0,
            }}>
              <span>
                <span style={{ fontSize: 10, color: t.textMuted, marginRight: 3 }}>접수</span>
                <span className="mono" style={{ color: t.text, fontWeight: 800 }}>{row.received || 0}</span>
              </span>
              <span style={{ color: t.textMuted }}>·</span>
              <span>
                <span style={{ fontSize: 10, color: t.textMuted, marginRight: 3 }}>완료</span>
                <span className="mono" style={{ color: t.text, fontWeight: 800 }}>{row.done || 0}</span>
              </span>
            </span>
          </div>
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            gap: 10,
            paddingTop: 5, borderTop: `1px dashed ${t.border}`,
          }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 0 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: t.textMuted,
                flexShrink: 0,
              }}>매출</span>
              <span className="mono" style={{
                fontSize: 13, fontWeight: 800, color: t.accent,
                letterSpacing: "-0.3px",
                whiteSpace: "nowrap",
              }}>{fmtKRW(row.total || 0)}</span>
            </span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 0 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: t.textMuted,
                flexShrink: 0,
              }}>마진</span>
              <span className="mono" style={{
                fontSize: 13, fontWeight: 800, color: t.text,
                letterSpacing: "-0.3px",
                whiteSpace: "nowrap",
              }}>{fmtKRW(row.owner || 0)}</span>
            </span>
          </div>
        </div>
      ))}
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
