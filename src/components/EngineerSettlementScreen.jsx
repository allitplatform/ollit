// V11-4 — 기사 PWA 정산 화면 (E5)
// 3탭: 오늘 / 월별 / 유솔 N (3시점)
// V11-1 데이터 모델 (loadTasks, calcEngineerEarning, getUsolNStatus) 사용
import { useState, useMemo } from "react";
import { loadTasks, getUsolNStatus } from "../data/tasks.js";
import { calcEngineerEarning } from "../utils/usolNCommission.js";
import {
  getNotificationsForEngineer,
  markNotificationAsRead,
  getUnreadCount,
} from "../utils/notificationQueue.js";
import { formatDateOnly } from "../utils/dateLabel.js";

const VIEW_TABS = [
  { id: "today",   label: "오늘" },
  { id: "monthly", label: "월별" },
  { id: "usol_n",  label: "유솔 N" },
];

// 기사 식별 — App.jsx의 user 객체에서 engineerId 또는 userId 사용
function resolveEngineerId(user) {
  if (!user) return null;
  return user.engineerId || user.userId || user.id || null;
}

export function EngineerSettlementScreen({ user, onBack }) {
  const engineerId = resolveEngineerId(user);
  const [activeTab, setActiveTab] = useState("today");
  const [tick, setTick]           = useState(0);
  const refresh = () => setTick(v => v + 1);

  const myTasks = useMemo(() => {
    if (!engineerId) return [];
    return loadTasks().filter(t =>
      t.engineerId === engineerId || t.engineer === user?.name
    );
  }, [engineerId, user?.name, tick]);

  const unreadCount = useMemo(
    () => getUnreadCount(engineerId),
    [engineerId, tick]
  );

  return (
    <div style={containerStyle}>
      {/* 헤더 */}
      <div style={headerStyle}>
        {onBack && (
          <button onClick={onBack} style={backBtnStyle}>←</button>
        )}
        <div style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>💰 내 정산</div>
        {unreadCount > 0 && <NotificationBadge count={unreadCount}/>}
      </div>

      <NotificationsBox engineerId={engineerId} onRead={refresh}/>

      {/* 탭 */}
      <div style={tabsStyle}>
        {VIEW_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...tabButtonStyle,
              ...(activeTab === tab.id ? activeTabStyle : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "today"   && <TodayView tasks={myTasks}/>}
      {activeTab === "monthly" && <MonthlyView tasks={myTasks}/>}
      {activeTab === "usol_n"  && <UsolNView tasks={myTasks}/>}
    </div>
  );
}

function TodayView({ tasks }) {
  const today = new Date().toISOString().split("T")[0];

  const todayTasks = tasks.filter(t =>
    typeof t.completedAt === "string" && t.completedAt.startsWith(today) &&
    ["completed", "partial", "visit_only"].includes(t.status) &&
    t.principalId !== "usol_n"
  );

  const totalEarning = todayTasks.reduce((s, t) => s + (t.engineerEarning || 0), 0);
  const paidAmount   = todayTasks.filter(t => t.engineerPaidAt)
    .reduce((s, t) => s + (t.engineerEarning || 0), 0);
  const unpaidAmount = totalEarning - paidAmount;

  return (
    <div>
      <div style={{
        padding: 18,
        background: unpaidAmount > 0 ? "#FF3D5A" : "#00875A",
        borderRadius: 14, marginBottom: 14,
        color: "#fff",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.95, marginBottom: 4, color: "#fff" }}>
          {unpaidAmount > 0 ? "📤 오늘 회사에 입금할 돈" : "✓ 오늘 마감 완료"}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "inherit", color: "#fff" }}>
          ₩{unpaidAmount.toLocaleString()}
        </div>
        <div style={{ fontSize: 10, color: "#fff", opacity: 0.85, marginTop: 4 }}>
          오늘 작업 {todayTasks.length}건 · 총 수익 ₩{totalEarning.toLocaleString()}
        </div>
      </div>

      {unpaidAmount > 0 && (
        <button style={{
          width: "100%", padding: 16,
          background: "#FF1B8D", border: "none", borderRadius: 12,
          color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: "pointer", marginBottom: 14, fontFamily: "inherit",
        }}>
          💸 오늘 입금하기
        </button>
      )}

      <div style={sectionTitleStyle}>오늘 작업 ({todayTasks.length})</div>

      {todayTasks.length === 0 ? (
        <Empty>오늘 작업이 없습니다</Empty>
      ) : (
        todayTasks.map(t => <TaskRow key={t.id} task={t}/>)
      )}
    </div>
  );
}

