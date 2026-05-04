// V14 정제 — 새 배정 목록
// 흰 카드 + 좌측 4px 핑크 바 / 통화 버튼 X / 상세 보기 버튼만

import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import { getWorkTypeColors } from "../utils/workTypeColors.js";

export function EngineerNewAssignmentListScreen({ tasks = [], onBack, onTaskClick }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 100,
      color: "var(--text-primary)",
      fontFamily: "'Spoqa Han Sans Neo', -apple-system, sans-serif",
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
          <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)" }}>
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
  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        position: "relative",
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "16px 16px 16px 20px",
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
          fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500,
        }}>
          예정
        </span>
      </div>

      {/* 고객 희망 시간 */}
      {task.requestedDate && (
        <div style={{
          fontSize: 13, color: colors.main, fontWeight: 500,
          marginBottom: 6,
        }}>
          🕐 {task.requestedDate}{task.requestedTime ? ` ${task.requestedTime}` : ""} 희망
        </div>
      )}

      {/* 고객명 */}
      <div style={{
        fontSize: 22, fontWeight: 500,
        color: "var(--text-primary)",
        marginBottom: 8,
      }}>
        {task.customer || "—"}
      </div>

      {/* 작업 종류 + 기종 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 13, color: "var(--text-secondary)", fontWeight: 500,
        marginBottom: 4,
      }}>
        <ServiceTypeIcon workType={task.workType} size={13} showLabel={true}/>
        <span>
          {task.appliance ? `· ${task.appliance}` : ""}
          {task.qty ? ` ×${task.qty}` : ""}
        </span>
      </div>

      {/* 주소 */}
      <div style={{
        fontSize: 13, color: "var(--text-secondary)",
        fontWeight: 500, marginBottom: 4,
      }}>
        📍 {task.fullAddress || task.address || "—"}
      </div>

      {/* 전화 */}
      {task.phone && (
        <div style={{
          fontSize: 13, color: "var(--text-secondary)",
          fontWeight: 500, marginBottom: 14,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          📞 {task.phone}
        </div>
      )}

      {/* 상세 보기 버튼 (전체 폭) — 작업 종류 색 */}
      <button
        onClick={onClick}
        style={{
          width: "100%", padding: 13,
          background: colors.main, border: "none",
          borderRadius: 10, color: "#fff",
          fontSize: 15, fontWeight: 500,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        상세 보기
      </button>
    </div>
  );
}

export default EngineerNewAssignmentListScreen;
