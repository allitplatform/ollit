// V13-FINAL2-fix4 — 새 배정 상세 화면 (통화 + 일정 + 메모 + 추가금 + 액션 통합)
// 통화 화면 / 작업 상세 따로 X — 한 화면에 모든 것

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import { DropdownPicker, HOURS, MINUTES, AMPM } from "./DropdownPicker.jsx";

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
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke="#fff" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const NavSvgPink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke="#FF1B8D" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
  </svg>
);

const backBtnStyle = {
  background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 14,
  cursor: "pointer", fontFamily: "inherit",
  padding: "4px 10px",
  display: "flex", alignItems: "center", gap: 4,
};

const inputStyle = {
  width: "100%", padding: 12,
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 14, fontWeight: 500,
  boxSizing: "border-box",
  outline: "none", fontFamily: "inherit",
};

function Label({ children }) {
  return (
    <div style={{
      fontSize: 13, color: "var(--text-secondary)",
      fontWeight: 700, marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function SubLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, color: "var(--text-secondary)",
      marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

export function EngineerNewAssignDetailScreen({
  task,
  onBack,
  onSave,
  onUnableSchedule,
  onCustomerCancel,
  onAskOps,
}) {
  const [memo, setMemo] = useState(task?.callMemo || "");
  const [datePreset, setDatePreset] = useState("tomorrow");
  const [customDate, setCustomDate] = useState("");
  const [startAmPm, setStartAmPm] = useState("오후");
  const [startHour, setStartHour] = useState("02");
  const [startMin, setStartMin] = useState("00");
  const [addonFee, setAddonFee] = useState("");

  if (!task) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
        작업 정보 없음
      </div>
    );
  }

  const today = new Date();
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

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
      startTime: `${startAmPm} ${startHour}:${startMin}`,
      addonFee: parseInt(addonFee || "0", 10),
    });
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "'Spoqa Han Sans Neo', -apple-system, sans-serif",
      paddingBottom: 40,
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-primary)",
      }}>
        <button onClick={onBack} style={backBtnStyle}>
          <ArrowLeft size={14}/> 뒤로
        </button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 700 }}>
          📋 새 배정
        </div>
        <div style={{ width: 40 }}/>
      </div>

      {/* 1. 고객 정보 (크게) */}
      <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          {task.customer || "—"}님
        </div>
        <div style={{
          fontSize: 14, color: "var(--text-primary)",
          marginBottom: 6,
          fontFamily: "monospace", fontWeight: 500,
        }}>
          {task.phone || "—"}
        </div>
        <div style={{
          fontSize: 13, color: "var(--text-primary)",
          marginBottom: 8, fontWeight: 500,
        }}>
          📍 {task.fullAddress || task.address || "—"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ServiceTypeIcon workType={task.workType} size={14} showLabel={true}/>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {task.appliance ? `· ${task.appliance}` : ""}
            {task.qty ? ` ×${task.qty}` : ""}
          </span>
        </div>
        {task.requestedDate && (
          <div style={{
            display: "inline-flex", padding: "4px 8px",
            background: "rgba(255,179,0,0.10)",
            border: "1px solid rgba(255,179,0,0.3)",
            borderRadius: 6,
            fontSize: 11, color: "#FFB300",
            marginTop: 8,
          }}>
            🕐 고객 희망: {task.requestedDate} {task.requestedTime || ""}
          </div>
        )}
      </div>

      {/* 2. 통화 + 길찾기 */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex", gap: 6,
      }}>
        <button onClick={makeCall} style={{
          flex: 1, padding: 10,
          background: "#FF1B8D", border: "none",
          borderRadius: 8, color: "#fff",
          fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center",
          justifyContent: "center", gap: 6,
        }}>
          <PhoneSvgWhite/> 전화
        </button>
        <button onClick={openMap} style={{
          flex: 1, padding: 10,
          background: "rgba(255,27,141,0.10)",
          border: "1px solid rgba(255,27,141,0.3)",
          borderRadius: 8, color: "#FF1B8D",
          fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center",
          justifyContent: "center", gap: 6,
        }}>
          <NavSvgPink/> 길찾기
        </button>
      </div>

      {/* 3. 일정 협의 */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <Label>📅 일정 협의</Label>

        <DateRowOption active={datePreset === "today"}
          label="오늘" date={formatMd(today)}
          onClick={() => setDatePreset("today")}/>
        <DateRowOption active={datePreset === "tomorrow"}
          label="내일" date={formatMd(tomorrow)}
          onClick={() => setDatePreset("tomorrow")}/>
        <DateRowOption active={datePreset === "dayAfter"}
          label="모레" date={formatMd(dayAfter)}
          onClick={() => setDatePreset("dayAfter")}/>
        <DateRowOption active={datePreset === "custom"}
          label="다른 날짜" icon="📅"
          onClick={() => setDatePreset("custom")}/>

        {datePreset === "custom" && (
          <input type="date" value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            style={{ ...inputStyle, marginTop: 8 }}/>
        )}

        <div style={{ marginTop: 12 }}>
          <SubLabel>시작 시간</SubLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
            <DropdownPicker value={startAmPm} options={AMPM} onChange={setStartAmPm}/>
            <DropdownPicker value={startHour} options={HOURS} onChange={setStartHour}/>
            <DropdownPicker value={startMin} options={MINUTES} onChange={setStartMin}/>
          </div>
        </div>
      </div>

      {/* 4. 메모 */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <Label>📝 메모</Label>
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
          placeholder="고객 요청 / 특이사항 / 기타"
          style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}/>
      </div>

      {/* 5. 추가금 (선택) */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <Label>💰 추가금 (선택)</Label>
        <input type="number" inputMode="numeric"
          value={addonFee}
          onChange={(e) => setAddonFee(e.target.value)}
          placeholder="0"
          style={{ ...inputStyle, fontFamily: "monospace" }}/>
      </div>

      {/* 6. 메인 + 보조 액션 */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <button onClick={handleSave} style={{
          width: "100%", padding: 14,
          background: "#FF1B8D", border: "none",
          borderRadius: 10, color: "#fff",
          fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          marginBottom: 8,
        }}>
          ✓ 일정 확정
        </button>

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onUnableSchedule} style={{
            flex: 1, padding: 11,
            background: "rgba(255,179,0,0.10)",
            border: "1px solid rgba(255,179,0,0.4)",
            borderRadius: 8, color: "#FFB300",
            fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            ⚠️ 일정 불가
          </button>
          <button onClick={onCustomerCancel} style={{
            flex: 1, padding: 11,
            background: "rgba(255,61,90,0.08)",
            border: "1px solid rgba(255,61,90,0.4)",
            borderRadius: 8, color: "#FF3D5A",
            fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            ✕ 고객 취소
          </button>
        </div>
      </div>

      {/* 7. 운영팀 문의 */}
      <div style={{ padding: 16, textAlign: "center" }}>
        <button onClick={onAskOps} style={{
          background: "transparent", border: "none",
          color: "var(--text-secondary)", fontSize: 11,
          cursor: "pointer", textDecoration: "underline",
          fontFamily: "inherit",
        }}>
          💬 운영팀에 문의
        </button>
      </div>
    </div>
  );
}

function DateRowOption({ active, label, date, icon, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", gap: 6,
      padding: "11px 12px",
      background: active ? "rgba(255,27,141,0.05)" : "var(--bg-secondary)",
      borderRadius: 8,
      cursor: "pointer",
      border: active ? "1px solid #FF1B8D" : "1px solid transparent",
      marginBottom: 4,
      alignItems: "center",
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>
        {label}
      </span>
      {date && (
        <span style={{
          fontSize: 12,
          color: active ? "#FF1B8D" : "var(--text-secondary)",
          fontFamily: "monospace",
        }}>
          {date}
        </span>
      )}
      {icon && (
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {icon} ›
        </span>
      )}
    </div>
  );
}

export default EngineerNewAssignDetailScreen;
