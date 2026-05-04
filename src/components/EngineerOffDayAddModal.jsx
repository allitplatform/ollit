// V14 — 휴무 등록 모달 (4가지 옵션)
// 하루 / 기간 / 반복 / 시간 단위

import { useState } from "react";
import { DropdownPicker, HOURS_24, MINUTES_30 } from "./DropdownPicker.jsx";

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function Label({ children }) {
  return (
    <div style={{
      fontSize: 14, color: "var(--text-primary)",
      fontWeight: 700, marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function TypeButton({ value, current, onClick, icon, label, sub }) {
  const active = current === value;
  return (
    <button onClick={() => onClick(value)} style={{
      padding: "14px 8px",
      background: active ? "#FF1B8D" : "var(--card-bg)",
      border: active ? "1px solid #FF1B8D" : "1px solid var(--input-border)",
      borderRadius: 12,
      color: active ? "#fff" : "var(--text-primary)",
      fontSize: 14, fontWeight: 700,
      cursor: "pointer", fontFamily: "inherit",
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: 4,
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span>{label}</span>
      {sub && (
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: active ? "rgba(255,255,255,0.85)" : "var(--text-tertiary)",
        }}>
          {sub}
        </span>
      )}
    </button>
  );
}

const WEEKDAY_LIST = [
  { id: 0, label: "일" },
  { id: 1, label: "월" },
  { id: 2, label: "화" },
  { id: 3, label: "수" },
  { id: 4, label: "목" },
  { id: 5, label: "금" },
  { id: 6, label: "토" },
];

export function EngineerOffDayAddModal({ defaultDate, onClose, onSave }) {
  const [type, setType] = useState("single");           // single / range / repeat / hourly
  const [date, setDate] = useState(defaultDate || todayYmd());
  const [endDate, setEndDate] = useState("");
  const [weekdays, setWeekdays] = useState([0]);        // 매주 (요일 인덱스 배열)
  const [startHour, setStartHour] = useState("09");
  const [startMin, setStartMin] = useState("00");
  const [endHour, setEndHour]   = useState("12");
  const [endMin, setEndMin]     = useState("00");
  const [reason, setReason]     = useState("");

  function toggleWeekday(id) {
    setWeekdays(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleSave() {
    const payload = { type, reason };
    if (type === "single")      Object.assign(payload, { date });
    else if (type === "range")  Object.assign(payload, { startDate: date, endDate });
    else if (type === "repeat") Object.assign(payload, { weekdays });
    else if (type === "hourly") Object.assign(payload, {
      date, startTime: `${startHour}:${startMin}`, endTime: `${endHour}:${endMin}`,
    });
    onSave && onSave(payload);
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
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
        padding: 18, maxHeight: "90vh", overflowY: "auto",
        color: "var(--text-primary)",
        fontFamily: "'Pretendard', -apple-system, sans-serif",
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.4px" }}>
          📅 휴무 추가
        </div>
        <div style={{
          fontSize: 13, color: "var(--label-main)",
          fontWeight: 600, marginBottom: 16,
        }}>
          휴무 종류를 선택해주세요
        </div>

        {/* 4가지 옵션 그리드 */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
          marginBottom: 16,
        }}>
          <TypeButton value="single" current={type} onClick={setType} icon="📌" label="하루"/>
          <TypeButton value="range"  current={type} onClick={setType} icon="📆" label="기간"/>
          <TypeButton value="repeat" current={type} onClick={setType} icon="🔁" label="반복"/>
          <TypeButton value="hourly" current={type} onClick={setType} icon="⏰" label="시간 단위"/>
        </div>

        {/* 옵션별 입력 */}
        {type === "single" && (
          <div style={{ marginBottom: 14 }}>
            <Label>날짜</Label>
            <input type="date" value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}/>
          </div>
        )}

        {type === "range" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <Label>시작일</Label>
              <input type="date" value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}/>
            </div>
            <div style={{ marginBottom: 14 }}>
              <Label>종료일</Label>
              <input type="date" value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputStyle}/>
            </div>
          </>
        )}

        {type === "repeat" && (
          <div style={{ marginBottom: 14 }}>
            <Label>요일 (복수 선택)</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {WEEKDAY_LIST.map(w => {
                const active = weekdays.includes(w.id);
                return (
                  <button key={w.id} onClick={() => toggleWeekday(w.id)} style={{
                    padding: "12px 0",
                    background: active ? "#FF1B8D" : "var(--card-bg)",
                    border: active ? "1px solid #FF1B8D" : "1px solid var(--input-border)",
                    borderRadius: 10,
                    color: active ? "#fff" : "var(--text-primary)",
                    fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    {w.label}
                  </button>
                );
              })}
            </div>
            <div style={{
              fontSize: 12, color: "var(--text-tertiary)",
              marginTop: 8, fontWeight: 600,
            }}>
              매주 {weekdays.map(id => WEEKDAY_LIST.find(w => w.id === id)?.label).join(", ") || "—"}요일
            </div>
          </div>
        )}

        {type === "hourly" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <Label>날짜</Label>
              <input type="date" value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}/>
            </div>
            <div style={{ marginBottom: 14 }}>
              <Label>시간 범위 (24시간)</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--label-main)", width: 36, fontWeight: 600 }}>시작</span>
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  <DropdownPicker value={startHour} options={HOURS_24}    onChange={setStartHour}/>
                  <DropdownPicker value={startMin}  options={MINUTES_30}  onChange={setStartMin}/>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--label-main)", width: 36, fontWeight: 600 }}>종료</span>
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  <DropdownPicker value={endHour} options={HOURS_24}   onChange={setEndHour}/>
                  <DropdownPicker value={endMin}  options={MINUTES_30} onChange={setEndMin}/>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 사유 (공통) */}
        <div style={{ marginBottom: 14 }}>
          <Label>사유 (선택)</Label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              type === "single" ? "예: 가족 행사" :
              type === "range"  ? "예: 여행" :
              type === "repeat" ? "예: 주일" :
                                  "예: 병원"
            }
            style={{ ...inputStyle, minHeight: 56, resize: "vertical" }}
          />
        </div>

        {/* 안내 */}
        <div style={{
          background: "rgba(3,199,90,0.08)",
          border: "1px solid rgba(3,199,90,0.25)",
          borderRadius: 10, padding: "10px 12px",
          fontSize: 12, color: "#03C75A",
          fontWeight: 600, marginBottom: 16,
        }}>
          ✅ 운영자가 이 시간엔 배정하지 않습니다
        </div>

        {/* 액션 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 8 }}>
          <button onClick={onClose} style={{
            padding: 14,
            background: "transparent",
            border: "1px solid var(--input-border)",
            borderRadius: 12,
            color: "var(--label-main)",
            fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            취소
          </button>
          <button onClick={handleSave} style={{
            padding: 14,
            background: "#FF1B8D", border: "none",
            borderRadius: 12, color: "#fff",
            fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            ✓ 휴무 추가
          </button>
        </div>
      </div>
    </div>
  );
}

export default EngineerOffDayAddModal;
