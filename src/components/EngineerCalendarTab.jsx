// V14 — 기사 PWA 캘린더 탭 (토글 3개)
// 오늘 = 시간순 타임라인 / 주간 = 7일 그룹 / 월간 = 큰 캘린더 + 휴무 추가

import { useMemo, useState } from "react";
import { EngineerBottomNav } from "./EngineerBottomNav.jsx";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import { isCompletedStatus, statusLabel } from "../utils/taskStatus.js";
import {
  CalendarGrid, Legend,
  formatYmd, formatMonthLabel, formatMonthShort, formatDateLong,
  isToday, isSameDay, addMonths,
} from "./CalendarGrid.jsx";

const navBtnStyle = {
  width: 36, height: 36,
  background: "transparent",
  border: "none",
  color: "#FF1B8D", fontSize: 24, fontWeight: 700,
  lineHeight: 1, cursor: "pointer", fontFamily: "inherit",
  padding: "4px 8px",
};

function countByStatus(tasks, status) {
  return tasks.filter(t => t.status === status).length;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function compareTime(a, b) {
  const ta = a.scheduledTime || a.time || "99:99";
  const tb = b.scheduledTime || b.time || "99:99";
  return ta.localeCompare(tb);
}

// V14 — 휴무 헬퍼 (single/range/repeat = full / hourly = 부분)
// 2026-07-08 — DB 로 이관 후 range/repeat 도 per-date row 로 저장됨.
//   · 옛 payload aggregate (startDate/endDate/weekdays) 있으면 우선 사용 (하위 호환)
//   · 없으면 o.date === ymd 매칭 fallback (DB row)
function isFullDayOffYmd(ymd, dow, offDays) {
  return (offDays || []).some(o => {
    const type = o.type;
    if (type === "hourly" || type === "휴무부분") return false;
    if (type === "range"  && o.startDate && o.endDate) return ymd >= o.startDate && ymd <= o.endDate;
    if (type === "repeat" && Array.isArray(o.weekdays)) return o.weekdays.includes(dow);
    return o.date === ymd;
  });
}
function getHourlyOffsForYmd(ymd, offDays) {
  return (offDays || []).filter(o => o.type === "hourly" && o.date === ymd);
}
// 작업 + 시간 휴무 시간순 병합
function mergeDayItems(tasks, hourlyOffs) {
  const merged = [
    ...tasks.map(t => ({ ...t, __off: false })),
    ...hourlyOffs.map((o, i) => ({ ...o, __off: true, __key: `hoff-${i}` })),
  ];
  return merged.sort((a, b) => {
    const ka = a.__off ? (a.startTime || "99:99") : (a.scheduledTime || a.time || "99:99");
    const kb = b.__off ? (b.startTime || "99:99") : (b.scheduledTime || b.time || "99:99");
    return ka.localeCompare(kb);
  });
}

export function EngineerCalendarTab({
  engineer,
  tasks = [],
  offDays = [],
  onAddOff,
  onRemoveOff,
  onClickTask,
  onTabChange,
  unreadCount = 0,
  initialDate = null,    // V14 v7 — '2026-05-08' 받으면 그 날 일별 뷰
  initialView = null,    // 'today' | 'week' | 'month'
}) {
  const initialDateObj = initialDate ? new Date(initialDate) : new Date();
  const [view, setView] = useState(initialView || "month");
  const [currentMonth, setCurrentMonth] = useState(initialDateObj);
  const [selectedDate, setSelectedDate] = useState(initialDateObj);

  const monthData = useMemo(() => {
    const byDate = {};
    let count = 0;
    tasks.forEach(t => {
      const day = t.scheduledDate || t.workDate;
      if (!day) return;
      const date = new Date(day);
      if (date.getFullYear() !== currentMonth.getFullYear()
        || date.getMonth() !== currentMonth.getMonth()) return;
      const k = formatYmd(date);
      if (!byDate[k]) byDate[k] = { tasks: [] };
      byDate[k].tasks.push(t);
      count += 1;
    });

    // V14 — 휴무 시각 표시 (single / range / repeat = full / hourly = 부분)
    const monthYear = currentMonth.getFullYear();
    const monthIdx  = currentMonth.getMonth();
    const lastDay   = new Date(monthYear, monthIdx + 1, 0).getDate();
    let offCount = 0;
    let hourlyCount = 0;
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(monthYear, monthIdx, d);
      const ymd  = formatYmd(date);
      const dow  = date.getDay();
      const isFullOff = isFullDayOffYmd(ymd, dow, offDays);
      const hourlyList = getHourlyOffsForYmd(ymd, offDays);
      if (isFullOff) {
        if (!byDate[ymd]) byDate[ymd] = { tasks: [] };
        byDate[ymd].offDay = true;
        offCount += 1;
      }
      if (hourlyList.length > 0) {
        if (!byDate[ymd]) byDate[ymd] = { tasks: [] };
        byDate[ymd].hourlyOffs = hourlyList;
        hourlyCount += hourlyList.length;
      }
    }

    return { byDate, count, offCount, hourlyCount };
  }, [tasks, offDays, currentMonth]);

  const dayTasks = useMemo(() => {
    const k = formatYmd(selectedDate);
    return [...(monthData.byDate[k]?.tasks || [])].sort(compareTime);
  }, [monthData, selectedDate]);

  const dayHourlyOffs = useMemo(() => {
    const k = formatYmd(selectedDate);
    return monthData.byDate[k]?.hourlyOffs || [];
  }, [monthData, selectedDate]);

  // V14 — selectedDate에 매칭되는 전체 휴무 객체들 (single/range/repeat)
  // 2026-07-08 — DB per-date row + 옛 aggregate 둘 다 처리 (isFullDayOffYmd 와 동일).
  const dayFullOffs = useMemo(() => {
    const ymd = formatYmd(selectedDate);
    const dow = new Date(selectedDate).getDay();
    return (offDays || []).filter(o => {
      const type = o.type;
      if (type === "hourly" || type === "휴무부분") return false;
      if (type === "range"  && o.startDate && o.endDate) return ymd >= o.startDate && ymd <= o.endDate;
      if (type === "repeat" && Array.isArray(o.weekdays)) return o.weekdays.includes(dow);
      return o.date === ymd;
    });
  }, [offDays, selectedDate]);

  // 오늘 타임라인용 (작업 + 시간 휴무 + 전체 휴무 여부)
  const todayInfo = useMemo(() => {
    const today = new Date();
    const ymd   = formatYmd(today);
    const dow   = today.getDay();
    const items = tasks
      .filter(t => {
        const day = t.scheduledDate || t.workDate;
        return day && isSameDay(new Date(day), today);
      })
      .sort(compareTime);
    const hourlyOffs = getHourlyOffsForYmd(ymd, offDays);
    const isFullOff  = isFullDayOffYmd(ymd, dow, offDays);
    return { date: today, tasks: items, hourlyOffs, isFullOff };
  }, [tasks, offDays]);

  // 주간용 (오늘부터 7일) — 작업 + 시간 휴무 + 전체 휴무
  const weekDays = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      const ymd  = formatYmd(date);
      const dow  = date.getDay();
      const dayTasks = tasks
        .filter(t => {
          const day = t.scheduledDate || t.workDate;
          return day && isSameDay(new Date(day), date);
        })
        .sort(compareTime);
      const hourlyOffs = getHourlyOffsForYmd(ymd, offDays);
      const isFullOff  = isFullDayOffYmd(ymd, dow, offDays);
      days.push({ date, tasks: dayTasks, hourlyOffs, offDay: isFullOff });
    }
    return days;
  }, [tasks, offDays]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 80,
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        padding: "16px 16px 14px", borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--bg-primary)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>📅 캘린더</div>
            <div style={{
              fontSize: 13, color: "var(--text-secondary)", marginTop: 4, fontWeight: 600,
            }}>
              {formatMonthShort(currentMonth)} {monthData.count}건 · 휴무 {monthData.offCount}일
            </div>
          </div>
          <button
            onClick={() => onAddOff && onAddOff(formatYmd(selectedDate))}
            style={{
              padding: "10px 14px",
              background: "#FF1B8D",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13, fontWeight: 800,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            + 휴무 추가
          </button>
        </div>

        {/* 토글 3개 */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6,
        }}>
          <ToggleBtn label="오늘"  active={view === "today"}  onClick={() => setView("today")}/>
          <ToggleBtn label="주간"  active={view === "week"}   onClick={() => setView("week")}/>
          <ToggleBtn label="월간"  active={view === "month"}  onClick={() => setView("month")}/>
        </div>
      </div>

      {/* 본문 — 뷰별 분기 */}
      {view === "month" && (
        <MonthView
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          monthData={monthData}
          dayTasks={dayTasks}
          dayHourlyOffs={dayHourlyOffs}
          dayFullOffs={dayFullOffs}
          onClickTask={onClickTask}
          onRemoveOff={onRemoveOff}
        />
      )}
      {view === "week" && (
        <WeekView weekDays={weekDays} onClickTask={onClickTask} onRemoveOff={onRemoveOff}/>
      )}
      {view === "today" && (
        <TodayView todayInfo={todayInfo} onClickTask={onClickTask} onRemoveOff={onRemoveOff}/>
      )}

      <EngineerBottomNav active="cal" onChange={onTabChange} unreadCount={unreadCount}/>
    </div>
  );
}

