// Phase 5 Step 0.C-2 — 유솔N · 기사 정산 (DB 전환)
// 2026-05-19
// 흐름:
//   1) fetchUsolNCompletedTaskItems → 완료 task_items 측 (6개월 cutoff)
//   2) 선택 월 (이번달 기본) 필터 — tasks.completed_at yearMonth
//   3) 기사별 합산 (assigned_engineer_id 기준 / net_amount 합)
//   4) "기사 정산 완료" 일괄 버튼 → 그 달 정산 X 항목 → engineer_settled_at 일괄 UPDATE
//   5) 정산된 항목 = 🟢 표시 / 정산 X = 대기 표시
// 매월 15일 일괄 입금 spec. net_amount NULL → fallback (subtotal × 0.85 × 0.6 추정).
import { useState, useMemo, useEffect } from "react";
import { fetchUsolNCompletedTaskItems, markTaskItemsField } from "../../lib/usolNTasksDb.js";
import { loadEngineers } from "../../data/engineers.js";
import { EngineerBadge } from "../EngineerBadge.jsx";
import { formatYmdHmAlways } from "../../utils/dateLabel.js";

const ENGINEER_RATIO_FALLBACK = 0.6;   // net_amount NULL 시 기사 분배 추정
const COMPANY_RATE_FALLBACK   = 0.85;  // subtotal → 회사 받음

function calcItemEngineerAmount(item) {
  if (item == null) return 0;
  // net_amount = 사장님이 직접 입력한 실수령 (정확한 기사 분배)
  if (item.net_amount != null) return item.net_amount;
  // fallback — subtotal × 회사 비율 × 기사 분배 (추정 / 정확한 spec은 사장님 입력 필요)
  const subtotal = item.subtotal || 0;
  return Math.floor(subtotal * COMPANY_RATE_FALLBACK * ENGINEER_RATIO_FALLBACK);
}