function MonthlyView({ tasks }) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  const monthTasks = tasks.filter(t => {
    if (!t.completedAt) return false;
    const taskMonth = String(t.completedAt).slice(0, 7);
    return taskMonth === selectedMonth &&
      ["completed", "partial", "visit_only"].includes(t.status);
  });

  const totalEarning = monthTasks.reduce((s, t) => s + (t.engineerEarning || 0), 0);

  return (
    <div>
      <select
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
        style={selectStyle}
      >
        {getRecentMonths().map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>

      <div style={{
        padding: 16,
        background: "#FF1B8D",
        borderRadius: 14, marginBottom: 14,
        color: "#fff",
      }}>
        <div style={{ fontSize: 11, color: "#fff", fontWeight: 700, opacity: 0.95, marginBottom: 4 }}>
          {selectedMonth} 총 수익
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "inherit", color: "#fff" }}>
          ₩{totalEarning.toLocaleString()}
        </div>
        <div style={{ fontSize: 9, color: "#fff", opacity: 0.85, marginTop: 4 }}>
          작업 {monthTasks.length}건
        </div>
      </div>

      {monthTasks.length === 0 ? (
        <Empty>{selectedMonth} 작업이 없습니다</Empty>
      ) : (
        monthTasks.map(t => <TaskRow key={t.id} task={t} showDate/>)
      )}
    </div>
  );
}

function UsolNView({ tasks }) {
  const usolNTasks = tasks.filter(t =>
    t.principalId === "usol_n" &&
    ["completed", "partial", "visit_only"].includes(t.status)
  );

  const grouped = useMemo(() => {
    const result = { pending_settlement: [], pending_deposit: [], completed: [] };
    usolNTasks.forEach(t => {
      const status = getUsolNStatus(t);
      if (result[status]) result[status].push(t);
    });
    return result;
  }, [usolNTasks]);

  const totalPending =
    grouped.pending_settlement.reduce((s, t) => s + (calcEngineerEarning(t) || 0), 0) +
    grouped.pending_deposit.reduce((s, t)    => s + (calcEngineerEarning(t) || 0), 0);

  const nextSettlement = getNext15thLabel();

  return (
    <div>
      <div style={{
        padding: 16,
        background: "var(--accent-bg-strong)",
        border: "2px solid #FF1B8D",
        borderRadius: 14, marginBottom: 14,
      }}>
        <div style={{ fontSize: 11, color: "#FF1B8D", fontWeight: 700, marginBottom: 4 }}>
          📥 {nextSettlement} 입금 예정
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "inherit", color: "#FF1B8D" }}>
          ₩{totalPending.toLocaleString()}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 4 }}>
          유솔 N 작업 {grouped.pending_settlement.length + grouped.pending_deposit.length}건 · 매월 15일 일괄
        </div>
      </div>

      <StatusGroup title="🟡 정산 대기"  subtitle="네이버 정산 진행 중"   tasks={grouped.pending_settlement} color="#FF1B8D"/>
      <StatusGroup title="🟠 입금 대기"  subtitle="다음 15일 입금 예정"  tasks={grouped.pending_deposit}    color="#FF1B8D"/>
      <StatusGroup title="✅ 입금 완료"  subtitle=""                       tasks={grouped.completed}          color="#00875A"/>

      {usolNTasks.length === 0 && (
        <Empty>유솔 N 작업이 없습니다</Empty>
      )}
    </div>
  );
}

function StatusGroup({ title, subtitle, tasks, color }) {
  if (!tasks || tasks.length === 0) return null;
  const total = tasks.reduce((s, t) => s + (calcEngineerEarning(t) || 0), 0);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6, padding: "0 4px",
      }}>
        <div>
          <div style={{ fontSize: 11, color, fontWeight: 700 }}>
            {title} ({tasks.length})
          </div>
          {subtitle && (
            <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))", marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, color, fontWeight: 700, fontFamily: "inherit" }}>
          ₩{total.toLocaleString()}
        </span>
      </div>

      {tasks.slice(0, 3).map(t => <UsolNTaskRow key={t.id} task={t}/>)}

      {tasks.length > 3 && (
        <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))", textAlign: "center", padding: 4 }}>
          ... 외 {tasks.length - 3}건
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, showDate }) {
  const isPaid = !!task.engineerPaidAt;
  const items = Array.isArray(task.workItems) && task.workItems.length > 0
    ? task.workItems.map(a => `${a.type} ×${a.count || 1}`).join(", ")
    : (task.appliance ? `${task.appliance} ×${task.qty || 1}` : "");

  return (
    <div style={{
      padding: 10,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 8, marginBottom: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10 }}>{isPaid ? "✓" : "·"}</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{task.customer || "—"}</span>
        </div>
        <span style={{ fontSize: 11, fontFamily: "inherit", color: isPaid ? "#00875A" : "var(--text-primary)" }}>
          ₩{(task.engineerEarning || 0).toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))", marginTop: 2, paddingLeft: 16 }}>
        {showDate && task.completedAt && formatDateOnly(task.completedAt)}
        {showDate && items && " · "}
        {items}
      </div>
    </div>
  );
}

