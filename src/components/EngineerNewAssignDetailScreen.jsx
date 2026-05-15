// V14 정제 — 새 배정 상세
// 흰 카드 + 좌측 4px 핑크 바 / 추가금 영역 제거 / 색 절제

import { useState, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { WorkItemRow } from "./WorkItemRow.jsx";
import { workDateLabel, workDateColor } from "../utils/dateLabel.js";

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
  const [memo, setMemo]                 = useState(task?.callMemo || "");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showCustom, setShowCustom]     = useState(false);
  const [customDate, setCustomDate]     = useState("");
  const [customTime, setCustomTime]     = useState("");

  // 사장님 운영 패턴 (당일 +15분~2h) — 30분 단위 5개 빠른 슬롯, 현재시간 +15분 반올림 기준
  const slots = useMemo(() => {
    const now = new Date();
    const minPlus15 = new Date(now.getTime() + 15 * 60 * 1000);
    const rounded = Math.ceil(minPlus15.getMinutes() / 30) * 30;
    const firstSlot = new Date(minPlus15);
    firstSlot.setMinutes(rounded, 0, 0);
    return Array.from({ length: 5 }, (_, i) => {
      const t = new Date(firstSlot.getTime() + i * 30 * 60 * 1000);
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");
      return {
        hhmm: `${hh}:${mm}`,
        diffMin: Math.max(0, Math.round((t.getTime() - now.getTime()) / 60000)),
      };
    });
  }, []);

  if (!task) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
        작업 정보 없음
      </div>
    );
  }

  const colors = getWorkTypeColors(task.workType);

  function makeCall() {
    if (task.phone) window.location.href = `tel:${task.phone}`;
  }

  function openMap() {
    const address = encodeURIComponent(task.fullAddress || task.address || "");
    if (!address) return;
    window.open(`https://map.kakao.com/?q=${address}`, "_blank");
  }

  function handleSave() {
    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    let scheduledDate, scheduledTime;
    if (showCustom && customDate && customTime) {
      scheduledDate = customDate;
      scheduledTime = customTime;
    } else if (selectedSlot) {
      scheduledDate = todayYmd;
      scheduledTime = selectedSlot;
    } else {
      return;
    }
    // endTime = scheduledTime + 1h 자동 fallback (캘린더/DB NOT NULL 안전망)
    const [sh, sm] = scheduledTime.split(":").map(Number);
    const endMins = sh * 60 + sm + 60;
    const eh = Math.floor(endMins / 60) % 24;
    const em = endMins % 60;
    const endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    onSave && onSave({ memo, scheduledDate, scheduledTime, endTime });
  }

  // 확정 버튼에 박을 시간
  const confirmTime = showCustom ? customTime : selectedSlot;
  const canConfirm = !!confirmTime && (!showCustom || !!customDate);

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

          {/* V14 v7 — 날짜 라인 */}
          {task.scheduledDate && (
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: workDateColor(task.scheduledDate),
              marginBottom: 8,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>📅</span>
              <span>{workDateLabel(task.scheduledDate)}</span>
            </div>
          )}

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
          {/* 1. 도착 예정 시간 (오늘) — 30분 단위 5개 빠른 슬롯 */}
          <SectionLabel>🕐 도착 예정 시간 (오늘)</SectionLabel>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6,
            marginBottom: 12,
          }}>
            {slots.map(({ hhmm, diffMin }) => {
              const active = !showCustom && selectedSlot === hhmm;
              return (
                <button
                  key={hhmm}
                  onClick={() => { setShowCustom(false); setSelectedSlot(hhmm); }}
                  style={{
                    padding: "10px 0",
                    background: active ? "rgba(255,27,141,0.04)" : "var(--card-bg)",
                    border: active ? "2px solid #FF1B8D" : "1px solid var(--border)",
                    borderRadius: 10,
                    color: "var(--text-primary)",
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{hhmm}</span>
                  <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>
                    +{diffMin}분 후
                  </span>
                </button>
              );
            })}
          </div>

          {/* 2. 다른 시간/날짜 직접 선택 — 부가 흐름 (접힘 → 펼침) */}
          <button
            onClick={() => {
              const next = !showCustom;
              setShowCustom(next);
              if (next) setSelectedSlot(null);
            }}
            style={{
              width: "100%",
              padding: "12px 14px",
              background: showCustom ? "rgba(255,27,141,0.04)" : "var(--card-bg)",
              border: showCustom ? "2px solid #FF1B8D" : "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text-primary)",
              fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              textAlign: "left",
              marginBottom: showCustom ? 8 : 14,
            }}
          >
            📅 다른 시간/날짜 직접 선택
          </button>

          {showCustom && (
            <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="date" value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                style={inputStyle}/>
              <input type="time" value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                style={inputStyle}/>
            </div>
          )}

          {/* 3. 협의 메모 */}
          <SectionLabel>📝 협의 메모 (선택)</SectionLabel>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
            placeholder="고객과 협의한 내용 / 특이사항"
            style={{ ...inputStyle, height: 70, fontSize: 12, resize: "vertical" }}/>
        </div>
      </div>

      {/* 4. 액션 3개 */}
      <div style={{ padding: "0 16px" }}>
        <button onClick={handleSave} disabled={!canConfirm} style={{
          width: "100%", padding: 14,
          background: canConfirm ? "#FF1B8D" : "var(--bg-secondary)",
          opacity: canConfirm ? 1 : 0.5,
          border: "none",
          borderRadius: 12, color: "#fff",
          fontSize: 14, fontWeight: 600,
          cursor: canConfirm ? "pointer" : "not-allowed", fontFamily: "inherit",
          marginBottom: 8,
        }}>
          {canConfirm ? `✓ 일정 확정 → ${confirmTime} 도착 예정` : "도착 시간 선택"}
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

      {/* 5. 운영팀 문의 — V14 v8 카카오 공식 브랜딩 */}
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={onAskOps} style={{
            background: "#34C759",
            color: "#fff",
            border: "none",
            padding: 14,
            borderRadius: 12,
            fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            📞 운영팀 전화
          </button>
          <button onClick={onAskOps} style={{
            background: "#FEE500",
            color: "#391B1B",
            border: "none",
            padding: 14,
            borderRadius: 12,
            fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#391B1B" aria-hidden="true">
              <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.74 5.16 4.36 6.55-.18.61-.65 2.18-.74 2.51-.12.4.15.4.31.29.13-.09 2.04-1.39 2.85-1.95.4.06.81.1 1.22.1 5.52 0 10-3.48 10-7.79S17.52 3 12 3z"/>
            </svg>
            카톡 문의
          </button>
        </div>
      </div>
    </div>
  );
}

export default EngineerNewAssignDetailScreen;
