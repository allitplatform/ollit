// 2026-06-12 — AdminApp PC 한 기사 주간/월간 달력 (Phase A: 주간만, 월간 = 다음 단계).
//   진입: 사이드바 "기사 달력" 또는 기사 그리드 카드 📅 버튼.
//   ⚠️ 데이터/로직 0줄 변경 — apiTasks 필터 (assignedEngineerId + 그 주). scheduledAt(KST) 기준.
//   ⚠️ 작업 클릭 → onTaskClick (Shell 우 aside 옛 패턴).
//   ⚠️ 모바일 옛 EngineerCalendarScreen 별개로 유지 (AdminApp.jsx PC 분기).

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";
import { getServiceKind } from "../utils/workTypeKind.js";

const KIND_COLOR = {
  cleaning:    "#0EA5E9",
  refrigerant: "#FFB800",
};
const KIND_COLOR_FALLBACK = "#9CA3AF";

const WEEKDAYS_KR = ["월", "화", "수", "목", "금", "토", "일"];

function pad(n) { return String(n).padStart(2, "0"); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseYmd(s) {
  const [y, m, d] = (s || "").split("-").map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
}
// 월요일 시작 주 (사장님 spec).
function startOfWeekMon(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();   // 0=일 ~ 6=토
  const offset = day === 0 ? -6 : 1 - day;  // 일 → -6, 월 → 0, ..., 토 → -5
  d.setDate(d.getDate() + offset);
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function formatMd(date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
function formatHm(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}시`;
}

export function AdminPcEngineerCalendarScreen({
  apiTasks = [], apiEngineers = [],
  engineerId, setEngineerId,
  onTaskClick,
}) {
  // 첫 진입 default — calEngineerId null + apiEngineers 있으면 첫 기사.
  useEffect(() => {
    if (engineerId == null && Array.isArray(apiEngineers) && apiEngineers.length > 0) {
      if (typeof setEngineerId === "function") setEngineerId(apiEngineers[0].id);
    }
  }, [apiEngineers, engineerId, setEngineerId]);

  const engineer = useMemo(
    () => (apiEngineers || []).find(e => e.id === engineerId) || null,
    [apiEngineers, engineerId]
  );

  // 주 — 오늘이 속한 주 (월~일) default. ← / → 로 주 이동.
  const todayDate = useMemo(() => parseYmd(todayYmd()), []);
  const [weekStart, setWeekStart] = useState(() => startOfWeekMon(todayDate));
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));
    return days;
  }, [weekStart]);

  // 모드 — 주간만 (월간 = Phase B, 토글은 보이되 disabled).
  const [mode, setMode] = useState("week");

  // 그 주 그 기사 작업 — apiTasks filter (scheduledAt KST ymd).
  const weekTasks = useMemo(() => {
    if (!engineerId) return [];
    const sYmd = ymd(weekStart);
    const eYmd = ymd(weekEnd);
    return (apiTasks || []).filter(t => {
      if (!t) return false;
      const eid = t.assignedEngineerId || t.assigned_engineer_id;
      if (eid !== engineerId) return false;
      const sched = t.scheduledAt || t.scheduled_at;
      if (!sched) return false;
      const k = toKstYmd(sched);
      return k >= sYmd && k <= eYmd;
    });
  }, [apiTasks, engineerId, weekStart, weekEnd]);

  const byDate = useMemo(() => {
    const map = new Map();
    for (const t of weekTasks) {
      const sched = t.scheduledAt || t.scheduled_at;
      const k = toKstYmd(sched);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ai = a.scheduledAt || a.scheduled_at || "";
        const bi = b.scheduledAt || b.scheduled_at || "";
        return String(ai).localeCompare(String(bi));
      });
    }
    return map;
  }, [weekTasks]);

  // 기사 지역 (workTypes.cleaning.zones + refrigerant.zones unique, 최대 3 + 외N).
  const engineerZones = useMemo(() => {
    if (!engineer) return "";
    const set = new Set();
    const wt = engineer.workTypes || {};
    for (const k of ["cleaning", "refrigerant"]) {
      const arr = (wt[k] && Array.isArray(wt[k].zones)) ? wt[k].zones : [];
      for (const z of arr) set.add(z);
    }
    const arr = Array.from(set);
    if (arr.length === 0) return "";
    if (arr.length <= 3) return arr.join(" · ");
    return `${arr.slice(0, 3).join(" · ")} 외 ${arr.length - 3}`;
  }, [engineer]);

  const todayY = todayYmd();

  return (
    <div style={{
      padding: "20px 24px 24px",
      display: "flex", flexDirection: "column",
      gap: 14,
    }}>
      {/* 헤더 — 기사명+지역 / 주간·월간 토글 / 기간 네비 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <div style={{
            fontSize: 20, fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.4px",
          }}>
            {engineer ? engineer.name : "기사 미선택"}
            <span style={{
              marginLeft: 10,
              fontSize: 12, fontWeight: 600,
              color: "var(--text-secondary)",
            }}>{weekTasks.length}건 / 주</span>
          </div>
          {engineerZones && (
            <div style={{
              fontSize: 12, color: "var(--text-secondary)", fontWeight: 600,
            }}>{engineerZones}</div>
          )}
        </div>

        {/* 주간 / 월간 토글 */}
        <div style={{
          display: "flex",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 2,
        }}>
          <ToggleBtn label="주간" active={mode === "week"}
            onClick={() => setMode("week")}/>
          <ToggleBtn label="월간" active={mode === "month"}
            onClick={() => setMode("month")} disabled title="다음 단계"/>
        </div>

        {/* 기간 네비 — 주간 모드만 */}
        {mode === "week" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NavBtn onClick={() => setWeekStart(d => addDays(d, -7))} ariaLabel="이전 주">
              <ChevronLeft size={16}/>
            </NavBtn>
            <button onClick={() => setWeekStart(startOfWeekMon(todayDate))}
              style={{
                padding: "7px 14px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 7,
                color: "var(--text-primary)",
                fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                minWidth: 150, textAlign: "center",
              }}>
              {formatMd(weekStart)} ~ {formatMd(weekEnd)}
            </button>
            <NavBtn onClick={() => setWeekStart(d => addDays(d, 7))} ariaLabel="다음 주">
              <ChevronRight size={16}/>
            </NavBtn>
          </div>
        )}
      </div>

      {/* 본문 */}
      {!engineer ? (
        <EmptyBox label="기사 미선택"/>
      ) : mode === "week" ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 8,
        }}>
          {weekDays.map((d, i) => {
            const dy = ymd(d);
            const isToday = dy === todayY;
            const tasks = byDate.get(dy) || [];
            return (
              <DayCell key={dy}
                date={d}
                weekday={WEEKDAYS_KR[i]}
                isToday={isToday}
                tasks={tasks}
                onTaskClick={onTaskClick}
              />
            );
          })}
        </div>
      ) : (
        <EmptyBox label="월간 보기 — 다음 단계"/>
      )}
    </div>
  );
}

function ToggleBtn({ label, active, onClick, disabled, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{
        padding: "6px 14px",
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#fff" : disabled ? "var(--text-tertiary)" : "var(--text-secondary)",
        border: "none",
        borderRadius: 6,
        fontSize: 12, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
      }}>{label}</button>
  );
}

function NavBtn({ children, onClick, ariaLabel }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel}
      style={{
        width: 32, height: 32,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 7,
        color: "var(--text-primary)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}>{children}</button>
  );
}

function DayCell({ date, weekday, isToday, tasks, onTaskClick }) {
  const dnum = date.getDate();
  return (
    <div style={{
      background: isToday ? "var(--accent-bg)" : "var(--bg-elevated)",
      border: `1px solid ${isToday ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 10,
      padding: 10,
      minHeight: 200,
      display: "flex", flexDirection: "column",
      gap: 6,
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
      }}>
        <span style={{
          fontSize: 11,
          color: isToday ? "var(--accent)" : "var(--text-secondary)",
          fontWeight: 700,
        }}>{weekday}</span>
        <span style={{
          fontSize: 16, fontWeight: 800,
          color: isToday ? "var(--accent)" : "var(--text-primary)",
        }}>{dnum}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {tasks.length === 0 ? (
          <div style={{
            color: "var(--text-tertiary)",
            fontSize: 10, marginTop: 4,
          }}>—</div>
        ) : tasks.map(t => (
          <TaskChip key={t.id || t.taskCode} task={t} onClick={() => onTaskClick?.(t)}/>
        ))}
      </div>
    </div>
  );
}

