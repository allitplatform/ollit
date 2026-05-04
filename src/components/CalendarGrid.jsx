// V13-FINAL2 — 공유 캘린더 그리드 + date 헬퍼
// 캘린더 탭 + 유솔N 둘 다 사용 / 점·히트맵·휴무·오늘 보더 분기

// ──────────────── date helpers ────────────────
export function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}

export function isSameMonth(a, b) {
  if (!a || !b) return false;
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
}

export function isToday(d) {
  return isSameDay(d, new Date());
}

export function differenceInDays(a, b) {
  const da = new Date(a), db = new Date(b);
  da.setHours(0, 0, 0, 0); db.setHours(0, 0, 0, 0);
  return Math.round((da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatYmd(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function formatMonthLabel(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월`;
}

export function formatMonthShort(d) {
  return `${new Date(d).getMonth() + 1}월`;
}

export function formatDateLong(d) {
  const dt = new Date(d);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${days[dt.getDay()]})`;
}

export function getNextMonth15(date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  next.setDate(15);
  return next;
}

export function addMonths(date, n) {
  const dt = new Date(date);
  dt.setMonth(dt.getMonth() + n);
  return dt;
}

// 월 일자 배열 (앞뒤 빈칸 포함, 7×N 그리드)
export function generateMonthDays(month) {
  const dt = new Date(month);
  const year = dt.getFullYear();
  const m = dt.getMonth();
  const firstDay = new Date(year, m, 1);
  const lastDay = new Date(year, m + 1, 0);
  const startWeekday = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days = [];
  // 앞 빈칸 (이전 달)
  for (let i = 0; i < startWeekday; i++) {
    days.push({ date: new Date(year, m, -startWeekday + i + 1), isCurrentMonth: false, dayOfWeek: i });
  }
  // 이번 달
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, m, d);
    days.push({ date, isCurrentMonth: true, dayOfWeek: date.getDay() });
  }
  // 뒤 빈칸 (7의 배수)
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1].date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    days.push({ date: next, isCurrentMonth: false, dayOfWeek: next.getDay() });
  }
  return days;
}

// V14 — 점 색 = 작업 종류 (헌법: 정보/분류)
function getWorkTypeDotColor(workType) {
  if (!workType) return "#FF1B8D";
  const t = String(workType).toLowerCase();
  if (t.includes("세척"))                          return "#0EA5E9";
  if (t.includes("냉매") || t.includes("충전"))    return "#FFB800";
  return "#FF1B8D"; // 기타 (설치/점검/수리)
}

// ──────────────── CalendarGrid ────────────────
export function CalendarGrid({
  month,
  selectedDate,
  dayData = {},
  onSelectDate,
  showStatusDots = false,
  showHeatmap = false,
  showOffDay = false,
  highlightToday = false,
  colorScheme = "pink", // "pink" | "green"
}) {
  const days = generateMonthDays(month);

  return (
    <div>
      {/* 요일 헤더 */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        gap: 2, marginBottom: 4,
      }}>
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <div key={d} style={{
            textAlign: "center",
            fontSize: 9, padding: "4px 0", fontWeight: 600,
            color: i === 0 ? "#FF6B6B" : i === 6 ? "#6FA8FF" : "var(--text-secondary)",
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3,
      }}>
        {days.map(({ date, isCurrentMonth, dayOfWeek }, idx) => {
          if (!isCurrentMonth) {
            return <div key={idx} style={{ aspectRatio: "1" }}/>;
          }
          const data = dayData[formatYmd(date)] || {};
          const tasks = data.tasks || [];
          const isOff = !!data.offDay;
          const isSel = isSameDay(date, selectedDate);
          const isTodayDate = isToday(date) && highlightToday;

          return (
            <DayCell
              key={idx}
              date={date}
              dayOfWeek={dayOfWeek}
              tasks={tasks}
              isOffDay={isOff && showOffDay}
              isSelected={isSel}
              isToday={isTodayDate}
              showDots={showStatusDots}
              showHeatmap={showHeatmap}
              colorScheme={colorScheme}
              onClick={() => onSelectDate && onSelectDate(date)}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  date, dayOfWeek, tasks, isOffDay,
  isSelected, isToday, showDots, showHeatmap, colorScheme, onClick,
}) {
  // V14 — 휴무 셀: 진한 회색 배경 + line-through + "휴무" 라벨 (사장님 spec)
  if (isOffDay) {
    return (
      <div onClick={onClick} style={{
        aspectRatio: "1",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        paddingTop: 2,
        borderRadius: 6,
        cursor: "pointer",
        background: "var(--off-day-bg, rgba(136,135,128,0.18))",
        border: `1px solid ${isSelected ? "#FF1B8D" : "transparent"}`,
        position: "relative",
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: "#999",
          textDecoration: "line-through",
          marginBottom: 2,
        }}>
          {date.getDate()}
        </div>
        <div style={{
          fontSize: 8, color: "#999",
          fontWeight: 700, letterSpacing: 0.3,
        }}>
          휴무
        </div>
      </div>
    );
  }

  let bg = "transparent";
  let borderColor = "transparent";

  if (showHeatmap && tasks.length > 0) {
    const isGreen = colorScheme === "green";
    if (tasks.length >= 3) {
      bg = isGreen ? "rgba(0,135,90,0.18)" : "rgba(255,27,141,0.18)";
    } else {
      bg = isGreen ? "rgba(0,135,90,0.08)" : "rgba(255,27,141,0.08)";
    }
  }

  if (isSelected) {
    bg = colorScheme === "green" ? "#00875A" : "rgba(255,27,141,0.15)";
    borderColor = colorScheme === "green" ? "#00875A" : "#FF1B8D";
  }

  if (isToday) {
    borderColor = "#FF1B8D";
  }

  const numColor = isSelected && colorScheme === "green"
    ? "#fff"
    : dayOfWeek === 0
      ? "#FF6B6B"
      : dayOfWeek === 6
        ? "#6FA8FF"
        : "var(--text-primary)";

  return (
    <div onClick={onClick} style={{
      aspectRatio: "1",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-start",
      paddingTop: 4,
      borderRadius: 6,
      cursor: "pointer",
      background: bg,
      border: `${isToday ? 1.5 : 1}px solid ${borderColor}`,
      position: "relative",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: numColor, marginBottom: 2,
      }}>
        {date.getDate()}
      </div>

      {showDots && tasks.length > 0 && (
        <div style={{
          display: "flex", gap: 1.5, flexWrap: "wrap",
          justifyContent: "center", maxWidth: 28,
        }}>
          {tasks.slice(0, 6).map((t, i) => (
            <span key={i} style={{
              width: 4, height: 4, borderRadius: "50%",
              background: getWorkTypeDotColor(t.workType),
            }}/>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: color, display: "inline-block",
      }}/>
      <span>{label}</span>
    </div>
  );
}

export default CalendarGrid;
