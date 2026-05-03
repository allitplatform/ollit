// V13-FINAL2-fix2 — 휴무 / 일정 등록 V2
// 토글: 하루 휴무 / 시간 일정 + 시간 드롭다운 3개 (오전·오후 / 시 / 분)

import { useState } from "react";
import { DropdownPicker, HOURS, MINUTES, AMPM } from "./DropdownPicker.jsx";

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

const cancelBtnStyle = {
  flex: 1, padding: 12,
  background: "transparent",
  border: "1px solid var(--text-secondary)",
  borderRadius: 8, color: "var(--text-secondary)",
  fontSize: 13, cursor: "pointer", fontFamily: "inherit",
};

const primaryBtnStyle = {
  flex: 2, padding: 12,
  background: "#FF1B8D", border: "none",
  borderRadius: 8, color: "#fff",
  fontSize: 13, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
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

function Hint({ children }) {
  return (
    <div style={{
      fontSize: 11, color: "var(--text-secondary)", marginTop: 4,
    }}>
      {children}
    </div>
  );
}

function typeBtnStyle(active) {
  return {
    padding: 10,
    background: active ? "#FF1B8D" : "var(--bg-secondary)",
    border: active ? "none" : "1px solid var(--border)",
    borderRadius: 6,
    color: active ? "#fff" : "var(--text-primary)",
    fontSize: 13, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  };
}

export function EngineerOffDayAddModal({ defaultDate, onClose, onSave }) {
  const [type, setType] = useState("hourly");
  const [date, setDate] = useState(defaultDate || todayYmd());
  const [endDate, setEndDate] = useState("");
  const [startAmPm, setStartAmPm] = useState("오후");
  const [startHour, setStartHour] = useState("02");
  const [startMin, setStartMin] = useState("00");
  const [endAmPm, setEndAmPm] = useState("오후");
  const [endHour, setEndHour] = useState("05");
  const [endMin, setEndMin] = useState("00");
  const [reason, setReason] = useState("");

  function handleSave() {
    if (!date) return;
    onSave && onSave({
      type, date, endDate,
      startTime: type === "hourly" ? `${startAmPm} ${startHour}:${startMin}` : null,
      endTime:   type === "hourly" ? `${endAmPm} ${endHour}:${endMin}` : null,
      reason,
    });
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display: "flex", alignItems: "flex-end",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 420, margin: "0 auto",
        background: "var(--bg-primary)",
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: 16, maxHeight: "85vh", overflowY: "auto",
        color: "var(--text-primary)",
        fontFamily: "'Spoqa Han Sans Neo', -apple-system, sans-serif",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
          🛌 휴무 / 일정 등록
        </div>

        {/* 종류 토글 */}
        <div style={{ marginBottom: 14 }}>
          <Label>종류</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            <button onClick={() => setType("fullday")} style={typeBtnStyle(type === "fullday")}>
              하루 휴무
            </button>
            <button onClick={() => setType("hourly")} style={typeBtnStyle(type === "hourly")}>
              시간 일정
            </button>
          </div>
        </div>

        {/* 날짜 */}
        <div style={{ marginBottom: 14 }}>
          <Label>{type === "fullday" ? "시작 날짜" : "날짜"}</Label>
          <input
            type="date" value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        {type === "fullday" ? (
          <div style={{ marginBottom: 14 }}>
            <Label>종료 날짜 (선택)</Label>
            <input
              type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={inputStyle}
            />
            <Hint>비워두면 하루 휴무</Hint>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <Label>시작 시간</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                <DropdownPicker value={startAmPm} options={AMPM} onChange={setStartAmPm}/>
                <DropdownPicker value={startHour} options={HOURS} onChange={setStartHour}/>
                <DropdownPicker value={startMin} options={MINUTES} onChange={setStartMin}/>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <Label>종료 시간</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                <DropdownPicker value={endAmPm} options={AMPM} onChange={setEndAmPm}/>
                <DropdownPicker value={endHour} options={HOURS} onChange={setEndHour}/>
                <DropdownPicker value={endMin} options={MINUTES} onChange={setEndMin}/>
              </div>
            </div>
          </>
        )}

        {/* 사유 */}
        <div style={{ marginBottom: 14 }}>
          <Label>사유 (선택)</Label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={type === "hourly" ? "병원 / 가족 행사 등" : "휴가 / 병가 등"}
            style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
          />
        </div>

        {/* 안내 */}
        <div style={{
          background: "rgba(0,135,90,0.06)",
          border: "1px solid rgba(0,135,90,0.25)",
          borderRadius: 8, padding: 10,
          fontSize: 11, color: "#00875A",
          marginBottom: 14,
        }}>
          ✅ 운영자가 이 시간엔 배정 안 함
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onClose} style={cancelBtnStyle}>취소</button>
          <button onClick={handleSave} style={primaryBtnStyle}>✓ 등록</button>
        </div>
      </div>
    </div>
  );
}

export default EngineerOffDayAddModal;