function TaskChip({ task, onClick }) {
  const kind  = getServiceKind(task);
  const color = KIND_COLOR[kind] || KIND_COLOR_FALLBACK;
  const time  = formatHm(task.scheduledAt || task.scheduled_at);
  const region   = task.region || task.district || task.지역 || "";
  const customer = task.customer || task.고객명 || "";
  const isCanceled = task.status === "취소";

  return (
    <button onClick={onClick}
      title={`${time} · ${region || customer} · ${kind === "refrigerant" ? "냉매" : kind === "cleaning" ? "세척" : "기타"}${isCanceled ? " · 취소" : ""}`}
      style={{
        textAlign: "left",
        background: `${color}1F`,
        border: `1px solid ${color}66`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 5,
        padding: "4px 7px",
        fontSize: 10, fontWeight: 700,
        color: "var(--text-primary)",
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex", gap: 4,
        alignItems: "center",
        overflow: "hidden",
        textDecoration: isCanceled ? "line-through" : "none",
        opacity: isCanceled ? 0.6 : 1,
      }}>
      <span style={{ color, fontWeight: 800, flexShrink: 0 }}>{time}</span>
      <span style={{
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        color: "var(--text-primary)",
      }}>{region || customer || "—"}</span>
    </button>
  );
}

function EmptyBox({ label }) {
  return (
    <div style={{
      padding: "60px 20px", textAlign: "center",
      color: "var(--text-secondary)", fontSize: 13, fontWeight: 600,
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 14,
    }}>{label}</div>
  );
}

export default AdminPcEngineerCalendarScreen;
