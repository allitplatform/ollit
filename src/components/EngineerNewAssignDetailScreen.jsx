// V14 정제 — 새 배정 상세
// 흰 카드 + 좌측 4px 핑크 바 / 추가금 영역 제거 / 색 절제

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import { DropdownPicker, HOURS_24, MINUTES_30 } from "./DropdownPicker.jsx";
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { WorkItemRow } from "./WorkItemRow.jsx";

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatMd(date) {
  const d = new Date(date);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

const PhoneSvgWhite = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="#fff" strokeWidth="2.4"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const NavSvgWhite = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="#fff" strokeWidth="2.4"
       strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
  </svg>
);

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 15, fontWeight: 600,
      color: "var(--text-primary)",
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: 14,
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  borderRadius: 10,
  color: "var(--text-primary)",
  fontSize: 15, fontWeight: 600,
  boxSizing: "border-box",
  outline: "none", fontFamily: "inherit",
};

export function EngineerNewAssignDetailScreen({
  task,
  onBack,
  onSave,
  onUnableSchedule,
  onCustomerCancel,
  onAskOps,
}) {
  const [memo, setMemo]               = useState(task?.callMemo || "");
  const [datePreset, setDatePreset]   = useState("tomorrow");
  const [customDate, setCustomDate]   = useState("");
  const [startHour, setStartHour]     = useState("14");
  const [startMin, setStartMin]       = useState("00");
  const [endHour, setEndHour]         = useState("16");
  const [endMin, setEndMin]           = useState("00");

  if (!task) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
        작업 정보 없음
      </div>
    );
  }

  const colors = getWorkTypeColors(task.workType);
  const today    = new Date();
  const tomorrow = addDays(today, 1);

  function makeCall() {
    if (task.phone) window.location.href = `tel:${task.phone}`;
  }

  function openMap() {
    const address = encodeURIComponent(task.fullAddress || task.address || "");
    if (!address) return;
    window.open(`https://map.kakao.com/?q=${address}`, "_blank");
  }

  function handleSave() {
    onSave && onSave({
      memo, datePreset, customDate,
      startTime: `${startHour}:${startMin}`,
      endTime:   `${endHour}:${endMin}`,
    });
  }

  // 시간 미리보기
  const startStr = `${startHour}:${startMin}`;
  const endStr   = `${endHour}:${endMin}`;
  const startMins = parseInt(startHour) * 60 + parseInt(startMin);
  const endMins   = parseInt(endHour)   * 60 + parseInt(endMin);
  const durationMins = endMins - startMins;
  const durationStr = durationMins > 0
    ? durationMins % 60 === 0
        ? `${durationMins / 60}시간`
        : `${Math.floor(durationMins / 60)}시간 ${durationMins % 60}분`
    : "—";

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
      paddingBottom: 30,
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-primary)",
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none",
          color: "var(--text-primary)", padding: 4,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center",
        }}>
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 600 }}>
          새 배정
        </div>
        <div style={{ width: 28 }}/>
      </div>

      {/* 1. 정보 카드 (흰 카드 + 좌측 4px 핑크 바) */}
      <div style={{ padding: 16 }}>
        <div style={{
          position: "relative",
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "16px 16px 16px 20px",
          overflow: "hidden",
          marginBottom: 12,
        }}>
          {/* 좌측 4px 바 — 작업 종류 색 */}
          <div style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: 4,
            background: colors.main,
          }}/>

          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 13, fontWeight: 600,
            color: colors.main,
            marginBottom: 6,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: colors.main,
              display: "inline-block",
            }}/>
            새 배정
            {task.requestedAgo && (
              <span style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>
                · {task.requestedAgo}
              </span>
            )}
          </div>

          {/* V14 — 작업 항목 한 줄 박스 */}
          <div style={{ marginBottom: 14 }}>
            <WorkItemRow
              workType={task.workType}
              appliance={task.appliance}
              qty={task.qty}
              price={task.estimateTotal}
              client={task.client}
              dividerTop={false}
            />
          </div>

          <div style={{
            fontSize: 26, fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.3px",
            marginBottom: 6,
          }}>
            {task.customer || "—"}님
          </div>

          <div style={{
            fontSize: 14, fontWeight: 600,
            color: "var(--text-secondary)",
            marginBottom: 4,
          }}>
            📞 {task.phone || "—"}
          </div>

          <div style={{
            fontSize: 14, fontWeight: 600,
            color: "var(--text-secondary)",
          }}>
            📍 {task.fullAddress || task.address || "—"}
          </div>
        </div>

        {/* 통화 + 길찾기 */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
        }}>
          <button onClick={makeCall} style={{
            padding: 13,
            background: "#34C759",
            border: "none", borderRadius: 10,
            color: "#fff",
            fontSize: 15, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
          }}>
            <PhoneSvgWhite/> 통화
          </button>
          <button onClick={openMap} style={{
            padding: 13,
            background: colors.main,
            border: "none", borderRadius: 10,
            color: "#fff",
            fontSize: 15, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
          }}>
            <NavSvgWhite/> 길찾기
          </button>
        </div>
      </div>

      {/* 2. 노랑 요청사항 박스 */}
      {(task.customerRequest || task.requestedDate) && (
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{
            position: "relative",
            background: "var(--request-bg)",
            borderRadius: 12,
            padding: "14px 14px 14px 18px",
            overflow: "hidden",
          }}>
            {/* 좌측 4px 노란 바 */}
            <div style={{
              position: "absolute",
              left: 0, top: 0, bottom: 0,
              width: 4,
              background: "#FFB800",
            }}/>
            <div style={{
              fontSize: 14, fontWeight: 600,
              color: "var(--request-text)",
              marginBottom: 6,
            }}>
              ⚠️ 고객 요청사항
            </div>
            {task.customerRequest && (
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: "var(--text-primary)",
                lineHeight: 1.5,
                marginBottom: task.requestedDate ? 6 : 0,
              }}>
                {task.customerRequest}
              </div>
            )}
            {task.requestedDate && (
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: "var(--request-sub)",
              }}>
                🕐 고객 희망: {task.requestedDate} {task.requestedTime || ""}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. 입력 카드 */}
      <div style={{ padding: "0 16px 14px" }}>
        <div style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "18px 16px",
        }}>
          {/* 일정 협의 */}
          <SectionLabel>📅 일정 협의</SectionLabel>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
            marginBottom: 14,
          }}>
            <DatePill active={datePreset === "today"}    label="오늘"    sub={formatMd(today)}    onClick={() => setDatePreset("today")}/>
            <DatePill active={datePreset === "tomorrow"} label="내일"    sub={formatMd(tomorrow)} onClick={() => setDatePreset("tomorrow")}/>
            <DatePill active={datePreset === "custom"}   label="다른 날짜" sub="📅"                onClick={() => setDatePreset("custom")}/>
          </div>

          {datePreset === "custom" && (
            <input type="date" value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              style={{ ...inputStyle, marginBottom: 14 }}/>
          )}

          {/* 시간 선택 */}
          <SectionLabel>⏰ 시간 선택</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", width: 36, fontWeight: 600 }}>시작</span>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <DropdownPicker value={startHour} options={HOURS_24}    onChange={setStartHour}/>
              <DropdownPicker value={startMin}  options={MINUTES_30}  onChange={setStartMin}/>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", width: 36, fontWeight: 600 }}>종료</span>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <DropdownPicker value={endHour} options={HOURS_24}   onChange={setEndHour}/>
              <DropdownPicker value={endMin}  options={MINUTES_30} onChange={setEndMin}/>
            </div>
          </div>
          <div style={{
            padding: 11,
            background: "var(--time-summary-bg)",
            borderRadius: 10,
            fontSize: 14, fontWeight: 600,
            color: "var(--text-primary)",
            textAlign: "center",
            marginBottom: 16,
          }}>
            <span style={{
              fontFamily: "inherit",
            }}>
              {startStr} ~ {endStr}
            </span>
            <span style={{ color: "var(--text-secondary)", margin: "0 6px" }}>·</span>
            <span style={{ color: "var(--time-summary-accent)", fontWeight: 600 }}>
              {durationStr}
            </span>
          </div>

          {/* 메모 */}
          <SectionLabel>📝 메모</SectionLabel>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
            placeholder="고객과 협의한 내용 / 특이사항"
            style={{ ...inputStyle, minHeight: 56, resize: "vertical" }}/>
        </div>
      </div>

      {/* 4. 액션 3개 */}
      <div style={{ padding: "0 16px" }}>
        <button onClick={handleSave} style={{
          width: "100%", padding: 16,
          background: "#FF1B8D", border: "none",
          borderRadius: 12, color: "#fff",
          fontSize: 16, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
          marginBottom: 8,
        }}>
          ✓ 일정 확정
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={onUnableSchedule} style={{
            padding: 14,
            background: "var(--card-bg)",
            border: "1.5px solid #FFB800",
            borderRadius: 12,
            color: "var(--refrig-text)",
            fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            ⚠️ 일정 불가
          </button>
          <button onClick={onCustomerCancel} style={{
            padding: 14,
            background: "var(--card-bg)",
            border: "1.5px solid #FF3B5C",
            borderRadius: 12,
            color: "var(--cancel-text)",
            fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            ✕ 고객 취소
          </button>
        </div>
      </div>

      {/* 5. 운영팀 문의 */}
      <div style={{ padding: "20px 16px 8px", textAlign: "center" }}>
        <button onClick={onAskOps} style={{
          background: "transparent", border: "none",
          color: "var(--ops-text)", fontSize: 14, fontWeight: 600,
          cursor: "pointer", textDecoration: "underline",
          fontFamily: "inherit",
        }}>
          💬 운영팀에 문의
        </button>
      </div>
    </div>
  );
}

function DatePill({ active, label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "14px 4px",
      background: active ? "#FF1B8D" : "var(--card-bg)",
      border: active ? "1px solid #FF1B8D" : "1px solid var(--input-border)",
      borderRadius: 12,
      color: active ? "#fff" : "var(--text-primary)",
      fontSize: 14, fontWeight: 600,
      cursor: "pointer", fontFamily: "inherit",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 2,
    }}>
      <span>{label}</span>
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: active ? "rgba(255,255,255,0.85)" : "var(--text-tertiary)",
        fontFamily: sub && /[0-9]/.test(sub) ? "inherit" : "inherit",
      }}>
        {sub}
      </span>
    </button>
  );
}

export default EngineerNewAssignDetailScreen;
