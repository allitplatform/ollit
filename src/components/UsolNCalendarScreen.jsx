// V13-FINAL2 — 유솔N 정산 달력 뷰 (별도 화면)
// 누계 박스 (그린) + 월 캘린더 (그린 히트맵) + 일별 작업 리스트

import { useMemo, useState } from "react";
import {
  CalendarGrid, Legend,
  formatYmd, formatMonthLabel, formatMonthShort, formatDateLong,
  isSameMonth, isToday, differenceInDays,
  getNextMonth15, addMonths,
} from "./CalendarGrid.jsx";

const navBtnStyle = {
  width: 28, height: 28, borderRadius: "50%",
  background: "var(--bg-secondary)",
  border: "none",
  color: "var(--text-primary)", fontSize: 14,
  cursor: "pointer", fontFamily: "inherit",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const backBtnStyle = {
  background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 13,
  cursor: "pointer", fontFamily: "inherit",
  padding: "4px 10px",
};

function getEarning(t) {
  return t.engineerEarning || t.engineerNet || 0;
}

export function UsolNCalendarScreen({
  engineer,
  monthData = { totalAmount: 0, count: 0, byDate: {} },
  loadDayTasks,
  onBack,
  initialMonth,
}) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth || new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const dayTasks = useMemo(
    () => (loadDayTasks ? loadDayTasks(selectedDate) : []),
    [selectedDate, loadDayTasks]
  );
  const dayEarning = dayTasks.reduce((s, t) => s + getEarning(t), 0);

  const isCurrentMonth = isSameMonth(currentMonth, new Date());
  const payDate = getNextMonth15(currentMonth);
  const dDay = Math.max(0, differenceInDays(payDate, new Date()));

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 60,
      color: "var(--text-primary)",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--bg-primary)",
      }}>
        <button onClick={onBack} style={backBtnStyle}>← 뒤로</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>🟢 유솔N 정산</div>
          <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2 }}>
            월 단위 / 다음 달 15일 입금
          </div>
        </div>
        <div style={{ width: 40 }}/>
      </div>

      {/* 누계 박스 */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          background: "rgba(0,135,90,0.10)",
          border: "1px solid rgba(0,135,90,0.4)",
          borderRadius: 12, padding: 14,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
          }}>
            <span style={{ fontSize: 11, color: "#00875A", fontWeight: 700 }}>
              {formatMonthShort(currentMonth)} 누계
              {isCurrentMonth ? " (진행 중)" : ""}
            </span>
            <span style={{
              marginLeft: "auto", fontSize: 9, color: "var(--text-secondary)",
            }}>
              {isCurrentMonth ? `D-${dDay}` : "✓"} / {payDate.getMonth() + 1}/{payDate.getDate()} 입금
            </span>
          </div>
          <div style={{
            fontSize: 26, fontWeight: 700, color: "#00875A",
            fontFamily: "monospace", letterSpacing: "-1px",
          }}>
            ₩{(monthData.totalAmount || 0).toLocaleString("ko-KR")}
          </div>
          <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 4 }}>
            {monthData.count || 0}건 작업
          </div>
        </div>
      </div>

      {/* 월 네비 + 캘린더 */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} style={navBtnStyle}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {formatMonthLabel(currentMonth)}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} style={navBtnStyle}>›</button>
        </div>

        <CalendarGrid
          month={currentMonth}
          selectedDate={selectedDate}
          dayData={monthData.byDate}
          onSelectDate={setSelectedDate}
          colorScheme="green"
          showHeatmap={true}
        />

        <div style={{
          display: "flex", gap: 12, padding: "8px 0 0",
          marginTop: 6, fontSize: 9, color: "var(--text-secondary)",
          justifyContent: "center", borderTop: "1px solid var(--border)",
        }}>
          <Legend color="rgba(0,135,90,0.08)" label="1~2건"/>
          <Legend color="rgba(0,135,90,0.18)" label="3건+"/>
        </div>
      </div>

      {/* 선택한 날 리스트 */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700 }}>
            📋 {formatDateLong(selectedDate)}
          </span>
          {dayEarning > 0 && (
            <span style={{
              fontSize: 11, color: "#00875A", fontWeight: 700,
              fontFamily: "monospace",
            }}>
              ₩{dayEarning.toLocaleString("ko-KR")}
            </span>
          )}
        </div>

        {dayTasks.length === 0 ? (
          <div style={{
            padding: 24, textAlign: "center",
            color: "var(--text-secondary)", fontSize: 11,
          }}>
            이 날은 작업이 없어요
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {dayTasks.map(t => (
              <div key={t.id} style={{
                display: "flex", padding: 10,
                background: "var(--bg-secondary)", borderRadius: 8,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 4, marginBottom: 2,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{t.customer}</span>
                    <span style={{ fontSize: 8, color: "var(--text-secondary)" }}>
                      {t.scheduledTime || t.time || ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text-secondary)" }}>
                    {t.appliance}{t.qty ? ` ×${t.qty}` : ""}
                    {t.region ? ` · ${t.region}` : ""}
                  </div>
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                }}>
                  ₩{getEarning(t).toLocaleString("ko-KR")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default UsolNCalendarScreen;
