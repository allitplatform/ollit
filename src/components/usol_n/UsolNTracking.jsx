// V11-2-fix / V11-7 — 유솔 N · 정산 추적 (주간 단위)
// 이번 주 받을 돈 큰 박스 + 주간 입금 이력 (지난 주 + 이전 4주) + 월 누적
// 13일+ 정산 대기 경고 (있을 때만)
// V11-7: 주차 카드 클릭 시 작업 목록 모달
import { useState, useMemo } from "react";
import { loadTasks, getLongPendingTasks } from "../../data/tasks.js";
import { formatDateOnly } from "../../utils/dateLabel.js";

const COMPANY_RATE = 0.85;

export function UsolNTracking() {
  const [showWeekDetail, setShowWeekDetail] = useState(null);

  const usolNTasks = useMemo(
    () => loadTasks().filter(t =>
      t.principalId === "usol_n" &&
      ["completed", "partial", "visit_only"].includes(t.status)
    ),
    []
  );

  const weeklyGroups = useMemo(() => groupTasksByWeek(usolNTasks), [usolNTasks]);
  const longPending  = useMemo(() => getLongPendingTasks(13), []);
  const monthSummary = useMemo(() => calculateMonthSummary(usolNTasks), [usolNTasks]);

  return (
    <div>
      {longPending.length > 0 && <LongPendingAlert tasks={longPending}/>}

      <ThisWeekCard
        week={weeklyGroups.thisWeek}
        onClick={() => weeklyGroups.thisWeek && setShowWeekDetail(weeklyGroups.thisWeek)}
      />

      <SectionLabel>📅 주간 입금 이력</SectionLabel>

      {weeklyGroups.lastWeek && (
        <WeekHistoryCard
          week={weeklyGroups.lastWeek}
          latest
          onClick={() => setShowWeekDetail(weeklyGroups.lastWeek)}
        />
      )}

      {weeklyGroups.previousWeeks.map((week, idx) => (
        <WeekHistoryCard
          key={week.weekKey || idx}
          week={week}
          onClick={() => setShowWeekDetail(week)}
        />
      ))}

      {!weeklyGroups.lastWeek && weeklyGroups.previousWeeks.length === 0 && (
        <Empty>아직 입금 이력이 없습니다</Empty>
      )}

      <MonthSummaryCard summary={monthSummary}/>

      {showWeekDetail && (
        <WeekDetailModal
          week={showWeekDetail}
          onClose={() => setShowWeekDetail(null)}
        />
      )}
    </div>
  );
}

function ThisWeekCard({ week, onClick }) {
  if (!week || week.tasks.length === 0) {
    return (
      <div style={{
        padding: 14,
        background: "rgba(3,199,90,0.04)",
        border: "1px dashed rgba(3,199,90,0.3)",
        borderRadius: 12, marginBottom: 14,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          이번 주 정산 대기 작업이 없습니다
        </div>
      </div>
    );
  }

  const totalNetAmount = week.tasks.reduce((s, t) => s + (t.netAmount || 0), 0);
  const companyReceive = Math.floor(totalNetAmount * COMPANY_RATE);

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", padding: 14,
        background: "rgba(3,199,90,0.10)",
        border: "2px solid #03C75A",
        borderRadius: 12, marginBottom: 14,
        cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: "#03C75A", fontWeight: 700 }}>
          📥 이번 주 받을 돈
        </div>
        <span style={{
          fontSize: 9, color: "#03C75A",
          background: "rgba(3,199,90,0.15)",
          padding: "1px 5px", borderRadius: 3,
        }}>
          {week.mondayLabel} (월)
        </span>
      </div>
      <div style={{ fontSize: 22, color: "#03C75A", fontWeight: 700, fontFamily: "inherit" }}>
        ₩{companyReceive.toLocaleString()}
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: 4,
      }}>
        <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>
          {week.dateRange} 작업 {week.tasks.length}건 · 정산금 × 85%
        </span>
        <span style={{ fontSize: 9, color: "#03C75A", fontWeight: 600 }}>
          상세 보기 →
        </span>
      </div>
    </button>
  );
}