// ───────────────────────────────────────────────
// 토글 버튼
// ───────────────────────────────────────────────
function ToggleBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 12px",
      background: active ? "#FF1B8D" : "transparent",
      border: active ? "1px solid #FF1B8D" : "1px solid var(--border)",
      borderRadius: 10,
      color: active ? "#fff" : "var(--text-secondary)",
      fontSize: 14, fontWeight: 800,
      cursor: "pointer", fontFamily: "inherit",
    }}>
      {label}
    </button>
  );
}

// ───────────────────────────────────────────────
// 월간 뷰
// ───────────────────────────────────────────────
function MonthView({
  currentMonth, setCurrentMonth,
  selectedDate, setSelectedDate,
  monthData, dayTasks, dayHourlyOffs = [], dayFullOffs = [],
  onClickTask, onRemoveOff,
}) {
  return (
    <>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} style={navBtnStyle}>‹</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>
              {formatMonthLabel(currentMonth)}
            </span>
            <button
              onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                color: "#FF1B8D",
                fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                padding: "4px 10px", borderRadius: 6,
              }}
            >
              오늘
            </button>
          </div>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} style={navBtnStyle}>›</button>
        </div>

        <CalendarGrid
          month={currentMonth}
          selectedDate={selectedDate}
          dayData={monthData.byDate}
          onSelectDate={setSelectedDate}
          showStatusDots={true}
          showOffDay={true}
          highlightToday={true}
        />

        <div style={{
          display: "flex", gap: 12, padding: "12px 0 0",
          marginTop: 8, fontSize: 12, color: "var(--text-secondary)",
          justifyContent: "center", flexWrap: "wrap",
          borderTop: "1px solid var(--border)",
        }}>
          <Legend color="#0EA5E9" label="❄ 세척"/>
          <Legend color="#FFB800" label="⚡ 냉매"/>
          <Legend color="#FF1B8D" label="🔧 기타"/>
        </div>
      </div>

      {/* 선택한 날 일정 — 작업 + 시간 휴무 시간순 정렬 + 전체 휴무 카드 */}
      {(() => {
        const merged = mergeDayItems(dayTasks, dayHourlyOffs);
        const isFullOff   = dayFullOffs.length > 0;
        const totalCount  = dayTasks.length + dayHourlyOffs.length;
        const offCount    = dayHourlyOffs.length;

        return (
          <div style={{ padding: "16px" }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>{formatDateLong(selectedDate)}</span>
                {isToday(selectedDate) && <span style={{ color: "#FF1B8D" }}>· 오늘</span>}
                {isFullOff && (
                  <span style={{
                    background: "var(--pending-pill-bg, var(--border))",
                    color: "var(--text-secondary)",
                    fontSize: 11, padding: "2px 8px",
                    borderRadius: 999, fontWeight: 700,
                  }}>
                    휴무
                  </span>
                )}
              </div>
              {!isFullOff && (
                <div style={{
                  fontSize: 12, color: "var(--text-secondary)",
                  marginTop: 4, fontWeight: 600,
                }}>
                  {totalCount}건
                  {offCount > 0 && ` (휴무 ${offCount}건 포함)`}
                  {countByStatus(dayTasks, "진행중") > 0 && ` · 진행중 ${countByStatus(dayTasks, "진행중")}`}
                  {countByStatus(dayTasks, "확정")   > 0 && ` · 확정 ${countByStatus(dayTasks, "확정")}`}
                  {countByStatus(dayTasks, "미배정") > 0 && ` · 약속미정 ${countByStatus(dayTasks, "미배정")}`}
                </div>
              )}
            </div>

            {/* 전체 휴무 카드 (single/range/repeat) */}
            {isFullOff && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                {dayFullOffs.map((off) => (
                  <FullDayOffCard key={off.id || `${off.type}-${off.date || off.startDate || off.weekdays}`} off={off} onRemove={onRemoveOff}/>
                ))}
              </div>
            )}

            {/* 시간 휴무 + 작업 (전체 휴무여도 시간 휴무가 있으면 표시) */}
            {totalCount === 0 && !isFullOff ? (
              <EmptyState text="이 날은 일정이 없어요"/>
            ) : merged.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {merged.map((item) => item.__off
                  ? <HourlyOffCard key={item.__key} off={item} onRemove={onRemoveOff}/>
                  : <DayTaskCard key={item.id} task={item} onClick={() => onClickTask && onClickTask(item.id)}/>
                )}
              </div>
            ) : null}
          </div>
        );
      })()}
    </>
  );
}

