// Phase 5 Step 0.C-1 — 유솔N 정산 사이클 카드 (AdminTaskDetailScreen 측 조건 분기)
// 2026-05-19
// task.principal === 'usol_n' 일 때만 표시.
// 각 task_item별 4단계 정산 사이클 시각:
//   ⚪ 대기 → 🟡 네이버 결제 완료 → 🟠 회사 입금 완료 → 🟢 기사 정산 완료
// 시각 (naver_settled_at / company_received_at / engineer_settled_at)
//
// 영향 범위 = 유솔N 작업만. 다른 6원청 영향 0 (AdminTaskDetailScreen 측 조건 분기).
import { useState, useEffect } from "react";
import { fetchTaskItemsByTaskId, getItemSettlementColor, getItemChipLabel } from "../../lib/usolNTasksDb.js";
import { formatYmdHm, formatYmdHmAlways } from "../../utils/dateLabel.js";

const STAGES = [
  { key: "wait",     label: "대기",            dot: "⚪", color: "var(--text-tertiary, var(--text-secondary))", field: null },
  { key: "naver",    label: "네이버 결제완료",   dot: "🟡", color: "#FACC15", field: "naver_settled_at" },
  { key: "company",  label: "회사 입금완료",     dot: "🟠", color: "#F59E0B", field: "company_received_at" },
  { key: "engineer", label: "기사 정산완료",     dot: "🟢", color: "#1D9E75", field: "engineer_settled_at" },
];

function getCurrentStage(item) {
  if (item.engineer_settled_at) return "engineer";
  if (item.company_received_at) return "company";
  if (item.naver_settled_at)    return "naver";
  return "wait";
}

export function UsolNSettlementCycleCard({ taskId }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!taskId) return;
    let alive = true;
    setLoading(true);
    setError("");
    fetchTaskItemsByTaskId(taskId)
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setError(res.error || "정산 사이클 조회 실패");
          setItems([]);
        } else {
          setItems(res.items);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [taskId]);

  if (loading) {
    return (
      <div style={cardStyle}>
        <SectionLabel/>
        <div style={emptyTextStyle}>불러오는 중...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={cardStyle}>
        <SectionLabel/>
        <div style={emptyTextStyle}>⚠️ {error}</div>
      </div>
    );
  }
  if (items.length === 0) {
    return null; // 항목 X → 카드 자체 표시 X
  }

  return (
    <div style={cardStyle}>
      <SectionLabel/>
      {items.map(item => (
        <ItemRow key={item.id} item={item}/>
      ))}
    </div>
  );
}

function SectionLabel() {
  return (
    <div style={{
      fontSize: 10, color: "#03C75A", fontWeight: 700,
      marginBottom: 8, letterSpacing: 0.3,
    }}>
      🟢 유솔N 정산 사이클
    </div>
  );
}

function ItemRow({ item }) {
  const c = getItemSettlementColor(item);
  const label = getItemChipLabel(item);
  const currentStage = getCurrentStage(item);
  const currentStageIdx = STAGES.findIndex(s => s.key === currentStage);

  return (
    <div style={{
      padding: 10,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${c.color}`,
      borderRadius: 8, marginBottom: 6,
    }}>
      {/* 헤더 — 항목명 + 단계 라벨 + 금액 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>×{item.qty || 1}</span>
          <span style={{
            fontSize: 9, fontWeight: 600,
            color: c.color,
            background: `${c.color}1A`,
            padding: "1px 5px", borderRadius: 3,
          }}>
            {c.dot} {c.label}
          </span>
        </div>
        <span style={{ fontSize: 11, fontFamily: "inherit", color: "var(--text-primary)" }}>
          ₩{(item.subtotal || 0).toLocaleString()}
        </span>
      </div>

      {/* 4단계 progress */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        {STAGES.map((stage, idx) => {
          const isPassed = idx <= currentStageIdx;
          const isCurrent = idx === currentStageIdx;
          const ts = stage.field ? item[stage.field] : null;
          return (
            <div key={stage.key} style={{
              flex: 1, textAlign: "center",
              padding: "4px 2px",
              borderRadius: 4,
              background: isCurrent ? `${stage.color}1A` : "transparent",
              border: isCurrent ? `1px solid ${stage.color}` : "1px solid transparent",
            }}>
              <div style={{
                fontSize: 12,
                opacity: isPassed ? 1 : 0.3,
              }}>{stage.dot}</div>
              <div style={{
                fontSize: 8,
                color: isPassed ? stage.color : "var(--text-tertiary, var(--text-secondary))",
                fontWeight: isCurrent ? 700 : 500,
                marginTop: 1,
              }}>{stage.label}</div>
              {ts && (
                <div style={{
                  fontSize: 7,
                  color: "var(--text-tertiary, var(--text-secondary))",
                  marginTop: 1,
                  fontFamily: "inherit",
                }}>
                  {stage.key === "engineer" ? formatYmdHmAlways(ts) : formatYmdHm(ts)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 부가 정보 — order_type / product_order_id / net_amount */}
      {(item.order_type || item.product_order_id) && (
        <div style={{
          fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))",
          marginTop: 6, paddingTop: 6,
          borderTop: "1px dashed var(--border)",
          display: "flex", gap: 8, flexWrap: "wrap",
        }}>
          {item.order_type && <span>유형: {item.order_type}</span>}
          {item.product_order_id && <span>주문번호: {item.product_order_id}</span>}
          {item.net_amount != null && <span>실수령: ₩{item.net_amount.toLocaleString()}</span>}
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  padding: 12,
  background: "rgba(3,199,90,0.04)",
  border: "1px solid rgba(3,199,90,0.3)",
  borderRadius: 10,
  margin: "0 16px 12px",
};

const emptyTextStyle = {
  fontSize: 11, color: "var(--text-secondary)",
  textAlign: "center", padding: 10,
};

export default UsolNSettlementCycleCard;