function UsolNTaskRow({ task }) {
  return (
    <div style={{
      padding: 10,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 8, marginBottom: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{task.customer || "—"}</span>
        <span style={{ fontSize: 11, fontFamily: "inherit" }}>
          ₩{(calcEngineerEarning(task) || 0).toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))" }}>
        {task.completedAt ? (formatDateOnly(task.completedAt) || "—") : "—"}
        {" · "}
        {task.orderType === "extra" ? "추가" : "기본"}
      </div>
    </div>
  );
}

function NotificationsBox({ engineerId, onRead }) {
  const notifications = useMemo(
    () => getNotificationsForEngineer(engineerId).filter(n => !n.readAt).slice(0, 3),
    [engineerId]
  );

  if (notifications.length === 0) return null;

  return (
    <div style={{
      padding: 12,
      background: "var(--bg-secondary)",
      borderLeft: "4px solid #FF3D5A",
      borderTop: "1px solid var(--border)",
      borderRight: "1px solid var(--border)",
      borderBottom: "1px solid var(--border)",
      borderRadius: 10, marginBottom: 14,
    }}>
      <div style={{ fontSize: 11, color: "#FF3D5A", fontWeight: 700, marginBottom: 6 }}>
        🔔 새 알림 ({notifications.length})
      </div>
      {notifications.map(n => (
        <div
          key={n.id}
          onClick={() => { markNotificationAsRead(n.id); onRead?.(); }}
          style={{
            padding: 8,
            background: "var(--bg-secondary)",
            borderRadius: 6, marginBottom: 4,
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{n.title}</div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{n.body}</div>
        </div>
      ))}
    </div>
  );
}

function NotificationBadge({ count }) {
  return (
    <span style={{
      background: "#FF3D5A", color: "#fff",
      fontSize: 10, padding: "2px 6px",
      borderRadius: 10, fontWeight: 700,
    }}>
      🔔 {count}
    </span>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      padding: 30, textAlign: "center",
      color: "var(--text-secondary)", fontSize: 11,
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{children}</div>
  );
}

// ── 헬퍼 ───────────────────────────────────────
function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getRecentMonths() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      value,
      label: `${d.getFullYear()}년 ${d.getMonth() + 1}월${i === 0 ? " (이번달)" : ""}`,
    });
  }
  return months;
}

function getNext15thLabel() {
  const now = new Date();
  let target;
  if (now.getDate() <= 15) {
    target = new Date(now.getFullYear(), now.getMonth(), 15);
  } else {
    target = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  }
  return `${target.getMonth() + 1}/${target.getDate()}`;
}

const containerStyle = {
  padding: 16,
  minHeight: "100vh",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
};

const headerStyle = {
  display: "flex", alignItems: "center", gap: 10,
  marginBottom: 14,
};

const backBtnStyle = {
  background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 20,
  cursor: "pointer", padding: 4, fontFamily: "inherit",
};

const tabsStyle = {
  display: "flex", gap: 4,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 10, padding: 4,
  marginBottom: 14,
};

const tabButtonStyle = {
  flex: 1, padding: "8px 8px",
  background: "transparent", border: "none",
  color: "var(--text-secondary)",
  fontSize: 11, fontWeight: 500,
  borderRadius: 7, cursor: "pointer",
  fontFamily: "inherit",
};

const activeTabStyle = {
  background: "#FF1B8D",
  color: "#fff",
  fontWeight: 700,
};

const sectionTitleStyle = {
  fontSize: 11, color: "var(--text-secondary)",
  marginBottom: 6, paddingLeft: 4,
};

const selectStyle = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 6, padding: "6px 10px",
  color: "var(--text-primary)",
  fontSize: 12, fontFamily: "inherit",
  marginBottom: 14, width: "100%",
};

export default EngineerSettlementScreen;