function HourlyOffCard({ off, compact = false, onRemove }) {
  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 14,
      padding: compact ? "12px 14px 12px 18px" : "14px 14px 14px 18px",
      position: "relative",
      overflow: "hidden",
      opacity: 0.85,
    }}>
      {/* 좌측 4px 회색 바 */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4, background: "#999",
      }}/>

      {/* 우측 상단 ✕ (회색 원형) */}
      {onRemove ? <RemoveBtn onClick={(e) => { e.stopPropagation(); onRemove(off); }}/> : null}

      {/* 헤더: ⏰ + 시간 + 휴무 알약 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        paddingRight: onRemove ? 36 : 0,
        marginBottom: compact ? 0 : (off.reason ? 6 : 8),
        flexWrap: "wrap",
      }}>
        <span style={{ fontSize: compact ? 14 : 16 }}>⏰</span>
        <span style={{
          fontSize: compact ? 14 : 16, fontWeight: 700,
          color: "var(--text-secondary)",
        }}>
          {off.startTime || "—"} ~ {off.endTime || "—"}
        </span>
        <span style={{
          background: "var(--pending-pill-bg, var(--border))",
          color: "var(--text-secondary)",
          fontSize: 11,
          padding: "3px 9px",
          borderRadius: 999,
          fontWeight: 700,
        }}>
          휴무
        </span>
        {compact && off.reason ? (
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: "var(--text-tertiary)",
          }}>
            · {off.reason}
          </span>
        ) : null}
      </div>

      {/* 풀 모드: 사유 + 헬퍼 */}
      {!compact && off.reason ? (
        <div style={{
          fontSize: 13, fontWeight: 600,
          color: "var(--text-tertiary)",
          marginBottom: 8,
          paddingLeft: 22,
        }}>
          📝 {off.reason}
        </div>
      ) : null}
      {!compact ? (
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: "var(--text-tertiary)",
          fontStyle: "italic",
          paddingLeft: 22,
        }}>
          ✓ 운영팀이 이 시간엔 배정하지 않습니다
        </div>
      ) : null}
    </div>
  );
}

