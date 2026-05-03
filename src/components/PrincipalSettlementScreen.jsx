// V11-7 — 회사 → 원청 정산 (매일 / 5원청)
// 사장님 catch: "회사에서 원청 정산도 매일 하는 거야"
// 모든 hooks 최상단 → early return은 hooks 다음 (Hooks 에러 방지)
// 카드 클릭 → PrincipalDetailScreen 진입
import { useState, useMemo } from "react";
import { loadTasks } from "../data/tasks.js";
import { loadPrincipals } from "../data/principals.js";
import { PrincipalDetailScreen } from "./PrincipalDetailScreen.jsx";

const SETTLEMENT_POLICIES = {
  allday:     { label: "직영",     formula: "회사 = 총 - 단가 / 원청 0" },
  aircon_pro: { label: "차액 50%", formula: "(총 - 가짜 단가) × 50%" },
  yongin:     { label: "정액",     formula: "10,000원 / 건" },
  usol_h:     { label: "15%",      formula: "총 × 15%" },
  crikrin:    { label: "20%",      formula: "총 × 20% / 견적 별도" },
};

const FIVE_PRINCIPAL_IDS = ["allday", "aircon_pro", "yongin", "usol_h", "crikrin"];

export function PrincipalSettlementScreen({ onBack }) {
  // ── hooks (모두 최상단) ──────────────────────
  const [selectedDate, setSelectedDate]           = useState(new Date());
  const [selectedPrincipal, setSelectedPrincipal] = useState(null);

  const principals = useMemo(() => {
    try { return loadPrincipals(); } catch { return []; }
  }, []);

  const fivePrincipals = useMemo(
    () => principals.filter(p => FIVE_PRINCIPAL_IDS.includes(p.id)),
    [principals]
  );

  const dailyData = useMemo(
    () => calculateDailyByPrincipal(selectedDate, fivePrincipals),
    [selectedDate, fivePrincipals]
  );

  const summary = useMemo(() => {
    const arr = Object.values(dailyData);
    return {
      taskCount:      arr.reduce((s, d) => s + (d?.taskCount || 0), 0),
      totalRevenue:   arr.reduce((s, d) => s + (d?.totalRevenue || 0), 0),
      companyRevenue: arr.reduce((s, d) => s + (d?.companyRevenue || 0), 0),
      principalFee:   arr.reduce((s, d) => s + (d?.principalFee || 0), 0),
    };
  }, [dailyData]);

  // ── early return (hooks 다음) ─────────────────
  if (selectedPrincipal) {
    return (
      <PrincipalDetailScreen
        principal={selectedPrincipal}
        onBack={() => setSelectedPrincipal(null)}
      />
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "-apple-system, 'Spoqa Han Sans Neo', sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-primary)",
      }}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>🏢 회사 → 원청 정산</div>
          <div style={{
            fontSize: 10, color: "var(--text-secondary)", marginTop: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            매일 정산 · 5원청별 일간 내역 · 유솔 N은 별도
          </div>
        </div>
      </div>

      <div style={{ padding: 16, paddingBottom: 80 }}>
        {/* 날짜 네비게이션 */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14 }}>
          <input
            type="date"
            value={formatDateInput(selectedDate)}
            onChange={(e) => {
              const v = e.target.value;
              if (v) setSelectedDate(new Date(v));
            }}
            style={dateInputStyle}
          />
          <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} style={navButtonStyle} aria-label="이전">◀</button>
          <button onClick={() => setSelectedDate(addDays(selectedDate,  1))} style={navButtonStyle} aria-label="다음">▶</button>
          <button onClick={() => setSelectedDate(new Date())} style={todayButtonStyle}>오늘</button>
        </div>

        {/* 일간 요약 */}
        <DailySummaryCard summary={summary} dateLabel={formatDateLabel(selectedDate)}/>

        {/* 원청별 카드 */}
        <div style={{
          fontSize: 11, color: "var(--text-secondary)",
          marginBottom: 6, marginTop: 14,
        }}>
          원청별 (클릭하면 상세)
        </div>

        {fivePrincipals.length === 0 ? (
          <Empty>등록된 5원청이 없습니다</Empty>
        ) : (
          fivePrincipals.map(principal => (
            <PrincipalCard
              key={principal.id}
              principal={principal}
              data={dailyData[principal.id]}
              policy={SETTLEMENT_POLICIES[principal.id]}
              onClick={() => setSelectedPrincipal(principal)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DailySummaryCard({ summary, dateLabel }) {
  return (
    <div style={{
      padding: 16,
      background: "#FF1B8D",
      borderRadius: 14,
      color: "#fff",
    }}>
      <div style={{ fontSize: 11, color: "#fff", fontWeight: 700, opacity: 0.95, marginBottom: 8 }}>
        📊 {dateLabel} 정산 요약
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
      }}>
        <SummaryItem label="작업 수"      value={`${summary.taskCount}건`}/>
        <SummaryItem label="회사 매출"    value={`₩${summary.companyRevenue.toLocaleString()}`}/>
        <SummaryItem label="원청 정산금"  value={`₩${summary.principalFee.toLocaleString()}`} highlight/>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, highlight }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "#fff", opacity: 0.85, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: 11, fontWeight: highlight ? 700 : 500,
        color: "#fff",
        opacity: highlight ? 1 : 0.95,
        fontFamily: "monospace",
      }}>{value}</div>
    </div>
  );
}

function PrincipalCard({ principal, data, policy, onClick }) {
  const color = principal.color || "var(--text-secondary)";
  const isClickable = !!onClick;
  const hasData = data && data.taskCount > 0;

  if (!hasData) {
    return (
      <button
        onClick={isClickable ? onClick : undefined}
        style={{
          width: "100%", padding: 12,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 10, marginBottom: 6,
          opacity: 0.55,
          cursor: isClickable ? "pointer" : "default",
          textAlign: "left", fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            display: "inline-block", width: 8, height: 8,
            borderRadius: "50%", background: color,
          }}/>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {principal.name}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-secondary)", marginLeft: "auto" }}>
            오늘 작업 없음
          </span>
          {isClickable && (
            <span style={{ fontSize: 11, color: "var(--text-tertiary, var(--text-secondary))" }}>›</span>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      style={{
        width: "100%", padding: 14,
        background: `${color}10`,
        border: `1px solid ${color}`,
        borderRadius: 10, marginBottom: 6,
        cursor: isClickable ? "pointer" : "default",
        textAlign: "left", fontFamily: "inherit",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 6,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            display: "inline-block", width: 10, height: 10,
            borderRadius: "50%", background: color,
          }}/>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            {principal.name}
          </span>
          <span style={{
            fontSize: 9, color, background: `${color}26`,
            padding: "1px 5px", borderRadius: 3,
          }}>
            {policy?.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
            {data.taskCount}건
          </span>
          {isClickable && (
            <span style={{ fontSize: 12, color }}>›</span>
          )}
        </div>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto",
        gap: 4, fontSize: 10,
      }}>
        <span style={{ color: "var(--text-secondary)" }}>회사 매출</span>
        <span style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>
          ₩{data.companyRevenue.toLocaleString()}
        </span>

        <span style={{ color: "var(--text-secondary)" }}>원청 정산</span>
        <span style={{ fontFamily: "monospace", color, fontWeight: 700 }}>
          ₩{data.principalFee.toLocaleString()}
        </span>
      </div>
    </button>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      padding: 24, textAlign: "center",
      color: "var(--text-secondary)", fontSize: 12,
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{children}</div>
  );
}

// ── 헬퍼 ───────────────────────────────────────
function formatDateInput(date) {
  return date.toISOString().split("T")[0];
}

function formatDateLabel(date) {
  const today = new Date();
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth()    === today.getMonth() &&
    date.getDate()     === today.getDate()
  ) return "오늘";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function calculateDailyByPrincipal(date, principals) {
  const result = {};
  principals.forEach(p => {
    result[p.id] = {
      taskCount:      0,
      totalRevenue:   0,
      companyRevenue: 0,
      principalFee:   0,
    };
  });

  const dateStr = formatDateInput(date);

  const tasks = loadTasks().filter(t => {
    if (!["completed", "partial", "visit_only"].includes(t.status)) return false;
    if (!t.completedAt) return false;
    return String(t.completedAt).startsWith(dateStr);
  });

  tasks.forEach(t => {
    const r = result[t.principalId];
    if (!r) return; // 5원청 외 (유솔 N 등) 제외

    const total = (t.totalAmount || ((t.estimateTotal || 0) + (t.addonFee || 0)));
    const principalFee  = t.principalFee || 0;
    const engineerEarning = t.engineerEarning || 0;
    const companyRevenue = typeof t.companyRevenue === "number"
      ? t.companyRevenue
      : Math.max(0, total - principalFee - engineerEarning);

    r.taskCount      += 1;
    r.totalRevenue   += total;
    r.companyRevenue += companyRevenue;
    r.principalFee   += principalFee;
  });

  return result;
}

const backBtnStyle = {
  background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 20,
  cursor: "pointer", padding: 4, fontFamily: "inherit",
};

const dateInputStyle = {
  flex: 1,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "6px 10px",
  color: "var(--text-primary)",
  fontSize: 12, fontFamily: "inherit",
  minWidth: 0,
};

const navButtonStyle = {
  width: 30, height: 30,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-secondary)",
  cursor: "pointer", fontSize: 11,
  fontFamily: "inherit", flexShrink: 0,
};

const todayButtonStyle = {
  padding: "6px 14px",
  background: "var(--bg-secondary)",
  border: "2px solid #FF1B8D",
  borderRadius: 24,
  color: "#FF1B8D",
  fontSize: 12, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
  flexShrink: 0,
};

export default PrincipalSettlementScreen;