export function UsolNEngineerSettlement() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmedInfo, setConfirmedInfo] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  // engineers는 옛 localStorage 측 lookup (이름 표시용) — 별도 stage 측 DB 전환 spec
  const engineers = useMemo(() => {
    try { return loadEngineers(); } catch { return []; }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchUsolNCompletedTaskItems({ monthsBack: 6 })
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setError(res.error || "불러오기 실패");
          setItems([]);
        } else {
          setItems(res.items);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadTick]);

  // 선택 월 측 items 필터
  const monthItems = useMemo(() => {
    return items.filter(it => {
      const completedAt = it.tasks && it.tasks.completed_at;
      if (!completedAt) return false;
      const d = new Date(completedAt);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return ym === selectedMonth;
    });
  }, [items, selectedMonth]);

  // 기사별 합산 + 정산 상태
  const byEngineer = useMemo(() => groupItemsByEngineer(monthItems, engineers), [monthItems, engineers]);

  // 그 달 측 측측 측측측 + 측측 측측측 task_items (= bucket model 측 측측측 측측).
  //   2026-06-01 — 필터 fix: 옛 spec 측 engineer_settled_at NULL 측측 측측 → 네이버 측측측
  //   측측 측 일괄 측측 측 측측 측 측측.
  //   새 spec: naver_settled_at NOT NULL AND engineer_settled_at NULL (확정·미지급 측측).
  const pendingItems = useMemo(
    () => monthItems.filter(it => it.naver_settled_at && !it.engineer_settled_at),
    [monthItems]
  );

  const totalSettled = monthItems
    .filter(it => it.engineer_settled_at)
    .reduce((s, it) => s + calcItemEngineerAmount(it), 0);

  const totalPending = pendingItems.reduce((s, it) => s + calcItemEngineerAmount(it), 0);
  const totalMonth   = totalSettled + totalPending;

  const nextSettlementDate = getNextSettlementLabel();

  async function handleBulkSettle() {
    if (pendingItems.length === 0 || confirming) return;
    if (!confirm(`${pendingItems.length}개 항목 측 기사 정산 완료 마킹할까요?\n총 ₩${totalPending.toLocaleString()}`)) return;
    setConfirming(true);
    setError("");
    const res = await markTaskItemsField(pendingItems.map(it => it.id), "engineer_settled_at");
    setConfirming(false);
    if (!res.ok) {
      setError(res.error || "기사 정산 완료 마킹 실패");
      return;
    }
    setConfirmedInfo({
      count: res.count,
      timestamp: res.timestamp,
      monthLabel: selectedMonth,
    });
    setReloadTick(v => v + 1);
  }

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

      {error && (
        <div style={errorBoxStyle}>⚠️ {error}</div>
      )}

      {confirmedInfo && (
        <div style={confirmedBoxStyle}>
          ✓ 직전 기사 정산 완료: {confirmedInfo.count}개 / {formatYmdHmAlways(confirmedInfo.timestamp)}
        </div>
      )}

      {loading ? (
        <Empty>불러오는 중...</Empty>
      ) : (
        <>
          {/* 입금 예정 카드 */}
          <div style={{
            padding: 16,
            background: "var(--accent-bg)",
            border: "2px solid var(--accent)",
            borderRadius: 14, marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginBottom: 6 }}>
              📤 {nextSettlementDate} 기사 정산 예정
            </div>
            <div style={{ fontSize: 22, color: "var(--accent)", fontWeight: 700, fontFamily: "inherit" }}>
              ₩{totalPending.toLocaleString()}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 4 }}>
              {selectedMonth} 정산 X 항목 {pendingItems.length}개 · 기사 {byEngineer.length}명
            </div>
          </div>

          {/* 분배 구조 */}
          <div style={{
            padding: 12,
            background: "var(--accent-bg)",
            border: "1px solid var(--accent)",
            borderRadius: 10, marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, marginBottom: 6 }}>
              📊 {selectedMonth} 분배
            </div>
            <SettlementRow label="정산 완료 (🟢)" value={totalSettled} color="#1D9E75"/>
            <SettlementRow label="정산 대기 (대기)" value={totalPending} color="var(--accent)"/>
            <div style={{ height: 1, background: "var(--accent)", margin: "6px 0" }}/>
            <SettlementRow label="이번달 총" value={totalMonth} color="var(--accent)" bold/>
          </div>

          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 6, paddingLeft: 4 }}>
            기사별 정산 ({byEngineer.length}명)
          </div>

          {byEngineer.length === 0 ? (
            <Empty>{selectedMonth} 정산할 항목이 없습니다</Empty>
          ) : (
            byEngineer.map(row => (
              <EngineerRow key={row.engineerKey} row={row}/>
            ))
          )}

          {pendingItems.length > 0 && (
            <button
              onClick={handleBulkSettle}
              disabled={confirming}
              style={{
                width: "100%", marginTop: 16, padding: 14,
                background: "var(--accent)", border: "none", borderRadius: 10,
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: confirming ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: confirming ? 0.5 : 1,
              }}
            >
              {confirming
                ? "마킹 중..."
                : `${nextSettlementDate} 기사 정산 완료 (🟢 마킹) — ₩${totalPending.toLocaleString()}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function SettlementRow({ label, value, color, bold }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto", gap: 4,
      fontSize: bold ? 11 : 10, padding: "2px 0",
    }}>
      <span style={{
        color: bold ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: bold ? 700 : 400,
      }}>{label}</span>
      <span style={{
        color: color || "var(--text-primary)",
        fontFamily: "inherit",
        fontWeight: bold ? 700 : 600,
      }}>
        ₩{value.toLocaleString()}
      </span>
    </div>
  );
}

function EngineerRow({ row }) {
  const total      = row.items.reduce((s, it) => s + calcItemEngineerAmount(it), 0);
  const pending    = row.items.filter(it => !it.engineer_settled_at);
  const settled    = row.items.filter(it => it.engineer_settled_at);
  const isAllDone  = pending.length === 0 && row.items.length > 0;

  return (
    <div style={{
      padding: 10,
      background: isAllDone ? "rgba(29,158,117,0.05)" : "var(--bg-secondary)",
      border: isAllDone ? "1px solid rgba(29,158,117,0.3)" : "1px solid var(--border)",
      borderRadius: 10, marginBottom: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {row.engineer ? (
          <EngineerBadge engineer={row.engineer} size="sm"/>
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {row.engineerName || (row.engineerKey === "unassigned" ? "미배정" : `기사 ${row.engineerKey.slice(0, 8)}`)}
          </span>
        )}
        <span style={{
          fontSize: 12,
          color: isAllDone ? "#1D9E75" : "var(--accent)",
          fontWeight: 700, fontFamily: "inherit",
        }}>
          ₩{total.toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 2, paddingLeft: 14, display: "flex", gap: 6 }}>
        <span>항목 {row.items.length}개</span>
        {settled.length > 0 && <span style={{ color: "#1D9E75" }}>🟢 {settled.length}</span>}
        {pending.length > 0 && <span style={{ color: "var(--accent)" }}>대기 {pending.length}</span>}
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

// 기사별 합산 — assigned_engineer_id 기준
function groupItemsByEngineer(items, engineers) {
  const map = {};
  items.forEach(it => {
    const engineerId = (it.tasks && it.tasks.assigned_engineer_id) || null;
    const key = engineerId || "unassigned";
    if (!map[key]) {
      map[key] = {
        engineerKey:  key,
        engineerId:   engineerId,
        engineer:     engineers.find(e => e.id === engineerId) || null,
        // 2026-05-29 — fetchUsolNCompletedTaskItems 의 users JOIN 결과 (it.tasks.assignedEngineer)
        //   를 fallback 이름으로 사용. 옛 localStorage engineers (e.id=code/랜덤) 와 uuid mismatch
        //   로 engineer 객체 매칭 실패 시 render 가 이 값으로 표시 (line 253 fallback).
        engineerName: (it.tasks && it.tasks.assignedEngineer) || null,
        items: [],
      };
    }
    map[key].items.push(it);
  });

  return Object.values(map).sort((a, b) => {
    const aTotal = a.items.reduce((s, it) => s + calcItemEngineerAmount(it), 0);
    const bTotal = b.items.reduce((s, it) => s + calcItemEngineerAmount(it), 0);
    return bTotal - aTotal;
  });
}

const confirmedBoxStyle = {
  padding: 12,
  background: "rgba(29,158,117,0.10)",
  border: "1px solid rgba(29,158,117,0.4)",
  borderRadius: 8, marginBottom: 12,
  color: "#1D9E75", fontSize: 12, fontWeight: 600,
  textAlign: "center",
};

const errorBoxStyle = {
  padding: 10,
  background: "rgba(255,68,68,0.08)",
  border: "1px solid rgba(255,68,68,0.3)",
  borderRadius: 8, marginBottom: 12,
  color: "#ff4444", fontSize: 11, fontWeight: 600,
};

export default UsolNEngineerSettlement;
