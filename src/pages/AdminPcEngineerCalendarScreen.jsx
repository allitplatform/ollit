// 2026-06-12 — AdminApp PC 기사 주간 일정 (전체 기사 × 주간, 1024px+).
//   사장님 spec 변경 (2026-06-12) — 한 기사 보기 → 전체 기사 × 주간 한눈에.
//   레이아웃: 좌 기사명(90px) + 가로 7일 (월~일). 행 = 기사 (작업 많은 순).
//   각 칸 = 그 기사 그 날 작업 칩 (시간 + 지역, 종류색). 2 초과 시 "외 N".
//   ⚠️ 데이터/로직 0줄 변경 — apiTasks 필터 (scheduledAt 그 주 + assignedEngineerId groupBy).
//   ⚠️ 작업 클릭 → onTaskClick (Shell 우 aside 옛 패턴).
//   ⚠️ 진입: 사이드바 "기사 달력" / 그리드 카드 📅 (그 기사 행 스크롤+강조).
//   ⚠️ 모바일 옛 EngineerCalendarScreen 별개로 유지 (AdminApp.jsx PC 분기).

import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";
import { getServiceKind } from "../utils/workTypeKind.js";

const KIND_COLOR = {
  cleaning:    "#0EA5E9",
  refrigerant: "#FFB800",
};
const KIND_COLOR_FALLBACK = "#9CA3AF";

const WEEKDAYS_KR = ["월", "화", "수", "목", "금", "토", "일"];

const MAX_CHIPS_PER_CELL = 2;  // 2개 초과 시 "외 N" 요약.

