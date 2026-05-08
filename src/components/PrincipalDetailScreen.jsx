// V11-6 — 원청 상세 (기간 탭 + 기사별 작업 매트릭스)
// 시드 호환: task.customer / task.workItems / task.engineer / task.engineerId
// 5원청 + 유솔 N 모두 사용 가능 (principal.id로 필터)
import { useState, useMemo } from "react";
import { loadTasks } from "../data/tasks.js";
import { loadEngineers } from "../data/engineers.js";
import { EngineerBadge } from "./EngineerBadge.jsx";
import { calcEngineerEarning as calcUsolNEngineer } from "../utils/usolNCommission.js";

export function PrincipalDetailScreen({ principal, onBack }) {
  const [period, setPeriod] = useState("today");

  const tasks = useMemo(
    () => loadTasks().filter(t => t.principalId === principal.id),
    [principal.id]
  );

  const filteredTasks = useMemo(
    () => filterByPeriod(tasks, period),
    [tasks, period]
  );

  const engineers = useMemo(() => {
    try { return loadEngineers(); } catch { return []; }
  }, []);

  const byEngineer = useMemo(
    () => groupByEngineer(filteredTasks, engineers, principal.id),
    [filteredTasks, engineers, principal.id]
  );

  const totalRevenue = filteredTasks.reduce((s, t) => s + getRevenue(t), 0);
  const totalEngineerEarning = filteredTasks.reduce(
    (s, t) => s + getEngineerEarning(t, principal.id), 0
  );

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              display: "inline-block", width: 10, height: 10,
              borderRadius: "50%", background: principal.color || "#888780",
            }}/>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{principal.name}</div>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))", marginTop: 2 }}>
            {principal.note || "정산 정책"}
          </div>
        </div>
      </div>

      <PeriodTabs active={period} onChange={setPeriod}/>

      <SummaryCard
        period={period}
        taskCount={filteredTasks.length}
        revenue={totalRevenue}
        engineerEarning={totalEngineerEarning}
      />

      <div style={{
        fontSize: 11, color: "var(--text-secondary)",
        marginBottom: 6, marginTop: 14,
      }}>
        프로별 작업 ({byEngineer.length}명)
      </div>

      {byEngineer.length === 0 ? (
        <Empty>해당 기간 작업이 없습니다</Empty>
      ) : (
        byEngineer.map(group => (
          <EngineerTaskGroup
            key={group.engineerId || group.engineerName}
            group={group}
            principalId={principal.id}
          />
        ))
      )}
    </div>
  );
}

function PeriodTabs({ active, onChange }) {
  const tabs = [
    { id: "today", label: "오늘" },
    { id: "week",  label: "이번주" },
    { id: "month", label: "이번달" },
  ];
  return (
    <div style={{
      display: "flex", gap: 4,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 8, padding: 4, marginBottom: 14,
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            flex: 1, padding: "6px 8px",
            background: active === tab.id ? "#FF1B8D" : "transparent",
            border: "none",
            color: active === tab.id ? "#fff" : "var(--text-secondary)",
            fontSize: 11, fontWeight: active === tab.id ? 700 : 500,
            borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
          }}
        >{tab.label}</button>
      ))}
    </div>
  );
}

function SummaryCard({ period, taskCount, revenue, engineerEarning }) {
  const periodLabel = { today: "오늘", week: "이번주", month: "이번달" }[period];

  return (
    <div style={{
      padding: 14,
      background: "var(--accent-bg)",
      border: "1px solid #FF1B8D",
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 11, color: "#FF1B8D", fontWeight: 700, marginBottom: 8 }}>
        📊 {periodLabel} 작업 · 프로 정산
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <SummaryItem label="작업 수"    value={`${taskCount}건`}/>
        <SummaryItem label="원청 매출"  value={`₩${revenue.toLocaleString()}`}/>
        <SummaryItem label="프로 정산"  value={`₩${engineerEarning.toLocaleString()}`} highlight/>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, highlight }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: 11, fontWeight: highlight ? 700 : 500,
        color: highlight ? "#FF1B8D" : "var(--text-primary)",
        fontFamily: "inherit",
      }}>{value}</div>
    </div>
  );
}

