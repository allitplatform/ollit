// 2026-06-12 — AdminApp PC 기사 월간 달력 (한 기사 × 한 달, 1024px+).
//   주간(전체 기사 × 7일)의 짝. 월간은 한 기사 × 한 달.
//   ⚠️ 데이터/로직 0줄 변경. apiTasks 필터 (eid || ename fallback + scheduledAt 그 달, toKstYmd).
//   ⚠️ 작업 칩 클릭 → onTaskClick (Shell 우 aside 옛 패턴).
//   ⚠️ 날짜 cell 클릭 → 그날 작업 자세히 (월 grid 아래 패널).
//   ⚠️ 진입: 사이드바 "기사 달력 (월간)". 기사 드롭다운으로 다른 기사 변경.
//   ⚠️ 모바일 옛 EngineerCalendarScreen 그대로 (AdminApp.jsx PC 분기).

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";
import { getServiceKind } from "../utils/workTypeKind.js";

const KIND_COLOR = {
  cleaning:    "#0EA5E9",
  refrigerant: "#FFB800",
};
const KIND_COLOR_FALLBACK = "#9CA3AF";

const WEEKDAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_CHIPS_PER_CELL = 2;

function pad(n) { return String(n).padStart(2, "0"); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function formatHm(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}시`;
}

function getMonthInfo(year, month) {  // month 1-12
  const first = new Date(year, month - 1, 1);
  const last  = new Date(year, month, 0);
  return { first, last };
}

// 그 달 grid — 1일 속한 주 일요일부터 마지막날 속한 주 토요일까지.
function getMonthGrid(year, month) {
  const { first, last } = getMonthInfo(year, month);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());      // 일요일
  const end = new Date(last);
  end.setDate(end.getDate() + (6 - end.getDay()));      // 토요일
  const days = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function AdminPcEngineerMonthlyCalendarScreen({
  apiTasks = [], apiEngineers = [],
  engineerId, setEngineerId,
  year, setYear,
  month, setMonth,
  onTaskClick,
}) {
  const todayY = todayYmd();
  const [ty, tm] = todayY.split("-").map(Number);

  // 첫 진입 default — calEngineerId/year/month null이면 오늘 + 첫 기사.
  useEffect(() => {
    if (engineerId == null && Array.isArray(apiEngineers) && apiEngineers.length > 0) {
      if (typeof setEngineerId === "function") setEngineerId(apiEngineers[0].id);
    }
    if (year  == null && typeof setYear  === "function") setYear(ty);
    if (month == null && typeof setMonth === "function") setMonth(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEngineers, engineerId, year, month]);

  const safeYear  = year  ?? ty;
  const safeMonth = month ?? tm;

  const engineer = useMemo(
    () => (apiEngineers || []).find(e => e.id === engineerId) || null,
    [apiEngineers, engineerId]
  );

  const monthDays = useMemo(
    () => getMonthGrid(safeYear, safeMonth),
    [safeYear, safeMonth]
  );

  // 그 달 작업 — 기사 매칭 (eid 또는 ename fallback) + scheduledAt KST 그 달.
  //   타임라인/주간과 동일 매칭 패턴 — 옛 데이터(이름만 있는 작업) 포함.
  const monthTasks = useMemo(() => {
    if (!engineerId && !engineer) return [];
    const monthPrefix = `${safeYear}-${pad(safeMonth)}`;
    const enName = (engineer?.name || "").trim();
    return (apiTasks || []).filter(t => {
      if (!t) return false;
      const sched = t.scheduledAt || t.scheduled_at;
      if (!sched) return false;
      const k = toKstYmd(sched);
      if (!k.startsWith(monthPrefix)) return false;

      const eid   = t.assignedEngineerId || t.assigned_engineer_id || null;
      const ename = (t.assignedEngineer || t.engineer || "").trim();
      if (engineerId && eid === engineerId) return true;
      if (enName && ename && ename === enName) return true;
      return false;
    });
  }, [apiTasks, engineerId, engineer, safeYear, safeMonth]);

  // 날짜별 grouping (시간 순).
  const byDate = useMemo(() => {
    const map = new Map();
    for (const t of monthTasks) {
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
  }, [monthTasks]);

  // 선택된 날짜 (cell 클릭 시 = 그날 작업 자세히 패널).
  const [selectedYmd, setSelectedYmd] = useState(todayY);
  const selectedDateTasks = byDate.get(selectedYmd) || [];

  function shiftMonth(delta) {
    let y = safeYear, m = safeMonth + delta;
    while (m < 1)  { y--; m += 12; }
    while (m > 12) { y++; m -= 12; }
    if (typeof setYear  === "function") setYear(y);
    if (typeof setMonth === "function") setMonth(m);
  }

  const isThisMonth = (safeYear === ty && safeMonth === tm);

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
          }}>기사 월간 일정</div>
          <div style={{
            fontSize: 12, color: "var(--text-secondary)", fontWeight: 600,
          }}>{monthTasks.length}건 / 월</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* 기사 드롭다운 */}
          <select value={engineerId || ""}
            onChange={(e) => setEngineerId?.(e.target.value)}
            style={{
              padding: "8px 12px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              minWidth: 160,
              outline: "none",
            }}>
            {(apiEngineers || []).length === 0 && (
              <option value="">기사 없음</option>
            )}
            {(apiEngineers || []).map(e => (
              <option key={e.id} value={e.id}>{e.name || "(이름 없음)"}</option>
            ))}
          </select>

          {/* 월 네비 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <NavBtn onClick={() => shiftMonth(-1)} ariaLabel="이전 달">
              <ChevronLeft size={16}/>
            </NavBtn>
            <button onClick={() => { setYear?.(ty); setMonth?.(tm); }}
              style={{
                padding: "7px 14px",
                background: isThisMonth ? "var(--accent-bg)" : "var(--bg-elevated)",
                border: `1px solid ${isThisMonth ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 7,
                color: isThisMonth ? "var(--accent)" : "var(--text-primary)",
                fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                minWidth: 120, textAlign: "center",
              }}>
              {safeYear}년 {safeMonth}월{isThisMonth ? " (이번달)" : ""}
            </button>
            <NavBtn onClick={() => shiftMonth(1)} ariaLabel="다음 달">
              <ChevronRight size={16}/>
            </NavBtn>
          </div>
        </div>
      </div>

      {/* 본문 — 월 grid + 선택 날짜 패널 */}
      {!engineer && !engineerId ? (
        <EmptyBox label="기사 미선택"/>
      ) : (
        <>
          <div style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}>
            {/* 요일 일~토 (일=빨강 / 토=파랑) */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: "1px solid var(--border)",
            }}>
              {WEEKDAYS_KR.map((w, i) => (
                <div key={w} style={{
                  padding: "8px 6px",
                  textAlign: "center",
                  fontSize: 10, fontWeight: 700,
                  color: i === 0 ? "#FF6B6B" : i === 6 ? "#5A95F0" : "var(--text-secondary)",
                  borderRight: i < 6 ? "1px solid var(--border)" : "none",
                }}>{w}</div>
              ))}
            </div>

            {/* 일 cell — 7 × N */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gridAutoRows: "minmax(90px, 1fr)",
            }}>
              {monthDays.map((d, idx) => {
                const dy = ymd(d);
                const isOutMonth = d.getMonth() + 1 !== safeMonth;
                const isToday    = dy === todayY;
                const isSelected = dy === selectedYmd;
                const tasks = byDate.get(dy) || [];
                return (
                  <DayCell key={dy}
                    date={d}
                    isOutMonth={isOutMonth}
                    isToday={isToday}
                    isSelected={isSelected}
                    tasks={tasks}
                    borderRight={idx % 7 !== 6}
                    borderBottom={idx + 7 < monthDays.length}
                    onSelect={() => setSelectedYmd(dy)}
                    onTaskClick={onTaskClick}
                  />
                );
              })}
            </div>
          </div>

          {/* 선택 날짜 — 그날 작업 자세히 */}
          {selectedDateTasks.length > 0 ? (
            <SelectedDayPanel
              ymd={selectedYmd}
              tasks={selectedDateTasks}
              onTaskClick={onTaskClick}
            />
          ) : (
            <div style={{
              padding: "14px 18px",
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: 12, fontWeight: 600,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}>선택 날짜에 작업 없음 — 다른 날짜를 클릭하세요</div>
          )}
        </>
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

function DayCell({ date, isOutMonth, isToday, isSelected, tasks, borderRight, borderBottom, onSelect, onTaskClick }) {
  const shown = tasks.slice(0, MAX_CHIPS_PER_CELL);
  const extra = tasks.length - shown.length;
  const dnum = date.getDate();
  return (
    <div onClick={onSelect}
      style={{
        padding: 6,
        borderRight:  borderRight  ? "1px solid var(--border)" : "none",
        borderBottom: borderBottom ? "1px solid var(--border)" : "none",
        background: (isToday || isSelected) ? "var(--accent-bg)" : "transparent",
        display: "flex", flexDirection: "column", gap: 3,
        cursor: "pointer",
        opacity: isOutMonth ? 0.4 : 1,
        position: "relative",
        outline: isSelected ? "2px solid var(--accent)" : "none",
        outlineOffset: -2,
        minWidth: 0,
      }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
      }}>
        <span style={{
          fontSize: 11, fontWeight: isToday ? 800 : 600,
          color: isToday ? "var(--accent)"
            : isOutMonth ? "var(--text-tertiary)"
            : "var(--text-primary)",
        }}>{dnum}</span>
        {tasks.length > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700,
            color: "var(--text-secondary)",
          }}>{tasks.length}</span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        {shown.map(t => (
          <TaskChip key={t.id || t.taskCode} task={t}
            onClick={(e) => { e.stopPropagation(); onTaskClick?.(t); }}/>
        ))}
        {extra > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700,
            color: "var(--text-secondary)",
          }}>외 {extra}</span>
        )}
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
        borderRadius: 4,
        padding: "2px 5px",
        fontSize: 9, fontWeight: 700,
        color: "var(--text-primary)",
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex", gap: 3,
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

