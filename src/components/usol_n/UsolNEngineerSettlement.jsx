// V11-2 — 유솔 N · 기사 정산 탭
// 매월 15일 일괄 입금 / 분배 구조 시각화 / 기사별 합계
import { useState, useMemo } from "react";
import { loadTasks } from "../../data/tasks.js";
import { loadEngineers } from "../../data/engineers.js";
import {
  calcCompanyReceive, calcEngineerEarning, calcCompanyMargin,
} from "../../utils/usolNCommission.js";
import { EngineerBadge } from "../EngineerBadge.jsx";

export function UsolNEngineerSettlement() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  const engineers = useMemo(() => {
    try { return loadEngineers(); } catch { return []; }
  }, []);

  const monthData = useMemo(
    () => calculateMonthData(selectedMonth, engineers),
    [selectedMonth, engineers]
  );

  const nextSettlementDate = getNextSettlementLabel();

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "6px 10px",
            color: "var(--text-primary)",
            fontSize: 12,
            fontFamily: "inherit",
          }}
        >
          {getRecentMonths().map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div style={{
        padding: 16,
        background: "rgba(14,165,233,0.10)",
        border: "2px solid #06B6D4",
        borderRadius: 14, marginBottom: 12,
      }}>
        <div style={{ fontSize: 10, color: "#06B6D4", fontWeight: 700, marginBottom: 6 }}>
          📤 {nextSettlementDate} 기사 입금 예정
        </div>
        <div style={{ fontSize: 22, color: "#06B6D4", fontWeight: 700, fontFamily: "monospace" }}>
          ₩{monthData.totalToEngineers.toLocaleString()}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 4 }}>
          {selectedMonth} 작업 {monthData.taskCount}건 · 기사 {monthData.engineerCount}명
        </div>
      </div>

      <div style={{
        padding: 12,
        background: "rgba(3,199,90,0.06)",
        border: "1px solid rgba(3,199,90,0.3)",
        borderRadius: 10, marginBottom: 14,
      }}>
        <div style={{ fontSize: 10, color: "#03C75A", fontWeight: 600, marginBottom: 6 }}>
          📊 분배 구조
        </div>
        <SettlementRow label="회사 받음 (× 85%)" value={monthData.totalCompanyReceive}/>
        <SettlementRow label="기사 분배"           value={monthData.totalToEngineers} color="#06B6D4"/>
        <SettlementRow label="회사 마진"           value={monthData.totalMargin}      color="#FF1B8D"/>
      </div>

      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 6, paddingLeft: 4 }}>
        기사별 정산 ({monthData.byEngineer.length}명)
      </div>

      {monthData.byEngineer.length === 0 ? (
        <Empty>{selectedMonth} 정산할 작업이 없습니다</Empty>
      ) : (
        monthData.byEngineer.map(item => (
          <EngineerSettlementRow key={item.engineerId || item.engineer?.name} item={item}/>
        ))
      )}

      {monthData.totalToEngineers > 0 && (
        <button style={{
          width: "100%", marginTop: 16, padding: 14,
          background: "#06B6D4", border: "none", borderRadius: 10,
          color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
          fontFamily: "inherit",
        }}>
          {nextSettlementDate} 일괄 입금 실행 (₩{monthData.totalToEngineers.toLocaleString()})
        </button>
      )}
    </div>
  );
}

function SettlementRow({ label, value, color }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto", gap: 4,
      fontSize: 10, padding: "2px 0",
    }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{
        color: color || "var(--text-primary)",
        fontFamily: "monospace",
        fontWeight: color ? 600 : 400,
      }}>
        ₩{value.toLocaleString()}
      </span>
    </div>
  );
}

function EngineerSettlementRow({ item }) {
  return (
    <div style={{
      padding: 10,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 10, marginBottom: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {item.engineer ? (
          <EngineerBadge engineer={item.engineer} size="sm"/>
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.engineerName || "미배정"}</span>
        )}
        <span style={{ fontSize: 12, color: "#06B6D4", fontWeight: 700, fontFamily: "monospace" }}>
          ₩{item.totalEarning.toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 2, paddingLeft: 14 }}>
        {item.taskCount}건 (기본 {item.basicCount} + 추가 {item.extraCount})
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
function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getRecentMonths() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      value,
      label: `${d.getFullYear()}년 ${d.getMonth() + 1}월${i === 0 ? " (이번달)" : ""}`,
    });
  }
  return months;
}

function getNextSettlementLabel() {
  const now = new Date();
  let target;
  if (now.getDate() <= 15) {
    target = new Date(now.getFullYear(), now.getMonth(), 15);
  } else {
    target = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  }
  return `${target.getMonth() + 1}/${target.getDate()}`;
}

function calculateMonthData(yearMonth, engineers) {
  const tasks = loadTasks().filter(t => {
    if (t.principalId !== "usol_n") return false;
    if (!["completed", "partial", "visit_only"].includes(t.status)) return false;
    if (!t.naverSettledAt) return false;
    if (!t.completedAt)    return false;
    const d = new Date(t.completedAt);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return ym === yearMonth;
  });

  const engineerMap = {};
  let totalCompanyReceive = 0;
  let totalToEngineers    = 0;
  let totalMargin         = 0;

  tasks.forEach(t => {
    const cReceive = calcCompanyReceive(t);
    const eEarning = calcEngineerEarning(t) || 0;
    const margin   = calcCompanyMargin(t)   || 0;

    totalCompanyReceive += cReceive;
    totalToEngineers    += eEarning;
    totalMargin         += margin;

    const key = t.engineerId || t.engineer || "unassigned";
    if (!engineerMap[key]) {
      engineerMap[key] = {
        engineerId:   t.engineerId || null,
        engineerName: t.engineer || "미배정",
        engineer:     engineers.find(e => e.id === t.engineerId) || null,
        tasks: [],
        totalEarning: 0,
        basicCount: 0,
        extraCount: 0,
      };
    }
    engineerMap[key].tasks.push(t);
    engineerMap[key].totalEarning += eEarning;
    if (t.orderType === "extra") engineerMap[key].extraCount += 1;
    else                          engineerMap[key].basicCount += 1;
  });

  const byEngineer = Object.values(engineerMap)
    .map(it => ({ ...it, taskCount: it.tasks.length }))
    .sort((a, b) => b.totalEarning - a.totalEarning);

  return {
    taskCount:           tasks.length,
    engineerCount:       byEngineer.length,
    totalCompanyReceive,
    totalToEngineers,
    totalMargin,
    byEngineer,
  };
}

export default UsolNEngineerSettlement;
