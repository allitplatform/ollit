// V14 정제 — 새 배정 목록
// 흰 카드 + 좌측 4px 핑크 바 / 통화 버튼 X / 상세 보기 버튼만

import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { useIsDark } from "../hooks/useIsDark.js";

export function EngineerNewAssignmentListScreen({ tasks = [], onBack, onTaskClick }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 100,
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
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
          cursor: "pointer", display: "flex", alignItems: "center",
          fontFamily: "inherit",
        }}>
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
            🔔 새 배정
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
            고객 통화 필요 · {tasks.length}건
          </div>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        {tasks.length === 0 ? (
          <div style={{
            padding: 30, textAlign: "center",
            color: "var(--text-tertiary)", fontSize: 14,
          }}>
            새 배정 없음
          </div>
        ) : (
          tasks.map(task => (
            <AssignmentCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick && onTaskClick(task.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AssignmentCard({ task, onClick }) {
  const colors = getWorkTypeColors(task.workType);
  const isDark = useIsDark();
  const labelColor = isDark ? colors.label.dark : colors.label.light;
  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        position: "relative",
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: 18,
        padding: "16px 16px 16px 22px",
        marginBottom: 10,
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      {/* 좌측 4px 작업 종류 색 바 */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 4,
        background: colors.main,
      }}/>

      {/* 1행 — 우측 "예정" 라벨 */}
      <div style={{
        display: "flex", justifyContent: "flex-end",
        marginBottom: 4,
      }}>
        <span style={{
          fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600,
        }}>
          예정
        </span>
      </div>

      {/* 고객 희망 시간 (방어 코드 — 없으면 시간 미정) */}
      {task.requestedDate ? (
        <div style={{
          fontSize: 14, color: labelColor, fontWeight: 600,
          marginBottom: 8,
        }}>
          🕐 {task.requestedDate}{task.requestedTime ? ` ${task.requestedTime}` : ""} 희망
        </div>
      ) : (
        <div style={{
          fontSize: 14, color: "#888", fontWeight: 600,
          marginBottom: 8,
        }}>
          🕐 시간 미정
        </div>
      )}

      {/* 고객명 (방어 코드) */}
      <div style={{
        fontSize: 26, fontWeight: 700,
        color: "var(--text-primary)",
        letterSpacing: "-0.3px",
        marginBottom: 8,
      }}>
        {task.customer || "신규 고객"}
      </div>

      {/* 작업 종류 + 기종 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 14, color: "var(--text-secondary)", fontWeight: 600,
        marginBottom: 6,
      }}>
        <ServiceTypeIcon workType={task.workType} size={14} showLabel={true}/>
        <span>
          {task.appliance ? `· ${task.appliance}` : ""}
          {task.qty ? ` ×${task.qty}` : ""}
        </span>
      </div>

      {/* 주소 */}
      <div style={{
        fontSize: 14, color: "var(--text-secondary)",
        fontWeight: 600, marginBottom: 6,
      }}>
        📍 {task.fullAddress || task.address || task.region || "주소 미정"}
      </div>

      {/* 전화 (방어 코드 — 없으면 안내 메시지) */}
      {task.phone ? (
        <div style={{
          fontSize: 14, color: "var(--text-secondary)",
          fontWeight: 600, marginBottom: 16,
          fontFamily: "inherit",
        }}>
          📞 {task.phone}
        </div>
      ) : (
        <div style={{
          fontSize: 14, color: "#888",
          fontWeight: 600, marginBottom: 16,
        }}>
          📞 통화 후 정보 확인
        </div>
      )}

      {/* 상세 보기 버튼 (전체 폭) — 작업 종류 색 */}
      <button
        onClick={onClick}
        style={{
          width: "100%", padding: 15,
          background: colors.main, border: "none",
          borderRadius: 12, color: colors.buttonText || "#fff",
          fontSize: 16, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        상세 보기
      </button>
    </div>
  );
}

export default EngineerNewAssignmentListScreen;
