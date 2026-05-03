// V13-FINAL2 — 기사 PWA 캘린더 탭
// 월 캘린더 (점/휴무/오늘 보더) + 일별 작업 리스트 + 휴무 추가

import { useMemo, useState } from "react";
import { EngineerBottomNav } from "./EngineerBottomNav.jsx";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import {
  CalendarGrid, Legend,
  formatYmd, formatMonthLabel, formatMonthShort, formatDateLong,
  isToday, addMonths,
} from "./CalendarGrid.jsx";

const navBtnStyle = {
  width: 32, height: 32,
  background: "transparent",
  border: "none",
  color: "#FF1B8D", fontSize: 22, fontWeight: 700,
  lineHeight: 1, cursor: "pointer", fontFamily: "inherit",
  padding: "4px 8px",
};

function countByStatus(tasks, status) {
  return tasks.filter(t => t.status === status).length;
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
    let offCount = 0;
    (offDays || []).forEach(o => {
      if (!o.date) return;
      const date = new Date(o.date);
      if (date.getFullYear() !== currentMonth.getFullYear()
        || date.getMonth() !== currentMonth.getMonth()) return;
      const k = formatYmd(date);
      if (!byDate[k]) byDate[k] = { tasks: [] };
      byDate[k].offDay = true;
      offCount += 1;
    });
    return { byDate, count, offCount };
  }, [tasks, offDays, currentMonth]);

  const dayTasks = useMemo(() => {
    const k = formatYmd(selectedDate);
    return monthData.byDate[k]?.tasks || [];
  }, [monthData, selectedDate]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 80,
      color: "var(--text-primary)",
    }}>
      {/* 헤더 */}
      <div style={{
        padding: "14px 16px", borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--bg-primary)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>📅 캘린더</div>
            <div style={{
              fontSize: 12, color: "var(--text-secondary)", marginTop: 2,
            }}>
              {engineer?.name || "기사"}님 · {formatMonthShort(currentMonth)} {monthData.count}건 · 휴무 {monthData.offCount}일
            </div>
          </div>
          <button onClick={onAddOff} style={{
            padding: "8px 14px",
            background: "#FF1B8D",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            + 휴무 추가
          </button>
        </div>
      </div>

      {/* 월 네비 + 캘린더 */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} style={navBtnStyle}>‹</button>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {formatMonthLabel(currentMonth)}
            </span>
            <button
              onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}
              style={{
                background: "transparent", border: "none",
                color: "#FF1B8D", fontSize: 11, cursor: "pointer",
                padding: "2px 6px", fontFamily: "inherit",
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
          display: "flex", gap: 10, padding: "10px 0 0",
          marginTop: 6, fontSize: 11, color: "var(--text-secondary)",
          justifyContent: "center", flexWrap: "wrap",
          borderTop: "1px solid var(--border)",
        }}>
          <Legend color="#FF1B8D" label="진행중"/>
          <Legend color="#888780" label="확정"/>
          <Legend color="#FFB300" label="약속미정"/>
          <Legend color="#00875A" label="완료"/>
        </div>
      </div>

      {/* 선택한 날 일정 */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 10,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {formatDateLong(selectedDate)}
              {isToday(selectedDate) && " · 오늘"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              {dayTasks.length}건
              {countByStatus(dayTasks, "진행중") > 0 && ` · 진행중 ${countByStatus(dayTasks, "진행중")}`}
              {countByStatus(dayTasks, "확정") > 0 && ` · 확정 ${countByStatus(dayTasks, "확정")}`}
              {countByStatus(dayTasks, "약속대기") > 0 && ` · 약속미정 ${countByStatus(dayTasks, "약속대기")}`}
            </div>
          </div>
        </div>

        {dayTasks.length === 0 ? (
          <div style={{
            padding: 24, textAlign: "center",
            color: "var(--text-secondary)", fontSize: 13,
          }}>
            이 날은 일정이 없어요
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {dayTasks.map(t => (
              <DayTaskCard key={t.id} task={t} onClick={() => onClickTask && onClickTask(t.id)}/>
            ))}
          </div>
        )}
      </div>

      <EngineerBottomNav active="cal" onChange={onTabChange} unreadCount={unreadCount}/>
    </div>
  );
}

function DayTaskCard({ task, onClick }) {
  const isActive = task.status === "진행중";
  const isUntimed = task.status === "약속대기";

  const cardStyle = isActive
    ? { background: "rgba(255,27,141,0.08)", border: "1px solid rgba(255,27,141,0.3)" }
    : isUntimed
      ? { background: "rgba(255,179,0,0.08)", border: "1px solid rgba(255,179,0,0.3)" }
      : { background: "var(--bg-secondary)", border: "none" };

  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", padding: 10,
      borderRadius: 8, cursor: "pointer",
      ...cardStyle,
    }}>
      <div style={{ width: 50 }}>
        {isUntimed ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FFB300" }}>미정</div>
            <div style={{ fontSize: 8, color: "#FFB300", fontWeight: 700, marginTop: 2 }}>약속</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>
              {task.scheduledTime || task.time || "—"}
            </div>
            <div style={{
              fontSize: 8,
              color: isActive ? "#FF1B8D" : "var(--text-secondary)",
              fontWeight: 700,
            }}>
              {task.status}
            </div>
          </>
        )}
      </div>
      <div style={{ flex: 1, padding: "0 8px", minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{task.customer}</div>
        <div style={{
          fontSize: 11, color: "var(--text-secondary)", marginTop: 1,
          display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
        }}>
          <ServiceTypeIcon workType={task.workType} size={11} showLabel={true}/>
          <span>
            {task.appliance ? `· ${task.appliance}` : ""}
            {task.qty ? ` ×${task.qty}` : ""}
            {task.region ? ` · ${task.region}` : ""}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>›</span>
    </div>
  );
}

export default EngineerCalendarTab;