// V14 — 전체 휴무 카드 (single/range/repeat) — selectedDate 클릭 하단 표시
function FullDayOffCard({ off, onRemove }) {
  const typeMap = {
    single: { icon: "📌", label: "하루 휴무" },
    range:  { icon: "📆", label: "기간 휴무" },
    repeat: { icon: "🔁", label: "반복 휴무" },
  };
  const info = typeMap[off.type] || { icon: "📅", label: "휴무" };

  // 반복 휴무는 어떤 요일인지 표시
  // 2026-07-08 — DB per-date row 는 aggregate 필드 (startDate/weekdays) 결손.
  //   이 경우 그 날 날짜 (off.date) 를 subtitle 로 표시.
  let subtitle = null;
  if (off.type === "repeat" && Array.isArray(off.weekdays)) {
    const days = off.weekdays
      .slice()
      .sort((a, b) => a - b)
      .map(d => ["일","월","화","수","목","금","토"][d])
      .join(", ");
    subtitle = `매주 ${days}요일`;
  } else if (off.type === "range" && off.startDate && off.endDate) {
    subtitle = `${off.startDate} ~ ${off.endDate}`;
  } else if (off.date) {
    subtitle = off.date;
  }

  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 14,
      padding: "14px 14px 14px 18px",
      position: "relative",
      overflow: "hidden",
      opacity: 0.85,
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4, background: "#999",
      }}/>
      {onRemove ? <RemoveBtn onClick={(e) => { e.stopPropagation(); onRemove(off); }}/> : null}

      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        paddingRight: onRemove ? 36 : 0,
        marginBottom: 4, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 16 }}>{info.icon}</span>
        <span style={{
          fontSize: 16, fontWeight: 700,
          color: "var(--text-secondary)",
        }}>
          {info.label}
        </span>
        {subtitle ? (
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: "var(--text-tertiary)",
          }}>
            · {subtitle}
          </span>
        ) : null}
      </div>

      {off.reason ? (
        <div style={{
          fontSize: 13, fontWeight: 600,
          color: "var(--text-tertiary)",
          marginTop: 6, marginBottom: 8,
          paddingLeft: 22,
        }}>
          📝 {off.reason}
        </div>
      ) : null}

      <div style={{
        fontSize: 12, fontWeight: 600,
        color: "var(--text-tertiary)",
        fontStyle: "italic",
        paddingLeft: 22,
      }}>
        ✓ 운영팀이 배정하지 않습니다
      </div>
    </div>
  );
}

function RemoveBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="휴무 해제"
      style={{
        position: "absolute",
        right: 10, top: 10,
        background: "var(--remove-btn-bg, rgba(0,0,0,0.06))",
        border: "none",
        color: "var(--text-secondary)",
        fontSize: 13,
        padding: 0,
        cursor: "pointer",
        lineHeight: 1,
        width: 26, height: 26,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        zIndex: 2,
        fontFamily: "inherit",
      }}
    >
      ✕
    </button>
  );
}

// ───────────────────────────────────────────────
// 주간 뷰 — 7일 그룹 (작업 + 시간 휴무 + 전체 휴무)
// ───────────────────────────────────────────────
function WeekView({ weekDays, onClickTask, onRemoveOff }) {
  return (
    <div style={{ padding: "16px" }}>
      {weekDays.map(({ date, tasks: dt, hourlyOffs = [], offDay: isFullOff }, idx) => {
        const items = mergeDayItems(dt, hourlyOffs);
        const offCount = hourlyOffs.length;
        return (
          <div key={idx} style={{ marginBottom: 18 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 8, paddingLeft: 4, flexWrap: "wrap",
            }}>
              <span style={{
                fontSize: 14, fontWeight: 800,
                color: isToday(date) ? "#FF1B8D" : "var(--text-primary)",
              }}>
                {formatDateLong(date)}
              </span>
              {isToday(date) && (
                <span style={{
                  fontSize: 11, fontWeight: 800, color: "#FF1B8D",
                  padding: "2px 6px",
                  background: "rgba(255,27,141,0.10)",
                  borderRadius: 4,
                }}>
                  오늘
                </span>
              )}
              {isFullOff && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: "var(--text-secondary)",
                  padding: "2px 6px",
                  background: "var(--bg-secondary)",
                  borderRadius: 4,
                }}>
                  휴무
                </span>
              )}
              <span style={{
                fontSize: 12, color: "var(--text-secondary)",
                marginLeft: "auto", fontWeight: 600,
              }}>
                {!isFullOff && items.length > 0 ? `${items.length}건${offCount > 0 ? ` (휴무 ${offCount})` : ""}` : ""}
              </span>
            </div>

            {isFullOff ? (
              <div style={{
                padding: "16px",
                background: "var(--bg-secondary)",
                border: "1px dashed var(--border)",
                borderRadius: 14,
                fontSize: 13, color: "var(--text-secondary)",
                fontWeight: 700,
                textAlign: "center",
              }}>
                ⏰ 휴무
              </div>
            ) : items.length === 0 ? (
              <div style={{
                padding: "10px 14px",
                background: "var(--bg-secondary)",
                borderRadius: 8,
                fontSize: 12, color: "var(--text-tertiary)",
                fontWeight: 600,
              }}>
                일정 없음
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {items.map(item => item.__off
                  ? <HourlyOffCard key={item.__key} off={item} compact onRemove={onRemoveOff}/>
                  : <DayTaskCard key={item.id} task={item} onClick={() => onClickTask && onClickTask(item.id)}/>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────
// 오늘 뷰 — 시간순 타임라인 (작업 + 시간 휴무 + 전체 휴무)
// ───────────────────────────────────────────────
function TodayView({ todayInfo, onClickTask, onRemoveOff }) {
  const { tasks: todayTasks = [], hourlyOffs = [], isFullOff = false, date = new Date() } = todayInfo || {};
  const items = mergeDayItems(todayTasks, hourlyOffs);
  const offCount        = hourlyOffs.length;
  const inProgressCount = todayTasks.filter(t => t.status === "진행중").length;
  const confirmedCount  = todayTasks.filter(t => t.status === "확정").length;

  // 전체 휴무 — 별도 화면
  if (isFullOff) {
    return (
      <div style={{ padding: "16px" }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {formatDateLong(date)} · <span style={{ color: "#FF1B8D" }}>오늘</span>
            <span style={{
              marginLeft: 8,
              background: "var(--pending-pill-bg, var(--border))",
              color: "var(--text-secondary)",
              fontSize: 11, padding: "2px 8px",
              borderRadius: 999, fontWeight: 700,
            }}>
              휴무
            </span>
          </div>
        </div>
        <FullDayOffBox/>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: "16px" }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {formatDateLong(date)} · <span style={{ color: "#FF1B8D" }}>오늘</span>
          </div>
        </div>
        <EmptyState text="오늘 일정이 없어요"/>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>
          {formatDateLong(date)} · <span style={{ color: "#FF1B8D" }}>오늘</span>
        </div>
        <div style={{
          fontSize: 12, color: "var(--text-secondary)",
          marginTop: 4, fontWeight: 600,
        }}>
          {items.length}건
          {offCount > 0 && ` (휴무 ${offCount}건 포함)`}
          {inProgressCount > 0 && ` · 진행중 ${inProgressCount}`}
          {confirmedCount > 0 && ` · 확정 ${confirmedCount}`}
        </div>
      </div>

      <div style={{ position: "relative", paddingLeft: 28 }}>
        {/* 세로 타임라인 라인 */}
        <div style={{
          position: "absolute",
          left: 11, top: 8, bottom: 8,
          width: 2,
          background: "var(--border)",
        }}/>

        {items.map((item) => item.__off
          ? <TimelineHourlyOffRow key={item.__key} off={item} onRemove={onRemoveOff}/>
          : <TimelineRow key={item.id} task={item} onClick={() => onClickTask && onClickTask(item.id)}/>
        )}
      </div>
    </div>
  );
}

function TimelineHourlyOffRow({ off, onRemove }) {
  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <div style={{
        position: "absolute",
        left: -28, top: 14,
        width: 16, height: 16,
        borderRadius: "50%",
        background: "var(--bg-primary)",
        border: "3px solid #999",
        boxSizing: "border-box",
      }}/>
      <HourlyOffCard off={off} compact onRemove={onRemove}/>
    </div>
  );
}

function FullDayOffBox() {
  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 14,
      padding: 24,
      textAlign: "center",
      color: "var(--text-secondary)",
      fontSize: 14, fontWeight: 700,
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🏖️</div>
      <div>오늘은 휴무입니다</div>
      <div style={{
        fontSize: 12, color: "var(--text-tertiary)",
        marginTop: 8, fontWeight: 600, fontStyle: "italic",
      }}>
        ✓ 운영팀이 오늘은 배정하지 않습니다
      </div>
    </div>
  );
}

function TimelineRow({ task, onClick }) {
  const status = task.status;
  const isInProgress = status === "진행중";
  // 2026-05-22 — visit_only 측 "완료 계열" (흐릿 카드 스타일 적용)
  const isDone = isCompletedStatus(status);
  const isUntimed = status === "미배정";
  // 2026-05-24 — 취소 카드 흐리게 (opacity 0.4)
  const isCancelled = status === "취소";

  // 점 색
  const dotColor = isInProgress ? "#FF1B8D"
                  : isDone        ? "#03C75A"
                  : isUntimed     ? "#FF8A3D"
                  :                 "#FFB800";

  // 카드 스타일
  const cardStyle = isInProgress
    ? { background: "transparent", border: "2px solid #FF1B8D" }
    : isDone
      ? { background: "var(--bg-secondary)", border: "1px solid var(--border)", opacity: 0.6 }
      : isUntimed
        ? { background: "rgba(255,138,61,0.08)", border: "1px solid rgba(255,138,61,0.30)" }
        : { background: "var(--bg-secondary)", border: "1px solid var(--border)" };
  // 취소 카드 — opacity 덮어쓰기
  if (isCancelled) cardStyle.opacity = 0.4;

  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      {/* 점 */}
      <div style={{
        position: "absolute",
        left: -28, top: 14,
        width: 16, height: 16,
        borderRadius: "50%",
        background: isInProgress ? dotColor : "var(--bg-primary)",
        border: `3px solid ${dotColor}`,
        boxSizing: "border-box",
      }}/>

      <div onClick={onClick} className="clickable" style={{
        ...cardStyle,
        borderRadius: 10,
        padding: 14,
        cursor: "pointer",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 6,
        }}>
          <div style={{
            fontSize: 17, fontWeight: 800,
            fontFamily: "inherit",
            color: isInProgress ? "#FF1B8D" : "var(--text-primary)",
          }}>
            {task.scheduledTime || task.time || "미정"}
          </div>
          <StatusBadge status={isInProgress ? "in_progress" : isDone ? "completed" : isUntimed ? "pending" : "confirmed"}/>
        </div>

        <div style={{
          fontSize: 16, fontWeight: 700, marginBottom: 6,
          color: isDone ? "var(--text-secondary)" : "var(--text-primary)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span>{task.customer}</span>
          {(task.client === '유솔홈케어 N' || task.principalId === 'usol_n' || task.principalCode === 'usol_n') && (
            <span style={{
              background: '#03C75A', color: 'white',
              fontSize: 9, padding: '2px 5px',
              borderRadius: 4, fontWeight: 800,
            }}>N</span>
          )}
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 700,
          color: "var(--text-secondary)",
        }}>
          <ServiceTypeIcon workType={task.workType} size={13} showLabel={true}/>
          <span>
            {task.appliance ? `· ${task.appliance}` : ""}
            {task.qty ? ` ×${task.qty}` : ""}
            {task.region ? ` · ${task.region}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// 공통 요소
// ───────────────────────────────────────────────
// V14 — 상태 알약 (헌법: 진행중 핑크 / 확정 회색 / 약속미정 회색 / 완료 그린 / 취소 빨강)
function StatusBadge({ status }) {
  const styles = {
    in_progress: { bg: "rgba(255,27,141,0.10)",  text: "#FF1B8D", icon: "●", label: "진행중" },
    confirmed:   { bg: "var(--pending-pill-bg)", text: "var(--label-main)", icon: "●", label: "확정" },
    pending:     { bg: "var(--pending-pill-bg)", text: "var(--label-sub)",  icon: "●", label: "약속미정" },
    completed:   { bg: "var(--completed-pill-bg)", text: "var(--completed-pill-text)", icon: "✓", label: "완료" },
    canceled:    { bg: "rgba(255,59,92,0.10)",  text: "#FF3B5C", icon: "✕", label: "취소" },
  };
  const s = styles[status] || styles.confirmed;
  return (
    <span style={{
      background: s.bg, color: s.text,
      fontSize: 11, padding: "3px 9px",
      borderRadius: 999, fontWeight: 700,
      whiteSpace: "nowrap",
    }}>
      {s.icon} {s.label}
    </span>
  );
}

function DayTaskCard({ task, onClick }) {
  const isActive = task.status === "진행중";
  const isUntimed = task.status === "미배정";
  // 2026-05-22 — visit_only 측 "완료 계열" (흐릿 + opacity)
  const isDone = isCompletedStatus(task.status);
  // 2026-05-24 — 취소 카드 흐리게 (opacity 0.4)
  const isCancelled = task.status === "취소";

  const cardStyle = isActive
    ? { background: "transparent", border: "2px solid #FF1B8D" }
    : isUntimed
      ? { background: "rgba(255,138,61,0.08)", border: "1px solid rgba(255,138,61,0.30)" }
      : isDone
        ? { background: "var(--bg-secondary)", border: "1px solid var(--border)", opacity: 0.7 }
        : { background: "var(--bg-secondary)", border: "1px solid var(--border)" };
  if (isCancelled) cardStyle.opacity = 0.4;

  return (
    <div onClick={onClick} className="clickable" style={{
      display: "flex", alignItems: "center", padding: 12,
      borderRadius: 10, cursor: "pointer",
      ...cardStyle,
    }}>
      <div style={{ width: 60 }}>
        {isUntimed ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#FF8A3D" }}>미정</div>
            <div style={{ fontSize: 11, color: "#FF8A3D", fontWeight: 700, marginTop: 2 }}>약속</div>
          </>
        ) : (
          <>
            <div style={{
              fontSize: 16, fontWeight: 800,
              fontFamily: "inherit",
              color: isActive ? "#FF1B8D" : "var(--text-primary)",
            }}>
              {task.scheduledTime || task.time || "—"}
            </div>
            <div style={{
              fontSize: 11,
              color: isActive ? "#FF1B8D" : isDone ? "#03C75A" : "var(--text-secondary)",
              fontWeight: 700, marginTop: 2,
            }}>
              {/* 2026-05-22 — visit_only 측 한글 변환 ("출장비만") */}
              {statusLabel(task.status)}
            </div>
          </>
        )}
      </div>
      <div style={{ flex: 1, padding: "0 10px", minWidth: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: 700,
          color: isDone ? "var(--text-secondary)" : "var(--text-primary)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span>{task.customer}</span>
          {(task.client === '유솔홈케어 N' || task.principalId === 'usol_n' || task.principalCode === 'usol_n') && (
            <span style={{
              background: '#03C75A', color: 'white',
              fontSize: 9, padding: '2px 5px',
              borderRadius: 4, fontWeight: 800,
            }}>N</span>
          )}
        </div>
        <div style={{
          fontSize: 13, color: "var(--text-secondary)",
          marginTop: 4, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
        }}>
          <ServiceTypeIcon workType={task.workType} size={12} showLabel={true}/>
          <span>
            {task.appliance ? `· ${task.appliance}` : ""}
            {task.qty ? ` ×${task.qty}` : ""}
            {task.region ? ` · ${task.region}` : ""}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 18, color: "var(--text-secondary)" }}>›</span>
    </div>
  );
}

// V14 v8 fix — N 마크는 사장님 헌법 따라 모든 카드에서 인라인 렌더 (import 누락 위험 0)

function EmptyState({ text }) {
  return (
    <div style={{
      padding: 28, textAlign: "center",
      color: "var(--text-secondary)", fontSize: 14,
      background: "var(--bg-secondary)",
      borderRadius: 10,
    }}>
      {text}
    </div>
  );
}

export default EngineerCalendarTab;
