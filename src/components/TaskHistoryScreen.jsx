// Step 11 — 작업 수정 이력 화면
// 시간순 (최신 위) + 누가/언제/뭘 + 변경 전(취소선) → 후(초록)
import { loadTaskHistory, getFieldLabel, getActionIcon, formatHistoryValue } from "../data/taskHistory.js";
import { ROLES } from "../data/users.js";

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `오늘 ${time}`;
  const date = d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
  return `${date} ${time}`;
}

export function TaskHistoryScreen({ task, onBack }) {
  const history = task ? loadTaskHistory(task.id) : [];

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "-apple-system, 'Pretendard', sans-serif",
    }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none",
          color: "var(--text-primary)", fontSize: 20,
          cursor: "pointer", padding: 4, fontFamily: "inherit",
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>수정 이력</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
            {task?.customer || "—"} · 총 <span className="mono" style={{ fontWeight: 700 }}>{history.length}</span>건
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {history.length === 0 ? (
          <div style={{
            padding: "40px 20px",
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: 13,
            background: "var(--bg-secondary)",
            border: "1px dashed var(--border)",
            borderRadius: 10,
          }}>
            아직 수정 이력이 없습니다
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map(h => <HistoryCard key={h.id} entry={h}/>)}
          </div>
        )}

        <div style={{
          marginTop: 16,
          padding: "12px 14px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          fontSize: 11,
          color: "var(--text-secondary)",
          lineHeight: 1.7,
        }}>
          ℹ️ 모든 수정은 자동으로 기록됩니다<br/>
          · 누가 / 언제 / 무엇을 바꿨는지<br/>
          · 운영자 · 관리자만 조회 가능
        </div>
      </div>
    </div>
  );
}

function HistoryCard({ entry }) {
  const role = ROLES[entry.userRole];
  const actionIcon = getActionIcon(entry.action);
  const fieldLabel = getFieldLabel(entry.field);
  const dotColor = role?.color || "var(--text-secondary)";

  return (
    <div style={{
      background: "var(--bg-elevated, var(--bg-secondary))",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "10px 12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          display: "inline-block",
          width: 8, height: 8,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
        }}/>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
          {entry.userName || "—"}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
          · {role?.name || entry.userRole || "—"}
        </span>
        <span style={{
          marginLeft: "auto",
          fontSize: 10,
          color: "var(--text-tertiary, var(--text-secondary))",
        }}>
          {formatDateTime(entry.timestamp)}
        </span>
      </div>

      <div style={{ fontSize: 12, marginTop: 6, color: "var(--text-primary)" }}>
        <span style={{ marginRight: 6 }}>{actionIcon}</span>
        <span style={{ fontWeight: 600 }}>{fieldLabel}</span>
        <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}> 변경</span>
      </div>

      {entry.before !== undefined && entry.after !== undefined && (
        <div style={{
          fontSize: 11, marginTop: 6, lineHeight: 1.6,
          padding: "6px 8px",
          background: "var(--bg-secondary)",
          borderRadius: 6,
          display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
        }}>
          <span style={{
            color: "var(--status-danger, #FF3D5A)",
            textDecoration: "line-through",
            opacity: 0.85,
          }}>
            {formatHistoryValue(entry.before)}
          </span>
          <span style={{ color: "var(--text-secondary)" }}>→</span>
          <span style={{
            color: "var(--status-success, #00875A)",
            fontWeight: 600,
          }}>
            {formatHistoryValue(entry.after)}
          </span>
        </div>
      )}
    </div>
  );
}

export default TaskHistoryScreen;
