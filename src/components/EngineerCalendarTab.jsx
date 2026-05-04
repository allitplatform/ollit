// V14 — 기사 PWA 캘린더 탭 (토글 3개)
// 오늘 = 시간순 타임라인 / 주간 = 7일 그룹 / 월간 = 큰 캘린더 + 휴무 추가

import { useMemo, useState } from "react";
import { EngineerBottomNav } from "./EngineerBottomNav.jsx";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
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

export function EngineerCalendarTab({
  engineer,
  tasks = [],
  offDays = [],
  onAddOff,
  onClickTask,
  onTabChange,
  unreadCount = 0,
}) {
  const [view, setView] = useState("month");           // today / week / month
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

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
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(monthYear, monthIdx, d);
      const ymd  = formatYmd(date);
      const dow  = date.getDay();
      // 완전 휴무 — single/range/repeat/타입 미지정 (옛 데이터)
      const isFullOff = (offDays || []).some(o => {
        const type = o.type;
        if (type === "hourly") return false;
        if (type === "range")  return o.startDate && o.endDate && ymd >= o.startDate && ymd <= o.endDate;
        if (type === "repeat") return Array.isArray(o.weekdays) && o.weekdays.includes(dow);
        return o.date === ymd;
      });
      // 시간 단위 휴무 (hourly)
      const hourlyList = (offDays || []).filter(o => o.type === "hourly" && o.date === ymd);
      if (isFullOff) {
        if (!byDate[ymd]) byDate[ymd] = { tasks: [] };
        byDate[ymd].offDay = true;
        offCount += 1;
      }
      if (hourlyList.length > 0) {
        if (!byDate[ymd]) byDate[ymd] = { tasks: [] };
        byDate[ymd].hourlyOffs = hourlyList;
      }
    }

    return { byDate, count, offCount };
  }, [tasks, offDays, currentMonth]);

  const dayTasks = useMemo(() => {
    const k = formatYmd(selectedDate);
    return [...(monthData.byDate[k]?.tasks || [])].sort(compareTime);
  }, [monthData, selectedDate]);

  const dayHourlyOffs = useMemo(() => {
    const k = formatYmd(selectedDate);
    return monthData.byDate[k]?.hourlyOffs || [];
  }, [monthData, selectedDate]);

  // 오늘 타임라인용
  const todayTasks = useMemo(() => {
    const today = new Date();
    return tasks
      .filter(t => {
        const day = t.scheduledDate || t.workDate;
        return day && isSameDay(new Date(day), today);
      })
      .sort(compareTime);
  }, [tasks]);

  // 주간용 (오늘부터 7일)
  const weekDays = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      const dayTasks = tasks
        .filter(t => {
          const day = t.scheduledDate || t.workDate;
          return day && isSameDay(new Date(day), date);
        })
        .sort(compareTime);
      const offDay = (offDays || []).some(o => o.date && isSameDay(new Date(o.date), date));
      days.push({ date, tasks: dayTasks, offDay });
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
          <button onClick={onAddOff} style={{
            padding: "10px 14px",
            background: "#FF1B8D",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 13, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
          }}>
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
          onClickTask={onClickTask}
        />
      )}
      {view === "week" && (
        <WeekView weekDays={weekDays} onClickTask={onClickTask}/>
      )}
      {view === "today" && (
        <TodayView todayTasks={todayTasks} onClickTask={onClickTask}/>
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
  monthData, dayTasks, dayHourlyOffs = [], onClickTask,
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

      {/* 선택한 날 일정 */}
      <div style={{ padding: "16px" }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {formatDateLong(selectedDate)}
            {isToday(selectedDate) && <span style={{ color: "#FF1B8D" }}> · 오늘</span>}
          </div>
          <div style={{
            fontSize: 12, color: "var(--text-secondary)",
            marginTop: 4, fontWeight: 600,
          }}>
            {dayTasks.length}건
            {countByStatus(dayTasks, "진행중") > 0 && ` · 진행중 ${countByStatus(dayTasks, "진행중")}`}
            {countByStatus(dayTasks, "확정")   > 0 && ` · 확정 ${countByStatus(dayTasks, "확정")}`}
            {countByStatus(dayTasks, "약속대기") > 0 && ` · 약속미정 ${countByStatus(dayTasks, "약속대기")}`}
          </div>
        </div>

        {dayTasks.length === 0 && dayHourlyOffs.length === 0 ? (
          <EmptyState text="이 날은 일정이 없어요"/>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dayTasks.map(t => (
              <DayTaskCard key={t.id} task={t} onClick={() => onClickTask && onClickTask(t.id)}/>
            ))}
            {dayHourlyOffs.map((off, i) => (
              <HourlyOffCard key={`hoff-${i}`} off={off}/>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function HourlyOffCard({ off }) {
  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 14,
      padding: "12px 14px 12px 18px",
      position: "relative",
      overflow: "hidden",
      opacity: 0.85,
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4, background: "#999",
      }}/>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 13, color: "var(--text-secondary)", fontWeight: 600,
        flexWrap: "wrap",
      }}>
        <span>⏰</span>
        <span>{off.startTime || "—"} ~ {off.endTime || "—"} 휴무</span>
        {off.reason ? <span style={{ color: "var(--text-tertiary)" }}>· {off.reason}</span> : null}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// 주간 뷰 — 7일 그룹
// ───────────────────────────────────────────────
function WeekView({ weekDays, onClickTask }) {
  return (
    <div style={{ padding: "16px" }}>
      {weekDays.map(({ date, tasks: dt, offDay }, idx) => (
        <div key={idx} style={{ marginBottom: 18 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 8, paddingLeft: 4,
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
            {offDay && (
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
              {dt.length > 0 ? `${dt.length}건` : ""}
            </span>
          </div>

          {dt.length === 0 ? (
            <div style={{
              padding: "10px 14px",
              background: "var(--bg-secondary)",
              borderRadius: 8,
              fontSize: 12, color: "var(--text-tertiary)",
              fontWeight: 600,
            }}>
              {offDay ? "휴무" : "일정 없음"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {dt.map(t => (
                <DayTaskCard key={t.id} task={t} onClick={() => onClickTask && onClickTask(t.id)}/>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────
// 오늘 뷰 — 시간순 타임라인
// ───────────────────────────────────────────────
function TodayView({ todayTasks, onClickTask }) {
  if (todayTasks.length === 0) {
    return (
      <div style={{ padding: "16px" }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {formatDateLong(new Date())} · <span style={{ color: "#FF1B8D" }}>오늘</span>
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
          {formatDateLong(new Date())} · <span style={{ color: "#FF1B8D" }}>오늘</span>
        </div>
        <div style={{
          fontSize: 12, color: "var(--text-secondary)",
          marginTop: 4, fontWeight: 600,
        }}>
          {todayTasks.length}건 · 시간순
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

        {todayTasks.map((task, i) => (
          <TimelineRow
            key={task.id}
            task={task}
            isLast={i === todayTasks.length - 1}
            onClick={() => onClickTask && onClickTask(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineRow({ task, onClick }) {
  const status = task.status;
  const isInProgress = status === "진행중";
  const isDone = status === "완료";
  const isUntimed = status === "약속대기";

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
        }}>
          {task.customer}
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
  const isUntimed = task.status === "약속대기";
  const isDone = task.status === "완료";

  const cardStyle = isActive
    ? { background: "transparent", border: "2px solid #FF1B8D" }
    : isUntimed
      ? { background: "rgba(255,138,61,0.08)", border: "1px solid rgba(255,138,61,0.30)" }
      : isDone
        ? { background: "var(--bg-secondary)", border: "1px solid var(--border)", opacity: 0.7 }
        : { background: "var(--bg-secondary)", border: "1px solid var(--border)" };

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
              {task.status}
            </div>
          </>
        )}
      </div>
      <div style={{ flex: 1, padding: "0 10px", minWidth: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: 700,
          color: isDone ? "var(--text-secondary)" : "var(--text-primary)",
        }}>
          {task.customer}
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
