// V13-FINAL2-fix4 — 새 배정 리스트
// 카드: 고객명 18 / 주소 13 / 전화 12 / 컬러 SVG 작업 종류 / 예정 무채색
// 카드 클릭 → NewAssignDetailScreen (통화+상세 통합)

import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";

const ICON_PHONE_WHITE = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke="#fff" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

function makeCall(phone) {
  if (phone) window.location.href = `tel:${phone}`;
}

export function EngineerNewAssignmentListScreen({ tasks = [], onBack, onTaskClick }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingBottom: 100 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-primary)",
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none",
          color: "var(--text-primary)", fontSize: 13,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
          fontFamily: "inherit",
        }}>
          <ArrowLeft size={14}/> 뒤로
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            🔔 새 배정
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
            고객 통화 필요 · {tasks.length}건
          </div>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        {tasks.length === 0 ? (
          <div style={{
            padding: 24, textAlign: "center",
            color: "var(--text-tertiary)", fontSize: 13,
          }}>
            새 배정 없음
          </div>
        ) : (
          tasks.map(task => (
            <div
              key={task.id}
              onClick={() => onTaskClick && onTaskClick(task.id)}
              style={{
                background: "var(--bg-secondary)",
                border: "0.5px solid var(--border)",
                borderRadius: 10,
                padding: 14,
                marginBottom: 8,
                cursor: "pointer",
              }}
            >
              {/* 헤더: 시간 + 상태 */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 8,
              }}>
                {task.requestedDate ? (
                  <span style={{
                    fontSize: 11, color: "#FFB300",
                    fontWeight: 700,
                  }}>
                    🕐 {task.requestedDate}{task.requestedTime ? ` ${task.requestedTime}` : ""} 희망
                  </span>
                ) : (
                  <span style={{
                    fontSize: 11, color: "var(--text-secondary)", fontWeight: 600,
                  }}>
                    {task.receivedAgo || "방금"}
                  </span>
                )}
                <span style={{
                  fontSize: 11, color: "var(--text-secondary)", fontWeight: 600,
                }}>
                  예정 ›
                </span>
              </div>

              {/* 고객명 (가장 큼 / 18px) */}
              <div style={{
                fontSize: 18, fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 6,
              }}>
                {task.customer || "—"}
              </div>

              {/* 주소 (중간 / 13px / 밝게) */}
              <div style={{
                fontSize: 13, color: "var(--text-primary)",
                fontWeight: 500, marginBottom: 4,
              }}>
                📍 {task.fullAddress || task.address || "—"}
              </div>

              {/* 전화 (12px / mono) */}
              {task.phone && (
                <div style={{
                  fontSize: 12, color: "var(--text-secondary)",
                  fontFamily: "monospace", marginBottom: 8,
                }}>
                  {task.phone}
                </div>
              )}

              {/* 작업 종류 (컬러 SVG + 글자 / 박스 X) */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <ServiceTypeIcon workType={task.workType} size={12} showLabel={true}/>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {task.appliance ? `· ${task.appliance}` : ""}
                  {task.qty ? ` ×${task.qty}` : ""}
                </span>
              </div>

              {/* 액션 — 통화 + 상세 보기 */}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); makeCall(task.phone); }}
                  style={{
                    flex: 1, padding: 8,
                    background: "#FF1B8D", border: "none",
                    borderRadius: 6, color: "#fff",
                    fontSize: 11, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 6,
                  }}
                >
                  {ICON_PHONE_WHITE} 통화
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onTaskClick && onTaskClick(task.id); }}
                  style={{
                    padding: "8px 14px",
                    background: "transparent",
                    border: "1px solid var(--text-secondary)",
                    borderRadius: 6,
                    color: "var(--text-secondary)",
                    fontSize: 11, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  상세
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EngineerNewAssignmentListScreen;
