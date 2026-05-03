// V11-2 — 유솔 N · 진행중 탭
// 배정 / 진행 / 완료 작업 필터 + 카드 뷰
import { useState, useMemo } from "react";
import { loadTasks } from "../../data/tasks.js";
import { loadEngineers } from "../../data/engineers.js";
import { EngineerBadge } from "../EngineerBadge.jsx";

const STATUS_FILTERS = [
  { id: "all",         label: "전체",   statuses: ["assigned", "confirmed", "in_progress", "completed", "partial", "visit_only"] },
  { id: "assigned",    label: "배정",   statuses: ["assigned", "confirmed"] },
  { id: "in_progress", label: "진행중", statuses: ["in_progress"] },
  { id: "completed",   label: "완료",   statuses: ["completed", "partial", "visit_only"] },
];

export function UsolNInProgress() {
  const [filterId, setFilterId] = useState("all");

  const usolNTasks = useMemo(
    () => loadTasks().filter(t =>
      t.principalId === "usol_n" && t.status !== "received"
    ),
    []
  );

  const engineers = useMemo(() => {
    try { return loadEngineers(); } catch { return []; }
  }, []);

  const counts = useMemo(() => {
    return STATUS_FILTERS.reduce((acc, f) => {
      acc[f.id] = usolNTasks.filter(t => f.statuses.includes(t.status)).length;
      return acc;
    }, {});
  }, [usolNTasks]);

  const filteredTasks = useMemo(() => {
    const f = STATUS_FILTERS.find(x => x.id === filterId);
    return usolNTasks.filter(t => f.statuses.includes(t.status));
  }, [usolNTasks, filterId]);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map(filter => (
          <button
            key={filter.id}
            onClick={() => setFilterId(filter.id)}
            style={{
              padding: "5px 10px",
              background: filterId === filter.id ? "rgba(168,85,247,0.15)" : "transparent",
              border: filterId === filter.id ? "1px solid #A855F7" : "1px solid var(--border)",
              color: filterId === filter.id ? "#A855F7" : "var(--text-secondary)",
              fontSize: 10, borderRadius: 12,
              fontWeight: filterId === filter.id ? 600 : 400,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {filter.label} {counts[filter.id]}
          </button>
        ))}
      </div>

      {filteredTasks.length === 0 ? (
        <Empty>해당 상태의 작업이 없습니다</Empty>
      ) : (
        filteredTasks.map(task => (
          <TaskCard key={task.id} task={task} engineers={engineers}/>
        ))
      )}
    </div>
  );
}

function TaskCard({ task, engineers }) {
  const engineer = engineers.find(e => e.id === task.engineerId);
  const isCurrentlyWorking = task.status === "in_progress";

  return (
    <div style={{
      padding: 12,
      background: isCurrentlyWorking
        ? "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(255,27,141,0.04))"
        : "var(--bg-secondary)",
      border: isCurrentlyWorking
        ? "2px solid #A855F7"
        : "1px solid var(--border)",
      borderRadius: 10, marginBottom: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StatusIcon status={task.status}/>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{task.customer || "—"}</span>
          <StatusBadge status={task.status}/>
        </div>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: isCurrentlyWorking ? "#A855F7" : "var(--text-primary)" }}>
          ₩{(task.netAmount || 0).toLocaleString()}
        </span>
      </div>

      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
        {task.address ? String(task.address).split("(")[0].trim() : "—"}
        {task.workItems && task.workItems.length > 0 && (
          <> · {task.workItems.map(a => `${a.type} ×${a.count}`).join(", ")}</>
        )}
      </div>

      {engineer && (
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          marginTop: 4, paddingTop: 4,
          borderTop: "1px dashed var(--border)",
        }}>
          <EngineerBadge engineer={engineer} size="sm"/>
          {(task.scheduledAt || task.time) && (
            <span style={{ fontSize: 9, color: "var(--text-tertiary)", marginLeft: "auto" }}>
              {task.scheduledAt
                ? new Date(task.scheduledAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
                : task.time}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }) {
  const map = {
    assigned: "🟡", confirmed: "🔵",
    in_progress: "🟢", completed: "⚪",
    partial: "🔶", visit_only: "🚗",
  };
  return <span style={{ fontSize: 12 }}>{map[status] || "⚪"}</span>;
}

function StatusBadge({ status }) {
  const map = {
    assigned:    { label: "배정",   color: "#06B6D4" },
    confirmed:   { label: "확정",   color: "#06B6D4" },
    in_progress: { label: "진행중", color: "#A855F7" },
    completed:   { label: "완료",   color: "#1D9E75" },
    partial:     { label: "부분",   color: "#F59E0B" },
    visit_only:  { label: "출장비", color: "#FF1B8D" },
  };
  const it = map[status] || { label: status, color: "var(--text-secondary)" };
  return (
    <span style={{
      fontSize: 9, color: it.color, background: `${it.color}26`,
      padding: "1px 5px", borderRadius: 3,
    }}>{it.label}</span>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      padding: 40, textAlign: "center",
      color: "var(--text-secondary)", fontSize: 12,
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{children}</div>
  );
}

export default UsolNInProgress;