function pad(n) { return String(n).padStart(2, "0"); }
function ymd(d)  { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseYmd(s) {
  const [y, m, d] = (s || "").split("-").map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
}
// 월요일 시작 주.
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
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
function formatHm(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}시`;
}

export function AdminPcEngineerCalendarScreen({
  apiTasks = [], apiEngineers = [],
  // engineerId — 그리드 카드 📅 진입 시 highlight + 스크롤 (선택). setEngineerId 미사용.
  engineerId,
  onTaskClick,
}) {
  // 주 시작일 (월~일 default 오늘 주).
  const todayDate = useMemo(() => parseYmd(todayYmd()), []);
  const [weekStart, setWeekStart] = useState(() => startOfWeekMon(todayDate));
  const weekEnd  = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));
    return days;
  }, [weekStart]);

  const [search, setSearch] = useState("");

  // 그 주 작업 — apiTasks filter (scheduledAt KST ymd).
  const weekTasks = useMemo(() => {
    const s = ymd(weekStart), e = ymd(weekEnd);
    return (apiTasks || []).filter(t => {
      if (!t) return false;
      const sched = t.scheduledAt || t.scheduled_at;
      if (!sched) return false;
      const k = toKstYmd(sched);
      return k >= s && k <= e;
    });
  }, [apiTasks, weekStart, weekEnd]);

  // 기사 → 작업[] 그룹 (미배정 제외 — 기사 행 표).
  const byEngineer = useMemo(() => {
    const map = new Map();
    for (const t of weekTasks) {
      const eid = t.assignedEngineerId || t.assigned_engineer_id;
      if (!eid) continue;
      if (!map.has(eid)) map.set(eid, []);
      map.get(eid).push(t);
    }
    return map;
  }, [weekTasks]);

  // 행 정렬 — 작업 많은 순. 검색 매칭 시 작업 0 기사도 포함.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const withTasks = Array.from(byEngineer.entries()).map(([eid, tasks]) => {
      const eng = (apiEngineers || []).find(e => e.id === eid);
      return { eid, eng, name: eng?.name || tasks[0]?.assignedEngineer || tasks[0]?.engineer || "(이름 없음)", tasks };
    });
    withTasks.sort((a, b) => b.tasks.length - a.tasks.length || a.name.localeCompare(b.name));

    if (!q) return withTasks;

    // 검색 — 매칭 기사만. 작업 0 기사도 매칭이면 포함.
    const taskedIds = new Set(withTasks.map(r => r.eid));
    const extras = [];
    for (const eng of apiEngineers || []) {
      if (!eng || taskedIds.has(eng.id)) continue;
      const name = (eng.name || "").toLowerCase();
      if (name.includes(q)) extras.push({ eid: eng.id, eng, name: eng.name || "", tasks: [] });
    }
    const all = [...withTasks, ...extras];
    return all.filter(r => (r.name || "").toLowerCase().includes(q));
  }, [byEngineer, apiEngineers, search]);

  // 기사 × 날짜 cell grouping (시간 정렬).
  const cellsByEngineerDate = useMemo(() => {
    const m = new Map();
    for (const t of weekTasks) {
      const eid = t.assignedEngineerId || t.assigned_engineer_id;
      if (!eid) continue;
      const sched = t.scheduledAt || t.scheduled_at;
      const k = toKstYmd(sched);
      if (!m.has(eid)) m.set(eid, new Map());
      const inner = m.get(eid);
      if (!inner.has(k)) inner.set(k, []);
      inner.get(k).push(t);
    }
    for (const inner of m.values()) {
      for (const arr of inner.values()) {
        arr.sort((a, b) => {
          const ai = a.scheduledAt || a.scheduled_at || "";
          const bi = b.scheduledAt || b.scheduled_at || "";
          return String(ai).localeCompare(String(bi));
        });
      }
    }
    return m;
  }, [weekTasks]);

  // 그리드 카드 📅 진입 시 — 그 기사 행 스크롤 + 강조.
  const rowRefs = useRef(new Map());
  useEffect(() => {
    if (!engineerId) return;
    const node = rowRefs.current.get(engineerId);
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [engineerId]);

  const todayY = todayYmd();
  const totalTasks = weekTasks.length;
  const isThisWeek = ymd(weekStart) === ymd(startOfWeekMon(todayDate));

  return (
    <div style={{
      padding: "20px 24px 24px",
      display: "flex", flexDirection: "column",
      gap: 14,
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <div style={{
            fontSize: 18, fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.4px",
          }}>기사 주간 일정</div>
          <div style={{
            fontSize: 12, color: "var(--text-secondary)", fontWeight: 600,
          }}>{rows.length}명 · {totalTasks}건</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* 기사명 검색 */}
          <div style={{ position: "relative", width: 220 }}>
            <Search size={14} style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-secondary)", pointerEvents: "none",
            }}/>
            <input type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="기사명 검색"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "8px 10px 8px 34px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12, fontFamily: "inherit",
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
          </div>

          {/* 주 네비 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <NavBtn onClick={() => setWeekStart(d => addDays(d, -7))} ariaLabel="이전 주">
              <ChevronLeft size={16}/>
            </NavBtn>
            <button onClick={() => setWeekStart(startOfWeekMon(todayDate))}
              style={{
                padding: "7px 14px",
                background: isThisWeek ? "var(--accent-bg)" : "var(--bg-elevated)",
                border: `1px solid ${isThisWeek ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 7,
                color: isThisWeek ? "var(--accent)" : "var(--text-primary)",
                fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                minWidth: 150, textAlign: "center",
              }}>
              {formatMd(weekStart)} ~ {formatMd(weekEnd)}{isThisWeek ? " (이번주)" : ""}
            </button>
            <NavBtn onClick={() => setWeekStart(d => addDays(d, 7))} ariaLabel="다음 주">
              <ChevronRight size={16}/>
            </NavBtn>
          </div>
        </div>
      </div>

      {/* 표 — 좌 기사명(90px) + 가로 7일 */}
      {rows.length === 0 ? (
        <EmptyBox label={search ? `"${search}" 검색 결과 없음` : "이번 주 작업 없음"}/>
      ) : (
        <div style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {/* 헤더 row — 요일 / 날짜 (오늘 강조) */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "90px repeat(7, 1fr)",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            position: "sticky", top: 0, zIndex: 1,
          }}>
            <div style={{
              padding: "10px 12px",
              fontSize: 11, fontWeight: 700,
              color: "var(--text-secondary)",
              letterSpacing: 0.5, textTransform: "uppercase",
              borderRight: "1px solid var(--border)",
            }}>기사</div>
            {weekDays.map((d, i) => {
              const dy = ymd(d);
              const isToday = dy === todayY;
              return (
                <div key={dy} style={{
                  padding: "10px 6px",
                  textAlign: "center",
                  borderRight: i < 6 ? "1px solid var(--border)" : "none",
                  background: isToday ? "var(--accent-bg)" : "transparent",
                  display: "flex", flexDirection: "column", gap: 1,
                  alignItems: "center",
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: isToday ? "var(--accent)" : "var(--text-secondary)",
                  }}>{WEEKDAYS_KR[i]}</span>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color: isToday ? "var(--accent)" : "var(--text-primary)",
                  }}>{d.getDate()}</span>
                </div>
              );
            })}
          </div>

          {/* 기사 행 */}
          {rows.map((row, ri) => {
            const isHighlight = engineerId && row.eid === engineerId;
            const inner = cellsByEngineerDate.get(row.eid);
            return (
              <div key={row.eid}
                ref={(el) => {
                  if (el) rowRefs.current.set(row.eid, el);
                  else    rowRefs.current.delete(row.eid);
                }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px repeat(7, 1fr)",
                  borderBottom: ri < rows.length - 1 ? "1px solid var(--border)" : "none",
                  background: isHighlight ? "var(--accent-bg)" : "transparent",
                  transition: "background 0.2s",
                }}>
                {/* 기사명 셀 */}
                <div style={{
                  padding: "8px 12px",
                  borderRight: "1px solid var(--border)",
                  fontSize: 12, fontWeight: 700,
                  color: "var(--text-primary)",
                  display: "flex", alignItems: "center", gap: 4,
                  minWidth: 0,
                }}>
                  <span style={{
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    flex: 1, minWidth: 0,
                  }}>{row.name}</span>
                  {row.tasks.length > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: "var(--text-secondary)",
                      flexShrink: 0,
                    }}>{row.tasks.length}</span>
                  )}
                </div>
                {/* 날짜 셀 7개 */}
                {weekDays.map((d, i) => {
                  const dy = ymd(d);
                  const isToday = dy === todayY;
                  const tasks = inner ? (inner.get(dy) || []) : [];
                  return (
                    <Cell key={dy} tasks={tasks}
                      isToday={isToday}
                      borderRight={i < 6}
                      onTaskClick={onTaskClick}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
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

function Cell({ tasks, isToday, borderRight, onTaskClick }) {
  const shown = tasks.slice(0, MAX_CHIPS_PER_CELL);
  const extra = tasks.length - shown.length;
  return (
    <div style={{
      padding: 5,
      borderRight: borderRight ? "1px solid var(--border)" : "none",
      background: isToday ? "var(--accent-bg)" : "transparent",
      display: "flex", flexDirection: "column", gap: 3,
      minHeight: 60,
      minWidth: 0,
    }}>
      {shown.map(t => (
        <TaskChip key={t.id || t.taskCode} task={t} onClick={() => onTaskClick?.(t)}/>
      ))}
      {extra > 0 && (
        <span style={{
          fontSize: 9, fontWeight: 700,
          color: "var(--text-secondary)",
          padding: "2px 4px",
        }}>외 {extra}</span>
      )}
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
        borderRadius: 4,
        padding: "3px 6px",
        fontSize: 10, fontWeight: 700,
        color: "var(--text-primary)",
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex", gap: 4,
        alignItems: "center",
        overflow: "hidden",
        minWidth: 0,
        textDecoration: isCanceled ? "line-through" : "none",
        opacity: isCanceled ? 0.6 : 1,
      }}>
      <span style={{ color, fontWeight: 800, flexShrink: 0 }}>{time}</span>
      <span style={{
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        color: "var(--text-primary)",
        flex: 1, minWidth: 0,
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
