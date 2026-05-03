// V14 — 새 배정 받음 (서브 화면)
// 고객 카드 핑크 단색 / 알약 3개 / 24시간 시간 picker 시작·종료
// 통화 = 초록 / 길찾기 = 흰+핑크 / 요청사항 노랑 / 분기 3개

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import { DropdownPicker, HOURS_24, MINUTES_30 } from "./DropdownPicker.jsx";

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

const NavSvgPink = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="#FF1B8D" strokeWidth="2.4"
       strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
  </svg>
);

function Label({ children }) {
  return (
    <div style={{
      fontSize: 14, color: "var(--text-primary)",
      fontWeight: 800, marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function SubLabel({ children }) {
  return (
    <div style={{
      fontSize: 12, color: "var(--text-secondary)",
      fontWeight: 600, marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: 14,
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
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
  const [addonFee, setAddonFee]       = useState("");

  if (!task) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
        작업 정보 없음
      </div>
    );
  }

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
      addonFee: parseInt(addonFee || "0", 10),
    });
  }

  // 시간 미리보기 텍스트
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
        <button onClick={onBack} style={{
          background: "transparent", border: "none",
          color: "var(--text-primary)", fontSize: 14,
          cursor: "pointer", fontFamily: "inherit",
          padding: "4px 10px",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <ArrowLeft size={16}/> 뒤로
        </button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: 800 }}>
          새 배정
        </div>
        <div style={{ width: 60 }}/>
      </div>

      {/* 1. 고객 카드 — 핑크 단색 */}
      <div style={{ padding: 16 }}>
        <div style={{
          background: "#FF1B8D",
          borderRadius: 14,
          padding: 18,
          color: "#fff",
        }}>
          <div style={{
            fontSize: 12, color: "rgba(255,255,255,0.85)",
            fontWeight: 700, marginBottom: 6,
          }}>
            새 배정{task.requestedAgo ? ` · ${task.requestedAgo}` : ""}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            {task.customer || "—"} 고객님
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 14, fontWeight: 600, marginBottom: 8,
            color: "rgba(255,255,255,0.95)",
          }}>
            <ServiceTypeIcon workType={task.workType} size={14} showLabel={true}/>
            <span>{task.appliance ? `· ${task.appliance}` : ""}{task.qty ? ` ×${task.qty}` : ""}</span>
          </div>
          <div style={{
            fontSize: 14, fontWeight: 500, marginBottom: 6,
            color: "rgba(255,255,255,0.95)",
          }}>
            📍 {task.fullAddress || task.address || "—"}
          </div>
          <div style={{
            fontSize: 14, fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            color: "rgba(255,255,255,0.95)",
          }}>
            📞 {task.phone || "—"}
          </div>
        </div>

        {/* 통화 + 길찾기 */}
        <div style={{
          marginTop: 10,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
        }}>
          <button onClick={makeCall} style={{
            padding: 14,
            background: "#34C759",
            border: "none", borderRadius: 10,
            color: "#fff",
            fontSize: 15, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
          }}>
            <PhoneSvgWhite/> 통화
          </button>
          <button onClick={openMap} style={{
            padding: 14,
            background: "#FFFFFF",
            border: "2px solid #FF1B8D",
            borderRadius: 10,
            color: "#FF1B8D",
            fontSize: 15, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
          }}>
            <NavSvgPink/> 길찾기
          </button>
        </div>
      </div>

      {/* 2. 고객 요청사항 — 노랑 박스 */}
      {(task.customerRequest || task.requestedDate) && (
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{
            background: "rgba(255,184,0,0.10)",
            border: "1px solid rgba(255,184,0,0.40)",
            borderRadius: 10,
            padding: 14,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 800, color: "#B25900",
              marginBottom: 6,
            }}>
              ⚠️ 고객 요청사항
            </div>
            {task.customerRequest && (
              <div style={{
                fontSize: 14, color: "var(--text-primary)",
                fontWeight: 500, lineHeight: 1.5, marginBottom: task.requestedDate ? 6 : 0,
              }}>
                {task.customerRequest}
              </div>
            )}
            {task.requestedDate && (
              <div style={{
                fontSize: 13, color: "var(--text-secondary)",
                fontWeight: 600,
              }}>
                🕐 고객 희망: {task.requestedDate} {task.requestedTime || ""}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. 일정 협의 — 알약 3개 */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)" }}>
        <Label>📅 일정 협의</Label>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12,
        }}>
          <DatePill active={datePreset === "today"}    label="오늘"    sub={formatMd(today)}    onClick={() => setDatePreset("today")}/>
          <DatePill active={datePreset === "tomorrow"} label="내일"    sub={formatMd(tomorrow)} onClick={() => setDatePreset("tomorrow")}/>
          <DatePill active={datePreset === "custom"}   label="다른 날짜" sub="📅"                onClick={() => setDatePreset("custom")}/>
        </div>

        {datePreset === "custom" && (
          <input type="date" value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            style={{ ...inputStyle, marginBottom: 12 }}/>
        )}

        {/* 24시간 시간 picker */}
        <div style={{ marginTop: 4 }}>
          <SubLabel>⏰ 시간 선택</SubLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 40 }}>시작</span>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <DropdownPicker value={startHour} options={HOURS_24}    onChange={setStartHour}/>
              <DropdownPicker value={startMin}  options={MINUTES_30}  onChange={setStartMin}/>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 40 }}>종료</span>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <DropdownPicker value={endHour} options={HOURS_24}   onChange={setEndHour}/>
              <DropdownPicker value={endMin}  options={MINUTES_30} onChange={setEndMin}/>
            </div>
          </div>
          <div style={{
            marginTop: 10, padding: "10px 12px",
            background: "var(--bg-secondary)",
            borderRadius: 8,
            fontSize: 13, fontWeight: 600,
            color: "var(--text-primary)",
            textAlign: "center",
          }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 800,
            }}>
              {startStr} ~ {endStr}
            </span>
            <span style={{ color: "var(--text-secondary)", marginLeft: 8, fontWeight: 500 }}>
              · {durationStr}
            </span>
          </div>
        </div>
      </div>

      {/* 4. 메모 */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)" }}>
        <Label>📝 메모</Label>
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
          placeholder="고객과 협의한 내용 / 특이사항"
          style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}/>
      </div>

      {/* 5. 추가금 (선택) */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)" }}>
        <Label>💰 추가금 (선택)</Label>
        <input type="number" inputMode="numeric"
          value={addonFee}
          onChange={(e) => setAddonFee(e.target.value)}
          placeholder="0"
          style={{
            ...inputStyle,
            fontFamily: "'JetBrains Mono', monospace",
          }}/>
      </div>

      {/* 6. 버튼 분기 — 확정(메인 핑크) / 불가 / 취소 */}
      <div style={{ padding: "14px 16px" }}>
        <button onClick={handleSave} style={{
          width: "100%", padding: 16,
          background: "#FF1B8D", border: "none",
          borderRadius: 12, color: "#fff",
          fontSize: 17, fontWeight: 800,
          cursor: "pointer", fontFamily: "inherit",
          marginBottom: 8,
        }}>
          ✓ 일정 확정
        </button>

        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button onClick={onUnableSchedule} style={{
            flex: 1, padding: 13,
            background: "transparent",
            border: "2px solid #FFB800",
            borderRadius: 10, color: "#FFB800",
            fontSize: 13, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            ⚠️ 일정 불가
          </button>
          <button onClick={onCustomerCancel} style={{
            flex: 1, padding: 13,
            background: "transparent",
            border: "2px solid #FF3B5C",
            borderRadius: 10, color: "#FF3B5C",
            fontSize: 13, fontWeight: 800,
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
          color: "var(--text-secondary)", fontSize: 13,
          cursor: "pointer", textDecoration: "underline",
          fontFamily: "inherit", fontWeight: 500,
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
      padding: "12px 8px",
      background: active ? "#FF1B8D" : "transparent",
      border: active ? "1px solid #FF1B8D" : "1px solid var(--border)",
      borderRadius: 10,
      color: active ? "#fff" : "var(--text-primary)",
      fontSize: 14, fontWeight: 800,
      cursor: "pointer", fontFamily: "inherit",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 2,
    }}>
      <span>{label}</span>
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: active ? "rgba(255,255,255,0.85)" : "var(--text-secondary)",
        fontFamily: sub && /[0-9]/.test(sub) ? "'JetBrains Mono', monospace" : "inherit",
      }}>
        {sub}
      </span>
    </button>
  );
}

export default EngineerNewAssignDetailScreen;