function WeekHistoryCard({ week, latest, onClick }) {
  const totalNetAmount = week.tasks.reduce((s, t) => s + (t.netAmount || 0), 0);
  const companyReceive = Math.floor(totalNetAmount * COMPANY_RATE);
  const isReceived     = week.tasks.length > 0 && week.tasks.every(t => t.companyReceivedAt);

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", padding: 11,
        background: latest ? "rgba(3,199,90,0.06)" : "var(--bg-secondary)",
        border: latest ? "1px solid rgba(3,199,90,0.3)" : "1px solid var(--border)",
        borderRadius: 10, marginBottom: 4,
        cursor: onClick ? "pointer" : "default",
        textAlign: "left", fontFamily: "inherit",
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 11,
            color: latest ? "#03C75A" : "var(--text-primary)",
            fontWeight: latest ? 700 : 600,
          }}>
            {week.mondayLabel} (월)
          </span>
          {isReceived
            ? <span style={{ fontSize: 9, color: "#03C75A" }}>✓ 입금 완료</span>
            : <span style={{ fontSize: 9, color: "#F59E0B" }}>⏳ 입금 대기</span>}
        </div>
        <span style={{
          fontSize: 12, fontFamily: "inherit",
          color: latest ? "#03C75A" : "var(--text-primary)",
          fontWeight: latest ? 700 : 600,
        }}>
          ₩{companyReceive.toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))" }}>
        {week.dateRange} 작업 {week.tasks.length}건
      </div>
    </button>
  );
}

function WeekDetailModal({ week, onClose }) {
  const totalNetAmount = week.tasks.reduce((s, t) => s + (t.netAmount || 0), 0);
  const companyReceive = Math.floor(totalNetAmount * COMPANY_RATE);
  const usolFee        = totalNetAmount - companyReceive;

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#03C75A" }}>
              {week.mondayLabel} (월) 입금 상세
            </div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
              {week.dateRange} · 작업 {week.tasks.length}건
            </div>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <div style={{
          padding: 14,
          background: "rgba(3,199,90,0.08)",
          borderRadius: 10, marginBottom: 14,
        }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr auto",
            gap: 4, fontSize: 11,
          }}>
            <span style={{ color: "var(--text-secondary)" }}>총 정산 금액</span>
            <span style={{ fontFamily: "inherit", fontWeight: 600 }}>
              ₩{totalNetAmount.toLocaleString()}
            </span>

            <span style={{ color: "var(--text-secondary)" }}>유솔 수수료 (15%)</span>
            <span style={{ fontFamily: "inherit", color: "var(--text-tertiary, var(--text-secondary))" }}>
              −₩{usolFee.toLocaleString()}
            </span>

            <span style={{ color: "#03C75A", fontWeight: 700 }}>회사 받을 돈</span>
            <span style={{
              fontFamily: "inherit", color: "#03C75A",
              fontWeight: 700, fontSize: 13,
            }}>
              ₩{companyReceive.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
          작업 목록 ({week.tasks.length}건)
        </div>

        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {week.tasks.map(task => (
            <WeekDetailTaskRow key={task.id} task={task}/>
          ))}
        </div>
      </div>
    </div>
  );
}

function WeekDetailTaskRow({ task }) {
  const isExtra = task.orderType === "extra";
  const companyReceive = Math.floor((task.netAmount || 0) * COMPANY_RATE);
  const items = Array.isArray(task.workItems) && task.workItems.length > 0
    ? task.workItems.map(a => `${a.type} ×${a.count || 1}`).join(", ")
    : (task.appliance ? `${task.appliance} ×${task.qty || 1}` : (task.productName || ""));

  return (
    <div style={{
      padding: 10,
      background: isExtra ? "rgba(245,158,11,0.04)" : "var(--bg-secondary)",
      border: isExtra ? "1px solid rgba(245,158,11,0.3)" : "1px solid var(--border)",
      borderRadius: 8, marginBottom: 4,
    }}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600 }}>{task.customer || "—"}</span>
          {isExtra && (
            <span style={{
              fontSize: 8, color: "#F59E0B",
              background: "rgba(245,158,11,0.2)",
              padding: "1px 4px", borderRadius: 2, fontWeight: 700,
            }}>추가</span>
          )}
        </div>
        <span style={{
          fontSize: 11, fontFamily: "inherit",
          color: "#03C75A", fontWeight: 600,
        }}>
          ₩{companyReceive.toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))" }}>
        {task.completedAt ? (formatDateOnly(task.completedAt) || "—") : "—"}
        {items ? ` · ${items}` : ""}
      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000, padding: 16,
};

const modalContentStyle = {
  width: 480, maxWidth: "100%", maxHeight: "85vh",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: 14, padding: 16,
  overflow: "auto",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  color: "var(--text-primary)",
};

const modalHeaderStyle = {
  display: "flex", alignItems: "flex-start",
  justifyContent: "space-between",
  marginBottom: 14, paddingBottom: 14,
  borderBottom: "1px solid var(--border)",
};

const closeButtonStyle = {
  width: 28, height: 28, borderRadius: "50%",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
  fontSize: 14, cursor: "pointer", fontFamily: "inherit",
};