// 2026-06-12 — 콤팩트 + 정보 추가 (시간/종류/고객/지역/주문번호/금액/상태).
const DAY_ROW_GRID = "50px 22px minmax(0, 1.4fr) minmax(0, 1.2fr) minmax(0, 1fr) 90px 70px";

function SelectedDayPanel({ ymd, tasks, onTaskClick }) {
  const [, m, d] = ymd.split("-").map(Number);
  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "12px 14px",
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 8,
        marginBottom: 8,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 800,
          color: "var(--accent)",
          letterSpacing: "-0.3px",
        }}>{m}월 {d}일</div>
        <div style={{
          fontSize: 11, color: "var(--text-secondary)", fontWeight: 600,
        }}>{tasks.length}건</div>
      </div>
      {/* 헤더 row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: DAY_ROW_GRID,
        gap: 8,
        padding: "4px 10px",
        fontSize: 10, fontWeight: 700,
        color: "var(--text-tertiary)",
        letterSpacing: 0.4,
        marginBottom: 4,
      }}>
        <span>시간</span>
        <span></span>
        <span>고객</span>
        <span>지역</span>
        <span>주문번호</span>
        <span style={{ textAlign: "right" }}>금액</span>
        <span>상태</span>
      </div>
      {/* 행 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {tasks.map(t => (
          <DayTaskRow key={t.id || t.taskCode} task={t} onClick={() => onTaskClick?.(t)}/>
        ))}
      </div>
    </div>
  );
}

function DayTaskRow({ task, onClick }) {
  const kind  = getServiceKind(task);
  const color = KIND_COLOR[kind] || KIND_COLOR_FALLBACK;
  const time  = formatHm(task.scheduledAt || task.scheduled_at);
  const region   = task.region || task.district || task.지역 || "";
  const customer = task.customer || task.고객명 || "";
  const orderId  = task.productOrderId || task.product_order_id || task.taskCode
    || (task.id ? String(task.id).slice(0, 8) : "");
  // task 객체 안 잠재 금액 필드 — 환경에 따라 다를 수 있어 0 fallback.
  const amount   = Number(task.totalAmount ?? task.amount ?? task.subtotal ?? 0) || 0;
  const isCanceled = task.status === "취소";
  const kindLabel = kind === "refrigerant" ? "⚡" : kind === "cleaning" ? "❄" : "•";

  return (
    <button onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: DAY_ROW_GRID,
        gap: 8,
        alignItems: "center",
        padding: "6px 10px",
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        textDecoration: isCanceled ? "line-through" : "none",
        opacity: isCanceled ? 0.6 : 1,
        minWidth: 0,
      }}>
      <span style={{
        fontSize: 12, fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums",
      }}>{time}</span>
      <span style={{
        fontSize: 13, color, lineHeight: 1,
      }}>{kindLabel}</span>
      <span style={{
        fontSize: 12, fontWeight: 700,
        color: "var(--text-primary)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        minWidth: 0,
      }}>{customer || "—"}</span>
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: "var(--text-secondary)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        minWidth: 0,
      }}>{region || "—"}</span>
      <span style={{
        fontSize: 10, fontWeight: 600,
        color: "var(--text-tertiary)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        minWidth: 0,
      }}>{orderId || "—"}</span>
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: "var(--text-primary)",
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
      }}>{amount > 0 ? `${amount.toLocaleString("ko-KR")}원` : "—"}</span>
      <span style={{
        fontSize: 10, fontWeight: 700,
        color: "var(--text-secondary)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{task.status || "—"}</span>
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

export default AdminPcEngineerMonthlyCalendarScreen;
