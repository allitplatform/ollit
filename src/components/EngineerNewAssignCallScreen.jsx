// V13-FINAL2-fix2 — 새 배정 통화 화면 V3
// 일정 협의 = 행 리스트 (오늘/내일/모레/다른 날짜)
// 시간 picker = 드롭다운 (오전·오후 / 시 / 분) × 시작·종료
// 보조 액션: 일정 불가 (노랑) / 고객 취소 (빨강)
// 운영팀 문의 = 작은 링크

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import { DropdownPicker, HOURS, MINUTES, AMPM } from "./DropdownPicker.jsx";
// 2026-06-16 — 주소 표시 + 복사 공통 컴포넌트.
import { AddressLine } from "./common/AddressLine.jsx";

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
  fontSize: 14, fontWeight: 600,
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

export function EngineerNewAssignCallScreen({
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
  const [endAmPm, setEndAmPm] = useState("오후");
  const [endHour, setEndHour] = useState("04");
  const [endMin, setEndMin] = useState("00");
  const [callStarted, setCallStarted] = useState(false);

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

  function handleStartCall() {
    setCallStarted(true);
    if (task.phone) window.location.href = `tel:${task.phone}`;
  }

  function handleSave() {
    onSave && onSave({
      memo,
      datePreset,
      customDate,
      startTime: `${startAmPm} ${startHour}:${startMin}`,
      endTime:   `${endAmPm} ${endHour}:${endMin}`,
    });
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
      }}>
        <button onClick={onBack} style={backBtnStyle}>
          <ArrowLeft size={14}/> 뒤로
        </button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 700 }}>
          📞 고객 통화
        </div>
        <div style={{ width: 40 }}/>
      </div>

      {/* 고객 정보 */}
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
          {task.customer || "—"}님
        </div>
        <div style={{
          fontSize: 13, color: "var(--text-secondary)",
          fontFamily: "inherit", marginBottom: 8,
        }}>
          {task.phone || "—"}
        </div>
        {/* 2026-06-16 — 주소 + 복사 (공통 AddressLine plain). */}
        <AddressLine
          task={task}
          variant="plain"
          iconColor="var(--text-secondary)"
          baseStyle={{
            fontSize: 12, color: "var(--text-secondary)", marginBottom: 4,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 6 }}>
          <ServiceTypeIcon workType={task.workType} size={12} showLabel={true}/>
          <span>
            {task.workType}
            {task.appliance ? ` · ${task.appliance}` : ""}
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
          }}>
            🕐 고객 희망: {task.requestedDate} {task.requestedTime || ""}
          </div>
        )}
      </div>

      {/* 통화 시작 */}
      {!callStarted && (
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
          <button onClick={handleStartCall} style={{
            width: "100%", padding: 14,
            background: "#FF1B8D", border: "none",
            borderRadius: 10, color: "#fff",
            fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
          }}>
            📞 통화 시작
          </button>
        </div>
      )}

      {/* 일정 협의 — 행 리스트 */}
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
        <Label>📅 일정 협의</Label>

        <DateRowOption
          active={datePreset === "today"}
          label="오늘" date={formatMd(today)}
          onClick={() => setDatePreset("today")}
        />
        <DateRowOption
          active={datePreset === "tomorrow"}
          label="내일" date={formatMd(tomorrow)}
          onClick={() => setDatePreset("tomorrow")}
        />
        <DateRowOption
          active={datePreset === "dayAfter"}
          label="모레" date={formatMd(dayAfter)}
          onClick={() => setDatePreset("dayAfter")}
        />
        <DateRowOption
          active={datePreset === "custom"}
          label="다른 날짜" icon="📅"
          onClick={() => setDatePreset("custom")}
        />

        {datePreset === "custom" && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            style={{ ...inputStyle, marginTop: 8 }}
          />
        )}

        {/* 시간 picker */}
        <div style={{ marginTop: 12 }}>
          <SubLabel>시작 시간</SubLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
            <DropdownPicker value={startAmPm} options={AMPM} onChange={setStartAmPm}/>
            <DropdownPicker value={startHour} options={HOURS} onChange={setStartHour}/>
            <DropdownPicker value={startMin} options={MINUTES} onChange={setStartMin}/>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <SubLabel>종료 시간</SubLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
            <DropdownPicker value={endAmPm} options={AMPM} onChange={setEndAmPm}/>
            <DropdownPicker value={endHour} options={HOURS} onChange={setEndHour}/>
            <DropdownPicker value={endMin} options={MINUTES} onChange={setEndMin}/>
          </div>
        </div>
      </div>

      {/* 통화 메모 */}
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
        <Label>📝 통화 메모</Label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="고객 요청 / 특이사항 / 기타"
          style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
        />
      </div>

      {/* 메인 + 보조 액션 */}
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
        <button onClick={handleSave} style={{
          width: "100%", padding: 14,
          background: "#FF1B8D", border: "none",
          borderRadius: 10, color: "#fff",
          fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          marginBottom: 8,
        }}>
          ✓ 일정 + 메모 저장
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

      {/* 운영팀 문의 — V14 v8 카카오 공식 브랜딩 */}
      <div style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={onAskOps} style={{
            background: "#34C759",
            color: "#fff",
            border: "none",
            padding: 12,
            borderRadius: 10,
            fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            📞 운영팀 전화
          </button>
          <button onClick={onAskOps} style={{
            background: "#FEE500",
            color: "#391B1B",
            border: "none",
            padding: 12,
            borderRadius: 10,
            fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#391B1B" aria-hidden="true">
              <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.74 5.16 4.36 6.55-.18.61-.65 2.18-.74 2.51-.12.4.15.4.31.29.13-.09 2.04-1.39 2.85-1.95.4.06.81.1 1.22.1 5.52 0 10-3.48 10-7.79S17.52 3 12 3z"/>
            </svg>
            카톡 문의
          </button>
        </div>
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
          fontFamily: "inherit",
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

export default EngineerNewAssignCallScreen;