function MonthSummaryCard({ summary }) {
  return (
    <div style={{
      padding: 11,
      background: "rgba(168,85,247,0.06)",
      border: "1px solid rgba(168,85,247,0.3)",
      borderRadius: 10, marginTop: 14,
    }}>
      <div style={{ fontSize: 10, color: "#A855F7", fontWeight: 700, marginBottom: 6 }}>
        📊 {summary.monthLabel} 누적
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, fontSize: 10 }}>
        <span style={{ color: "var(--text-secondary)" }}>받은 돈 ({summary.completedWeeks}주)</span>
        <span style={{ color: "var(--text-primary)", fontFamily: "inherit" }}>
          ₩{summary.received.toLocaleString()}
        </span>

        <span style={{ color: "var(--text-secondary)" }}>받을 예정</span>
        <span style={{ color: "#03C75A", fontFamily: "inherit" }}>
          ₩{summary.pending.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 1, background: "rgba(168,85,247,0.2)", margin: "6px 0" }}/>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "var(--text-primary)", fontWeight: 700 }}>
          {summary.monthLabel} 총
        </span>
        <span style={{ fontSize: 13, color: "#A855F7", fontWeight: 700, fontFamily: "inherit" }}>
          ₩{summary.total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function LongPendingAlert({ tasks }) {
  return (
    <div style={{
      padding: 12,
      background: "rgba(255,68,68,0.08)",
      border: "2px solid rgba(255,68,68,0.4)",
      borderRadius: 10, marginBottom: 14,
    }}>
      <div style={{ fontSize: 11, color: "#ff4444", fontWeight: 700, marginBottom: 4 }}>
        🚨 13일+ 정산 대기 {tasks.length}건
      </div>
      <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
        네이버 정산이 지연되고 있습니다 · 유솔에 문의가 필요합니다
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, color: "var(--text-secondary)",
      marginBottom: 6, paddingLeft: 4, marginTop: 14,
    }}>{children}</div>
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

// ── 헬퍼 — 주차 그룹핑 ─────────────────────────
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// 해당 날짜가 속한 주의 월요일 (00:00:00)
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day  = d.getDay();          // 0=일, 1=월, ..., 6=토
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 월요일 기준 주차 키 (예: "2026-05-04")
function getWeekKey(date) {
  const m = getMondayOfWeek(date);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
}

// 작업을 주간 단위로 묶기 — 이번주 / 지난주 / 그 이전(최근 4주)
function groupTasksByWeek(tasks) {
  const result = { thisWeek: null, lastWeek: null, previousWeeks: [] };

  const weekMap = {};
  tasks.forEach(t => {
    if (!t.completedAt) return;
    const completedDate = new Date(t.completedAt);
    const weekKey = getWeekKey(completedDate);

    if (!weekMap[weekKey]) {
      const monday = getMondayOfWeek(completedDate);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      weekMap[weekKey] = {
        weekKey,
        monday,
        sunday,
        mondayLabel: `${monday.getMonth() + 1}/${monday.getDate()}`,
        dateRange:   `${monday.getMonth() + 1}/${monday.getDate()}~${sunday.getMonth() + 1}/${sunday.getDate()}`,
        tasks: [],
      };
    }
    weekMap[weekKey].tasks.push(t);
  });

  const sorted = Object.values(weekMap).sort((a, b) => b.monday.getTime() - a.monday.getTime());

  const today        = new Date();
  const thisMondayMs = getMondayOfWeek(today).getTime();
  const lastMondayMs = thisMondayMs - ONE_WEEK_MS;
  const thisWeekKey  = getWeekKey(today);

  sorted.forEach(week => {
    if (week.weekKey === thisWeekKey) {
      result.thisWeek = week;
      return;
    }
    if (week.monday.getTime() === lastMondayMs) {
      result.lastWeek = week;
      return;
    }
    if (week.monday.getTime() < lastMondayMs) {
      result.previousWeeks.push(week);
    }
  });

  // 이전 주는 최근 4주만
  result.previousWeeks = result.previousWeeks.slice(0, 4);
  return result;
}

// 월 누적 — 이번달 작업 받은/예정 + 완료된 주차 수
function calculateMonthSummary(tasks) {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthTasks = tasks.filter(t => {
    if (!t.completedAt) return false;
    const d = new Date(t.completedAt);
    return d >= monthStart && d <= monthEnd;
  });

  const received = monthTasks
    .filter(t => t.companyReceivedAt)
    .reduce((s, t) => s + Math.floor((t.netAmount || 0) * COMPANY_RATE), 0);

  const pending = monthTasks
    .filter(t => !t.companyReceivedAt)
    .reduce((s, t) => s + Math.floor((t.netAmount || 0) * COMPANY_RATE), 0);

  const completedWeeks = new Set(
    monthTasks
      .filter(t => t.companyReceivedAt)
      .map(t => getWeekKey(new Date(t.companyReceivedAt)))
  ).size;

  return {
    monthLabel: `${now.getMonth() + 1}월`,
    received,
    pending,
    total: received + pending,
    completedWeeks,
  };
}

export default UsolNTracking;