function EngineerTaskGroup({ group, principalId }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 10, marginBottom: 6, overflow: "hidden",
    }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: "100%", padding: 11,
          background: "transparent", border: "none",
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <span style={{ fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))" }}>
          {expanded ? "▼" : "▶"}
        </span>
        {group.engineer ? (
          <EngineerBadge engineer={group.engineer} size="sm"/>
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{group.engineerName}</span>
        )}
        <span style={{
          marginLeft: "auto", fontSize: 11,
          color: "#FF1B8D", fontWeight: 700, fontFamily: "inherit",
        }}>
          ₩{group.totalEarning.toLocaleString()}
        </span>
        <span style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))" }}>
          {group.tasks.length}건
        </span>
      </button>

      {expanded && (
        <div style={{ padding: 8, paddingTop: 0 }}>
          {group.tasks.map(task => (
            <TaskRow key={task.id} task={task} principalId={principalId}/>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, principalId }) {
  const earning = getEngineerEarning(task, principalId);
  const items = Array.isArray(task.workItems) && task.workItems.length > 0
    ? task.workItems.map(a => `${a.type} ×${a.count || 1}`).join(", ")
    : (task.appliance ? `${task.appliance} ×${task.qty || 1}` : "");

  return (
    <div style={{
      padding: 8,
      background: "var(--bg-inset, var(--bg-secondary))",
      borderRadius: 6, marginBottom: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>{task.customer || "—"}</span>
        <span style={{ fontSize: 10, color: "#FF1B8D", fontFamily: "inherit" }}>
          +₩{earning.toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))" }}>
        {task.completedAt ? new Date(task.completedAt).toLocaleDateString("ko-KR") : "—"}
        {items ? ` · ${items}` : ""}
        {task.orderType === "extra" ? " · 추가선택" : ""}
      </div>
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      padding: 30, textAlign: "center",
      color: "var(--text-secondary)", fontSize: 12,
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{children}</div>
  );
}

// ── 헬퍼 ───────────────────────────────────────
function getRevenue(t) {
  if (typeof t.totalAmount === "number") return t.totalAmount;
  if (t.principalId === "usol_n") return t.netAmount || 0;
  return (t.estimateTotal || 0) + (t.addonFee || 0);
}

function getEngineerEarning(t, principalId) {
  if (principalId === "usol_n") return calcUsolNEngineer(t) || 0;
  return t.engineerEarning || 0;
}

function filterByPeriod(tasks, period) {
  const now = new Date();
  let startMs;
  if (period === "today") {
    startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  } else if (period === "week") {
    const d = new Date(now);
    d.setDate(now.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    startMs = d.getTime();
  } else if (period === "month") {
    startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  } else {
    startMs = 0;
  }
  return (tasks || []).filter(t => {
    if (!t.completedAt) return false;
    return new Date(t.completedAt).getTime() >= startMs;
  });
}

function groupByEngineer(tasks, engineers, principalId) {
  const map = {};
  (tasks || []).forEach(t => {
    const key = t.engineerId || t.engineer || "unassigned";
    if (!map[key]) {
      map[key] = {
        engineerId:   t.engineerId || null,
        engineerName: t.engineer || "미배정",
        engineer:     engineers.find(e => e.id === t.engineerId) || null,
        tasks: [],
        totalEarning: 0,
      };
    }
    map[key].tasks.push(t);
    map[key].totalEarning += getEngineerEarning(t, principalId);
  });
  return Object.values(map).sort((a, b) => b.totalEarning - a.totalEarning);
}

const containerStyle = {
  padding: 16, minHeight: "100vh",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  overflowY: "auto", paddingBottom: 60,
};

const headerStyle = {
  display: "flex", alignItems: "center", gap: 12,
  marginBottom: 14, paddingBottom: 14,
  borderBottom: "1px solid var(--border)",
};

const backBtnStyle = {
  width: 32, height: 32, borderRadius: "50%",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)", fontSize: 14,
  cursor: "pointer", fontFamily: "inherit",
};

export default PrincipalDetailScreen;
