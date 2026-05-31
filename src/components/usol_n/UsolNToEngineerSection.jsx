// 2026-06-01 Phase 5 R-A3 — UsolNSettleScreen ② 섹션 (회사 → 기사 월정산).
//
// 화면 구조:
//   ① 월 선택 (옛 UsolNEngineerSettlement 와 동일)
//   ② 월정산 카드:
//      · 총액 (1차 + 2차 미지급) — 핑크 큰 글씨
//      · 가로 스택바: 1차 핑크 #FF1B8D / 2차 회색
//      · 1차 (15일) ₩ / 2차 (말일) ₩ 라벨
//      · (옵션) ✓ 이미 지급 완료 ₩ — 초록 작은 글씨
//   ③ 기사별 보기 (인라인): 이름 검색 + 목록 (이름 / 1차 / 2차 / 합계)
//   ④ 일괄 지급 버튼 — 옛 동작 그대로 유지 (D7)
//
// 1·2차 분류 (Phase A — 프론트 표시 전용, DB 0건 변경):
//   selectedMonth = "YYYY-MM" 기준 KST 자정 경계.
//   1차 = naver_settled_at < 그 달 16일 00:00 KST  (이월 포함 — D5)
//   2차 = 그 달 16일 00:00 KST <= naver_settled_at < 다음 달 1일 00:00 KST  (D6)
//   이외 (그 달 말일 이후) → 이 선택 월 시야 외 → 제외.
//
// 보존 (Phase A 절대 변경 금지):
//   markTaskItemsField 일괄 지급 호출 그대로 (engineer_settled_at NOW 마킹).
//   fetchUsolNCompletedTaskItems 시그니처 변경 X.
//   calcItemEngineerAmount 수식 (net_amount or floor(subtotal × 0.85 × 0.6)) 그대로.
//   UsolNEngineerSettlement.jsx 파일 손대지 않음 (D10 — 참고용 보존).

import { useState, useEffect, useMemo } from "react";
import { fetchUsolNCompletedTaskItems, markTaskItemsField } from "../../lib/usolNTasksDb.js";
import { loadEngineers } from "../../data/engineers.js";
import { EngineerBadge } from "../EngineerBadge.jsx";
import { formatYmdHmAlways } from "../../utils/dateLabel.js";

const C_PINK   = "#FF1B8D";
const C_GREEN  = "#1D9E75";
const C_GRAY   = "#9CA3AF";
const C_GRAY_BAR = "#3A3A3A";

const ENGINEER_RATIO_FALLBACK = 0.6;
const COMPANY_RATE_FALLBACK   = 0.85;

// ── 돈 계산 (UsolNEngineerSettlement 과 동일 수식) ─────────────
function calcItemEngineerAmount(item) {
  if (item == null) return 0;
  if (item.net_amount != null) return item.net_amount;
  const subtotal = item.subtotal || 0;
  return Math.floor(subtotal * COMPANY_RATE_FALLBACK * ENGINEER_RATIO_FALLBACK);
}

// ── 1·2차 버킷 분류 (Phase A 프론트 계산) ──────────────────────
// selectedMonth = "YYYY-MM" (KST 기준 표시 월).
// 반환: "first" | "second" | "done_1" | "done_2" | null (선택 월 시야 외)
function bucketItem(item, year, month) {
  const settled = item?.naver_settled_at;
  if (!settled) return null;

  // KST 그 달 16일 00:00 = UTC (그 달 15일 15:00).
  // Date.UTC 시간에 -9 전달 → 자동 보정.
  const cutoff1 = Date.UTC(year, month - 1, 16, -9, 0, 0, 0);
  const cutoff2 = Date.UTC(year, month, 1, -9, 0, 0, 0); // 다음 달 1일 KST

  const settledMs = new Date(settled).getTime();
  if (isNaN(settledMs)) return null;
  if (settledMs >= cutoff2) return null; // 선택 월 시야 외 (다음 달 이후)

  const isPending = !item.engineer_settled_at;
  if (settledMs < cutoff1) return isPending ? "first" : "done_1";
  return isPending ? "second" : "done_2";
}

// 집계 — 측 item을 bucketItem 로 분류한 후 합산.
// 반환: { firstItems, secondItems, doneItems, firstTotal, secondTotal, doneTotal,
//        pendingTotal, pendingItems }
function splitByBucket(items, year, month) {
  const result = {
    firstItems: [], secondItems: [], doneItems: [],
    firstTotal: 0, secondTotal: 0, doneTotal: 0,
  };
  for (const it of items) {
    const k = bucketItem(it, year, month);
    if (!k) continue;
    const amt = calcItemEngineerAmount(it);
    if (k === "first")  { result.firstItems.push(it);  result.firstTotal  += amt; }
    if (k === "second") { result.secondItems.push(it); result.secondTotal += amt; }
    if (k === "done_1" || k === "done_2") {
      result.doneItems.push(it);
      result.doneTotal += amt;
    }
  }
  result.pendingItems = [...result.firstItems, ...result.secondItems];
  result.pendingTotal = result.firstTotal + result.secondTotal;
  return result;
}

// ── 기사별 그룹 (UsolNEngineerSettlement 측 측측 측측) ─────────
function groupItemsByEngineer(items, engineers, year, month) {
  const map = {};
  for (const it of items) {
    const k = bucketItem(it, year, month);
    if (!k) continue;
    const eid = (it.tasks && it.tasks.assigned_engineer_id) || null;
    const key = eid || "unassigned";
    if (!map[key]) {
      map[key] = {
        engineerKey:  key,
        engineerId:   eid,
        engineer:     engineers.find(e => e.id === eid) || null,
        engineerName: (it.tasks && it.tasks.assignedEngineer) || null,
        firstAmount:  0,
        secondAmount: 0,
        doneAmount:   0,
        itemCount:    0,
      };
    }
    const slot = map[key];
    const amt = calcItemEngineerAmount(it);
    if (k === "first")  slot.firstAmount  += amt;
    if (k === "second") slot.secondAmount += amt;
    if (k === "done_1" || k === "done_2") slot.doneAmount += amt;
    slot.itemCount += 1;
  }
  // 합계(미지급) 내림차순
  return Object.values(map).sort(
    (a, b) => (b.firstAmount + b.secondAmount) - (a.firstAmount + a.secondAmount)
  );
}

// ── 월 셀렉터 헬퍼 ────────────────────────────────────────────
function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getRecentMonths() {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      value,
      label: `${d.getFullYear()}년 ${d.getMonth() + 1}월${i === 0 ? " (이번달)" : ""}`,
    });
  }
  return out;
}

// "YYYY-MM" → "M/15" "M/말일"
function getCycleDates(year, month) {
  // 그 달 말일
  const lastDay = new Date(year, month, 0).getDate();
  return {
    firstLabel:  `${month}/15`,
    secondLabel: `${month}/${lastDay}`,
  };
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export function UsolNToEngineerSection() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmedInfo, setConfirmedInfo] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  // 옛 localStorage 기반 — 표시용 이름 매칭 (D10 — 변경 X).
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

  const [year, month] = selectedMonth.split("-").map(Number);
  const split  = useMemo(() => splitByBucket(items, year, month), [items, year, month]);
  const byEng  = useMemo(
    () => groupItemsByEngineer(items, engineers, year, month),
    [items, engineers, year, month]
  );

  async function handleBulkSettle() {
    if (split.pendingItems.length === 0 || confirming) return;
    if (!confirm(
      `${selectedMonth} 미지급 ${split.pendingItems.length}개 항목 일괄 지급?\n` +
      `1차 ₩${split.firstTotal.toLocaleString()} + 2차 ₩${split.secondTotal.toLocaleString()}\n` +
      `= 총 ₩${split.pendingTotal.toLocaleString()}`
    )) return;
    setConfirming(true);
    const res = await markTaskItemsField(
      split.pendingItems.map(it => it.id),
      "engineer_settled_at"
    );
    setConfirming(false);
    if (!res.ok) {
      setError(res.error || "기사 정산 완료 마킹 실패");
      return;
    }
    setConfirmedInfo({
      count: res.count, timestamp: res.timestamp, monthLabel: selectedMonth,
    });
    setReloadTick(v => v + 1);
  }

  return (
    <div>
      {/* 월 셀렉터 */}
      <MonthSelector value={selectedMonth} onChange={setSelectedMonth}/>

      {error && <div style={errorBoxStyle}>⚠️ {error}</div>}

      {confirmedInfo && (
        <div style={confirmedBoxStyle}>
          ✓ 직전 일괄 지급: {confirmedInfo.count}개 / {formatYmdHmAlways(confirmedInfo.timestamp)}
        </div>
      )}

      {loading ? (
        <SectionEmpty>불러오는 중...</SectionEmpty>
      ) : (
        <>
          <MonthlyStackCard
            year={year}
            month={month}
            split={split}
          />

          <EngineerListSection rows={byEng}/>

          {split.pendingItems.length > 0 && (
            <button
              onClick={handleBulkSettle}
              disabled={confirming}
              style={{
                width: "100%", marginTop: 16, padding: 14,
                background: C_PINK, border: "none", borderRadius: 10,
                color: "#fff", fontSize: 13, fontWeight: 800,
                cursor: confirming ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: confirming ? 0.5 : 1,
              }}
            >
              {confirming
                ? "처리 중..."
                : `${selectedMonth} 일괄 지급 (1차 + 2차) — ₩${split.pendingTotal.toLocaleString()}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── 월 셀렉터 ────────────────────────────────────────────────
function MonthSelector({ value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 12px",
          color: "var(--text-primary)",
          fontSize: 12, fontWeight: 600,
          fontFamily: "inherit",
        }}
      >
        {getRecentMonths().map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── 월정산 카드: 총액 + 스택바 + 1·2차 라벨 ─────────────────
function MonthlyStackCard({ year, month, split }) {
  const { firstTotal, secondTotal, doneTotal, pendingTotal } = split;
  const { firstLabel, secondLabel } = getCycleDates(year, month);

  const hasPending = pendingTotal > 0;
  const firstPct  = hasPending ? Math.round((firstTotal  / pendingTotal) * 100) : 0;
  const secondPct = hasPending ? 100 - firstPct : 0;

  return (
    <div style={{
      padding: "14px 16px", marginBottom: 14,
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border)",
      borderRadius: 12,
    }}>
      <div style={{
        fontSize: 11, color: C_GRAY, fontWeight: 600, marginBottom: 4,
      }}>
        {year}년 {month}월 미지급 합계
      </div>
      <div style={{
        fontSize: 24, fontWeight: 800, fontFamily: "inherit",
        color: hasPending ? C_PINK : C_GRAY,
        marginBottom: 12, lineHeight: 1,
      }}>
        ₩{pendingTotal.toLocaleString()}
      </div>

      {/* 스택바 */}
      <StackBar
        firstPct={firstPct}
        secondPct={secondPct}
        empty={!hasPending}
      />

      {/* 1차 / 2차 라벨 */}
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        <CycleRow
          dot={C_PINK}
          label={`1차 (${firstLabel})`}
          amount={firstTotal}
          amountColor={firstTotal > 0 ? C_PINK : C_GRAY}
        />
        <CycleRow
          dot={C_GRAY_BAR}
          label={`2차 (${secondLabel})`}
          amount={secondTotal}
          amountColor={C_GRAY}
        />
      </div>

      {/* 이미 지급 완료 */}
      {doneTotal > 0 && (
        <div style={{
          marginTop: 12, paddingTop: 10,
          borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 10,
        }}>
          <span style={{ color: C_GREEN, fontWeight: 700 }}>
            ✓ 이미 지급 완료
          </span>
          <span style={{
            color: C_GREEN, fontFamily: "inherit", fontWeight: 700,
          }}>
            ₩{doneTotal.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

function StackBar({ firstPct, secondPct, empty }) {
  if (empty) {
    return (
      <div style={{
        height: 12, borderRadius: 6,
        background: C_GRAY_BAR, opacity: 0.4,
      }}/>
    );
  }
  return (
    <div style={{
      height: 12, borderRadius: 6, overflow: "hidden",
      display: "flex", background: C_GRAY_BAR,
    }}>
      {firstPct > 0 && (
        <div style={{
          width: `${firstPct}%`,
          background: C_PINK, height: "100%",
        }}/>
      )}
      {secondPct > 0 && (
        <div style={{
          width: `${secondPct}%`,
          background: C_GRAY_BAR, height: "100%",
        }}/>
      )}
    </div>
  );
}

function CycleRow({ dot, label, amount, amountColor }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: 2, background: dot,
          display: "inline-block",
        }}/>
        <span style={{ fontSize: 11, color: C_GRAY, fontWeight: 600 }}>
          {label}
        </span>
      </div>
      <span style={{
        fontSize: 12, fontFamily: "inherit", fontWeight: 700,
        color: amountColor,
      }}>
        ₩{amount.toLocaleString()}
      </span>
    </div>
  );
}

// ── 기사별 목록 + 이름 검색 (인라인 — D8) ───────────────────
function EngineerListSection({ rows }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const name = (r.engineer?.name || r.engineerName || "").toLowerCase();
      return name.includes(q);
    });
  }, [rows, search]);

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{
        fontSize: 11, color: C_GRAY, fontWeight: 600,
        marginBottom: 8, paddingLeft: 2,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span>기사별 보기 ({rows.length}명)</span>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="기사 이름 검색"
        style={{
          width: "100%", padding: "9px 12px", marginBottom: 8,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          color: "var(--text-primary)",
          fontSize: 12, fontWeight: 600,
          fontFamily: "inherit", outline: "none",
        }}
      />

      {filtered.length === 0 ? (
        <SectionEmpty>
          {search ? "검색 결과 없음" : "해당 월 항목 없음"}
        </SectionEmpty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map(row => <EngineerRow key={row.engineerKey} row={row}/>)}
        </div>
      )}
    </div>
  );
}

function EngineerRow({ row }) {
  const total = row.firstAmount + row.secondAmount;
  const isAllDone = total === 0 && row.doneAmount > 0;

  return (
    <div style={{
      padding: "10px 12px",
      background: isAllDone ? "rgba(29,158,117,0.05)" : "var(--bg-elevated, #1F1F1F)",
      border: isAllDone ? `1px solid ${C_GREEN}55` : "1px solid var(--border)",
      borderRadius: 10,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 4,
      }}>
        {row.engineer ? (
          <EngineerBadge engineer={row.engineer} size="sm"/>
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {row.engineerName
              || (row.engineerKey === "unassigned"
                  ? "미배정"
                  : `기사 ${row.engineerKey.slice(0, 8)}`)}
          </span>
        )}
        <span style={{
          fontSize: 13, fontFamily: "inherit", fontWeight: 800,
          color: total > 0 ? C_PINK : C_GREEN,
        }}>
          ₩{total.toLocaleString()}
        </span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 4, fontSize: 10,
      }}>
        <span style={{ color: C_GRAY }}>
          1차 <span style={{
            color: row.firstAmount > 0 ? C_PINK : C_GRAY,
            fontFamily: "inherit", fontWeight: 700, marginLeft: 4,
          }}>
            ₩{row.firstAmount.toLocaleString()}
          </span>
        </span>
        <span style={{ color: C_GRAY, textAlign: "right" }}>
          2차 <span style={{
            color: C_GRAY, fontFamily: "inherit", fontWeight: 700, marginLeft: 4,
          }}>
            ₩{row.secondAmount.toLocaleString()}
          </span>
        </span>
      </div>
      {row.doneAmount > 0 && (
        <div style={{
          fontSize: 9, color: C_GREEN, marginTop: 4, fontWeight: 600,
        }}>
          ✓ 이미 지급 ₩{row.doneAmount.toLocaleString()}
        </div>
      )}
    </div>
  );
}

function SectionEmpty({ children }) {
  return (
    <div style={{
      padding: 24, textAlign: "center",
      color: C_GRAY, fontSize: 11,
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{children}</div>
  );
}

const errorBoxStyle = {
  padding: 10, marginBottom: 12,
  background: "rgba(255,68,68,0.08)",
  border: "1px solid rgba(255,68,68,0.3)",
  borderRadius: 8,
  color: "#ff4444", fontSize: 11, fontWeight: 600,
};

const confirmedBoxStyle = {
  padding: 12, marginBottom: 12,
  background: "rgba(29,158,117,0.10)",
  border: `1px solid ${C_GREEN}55`,
  borderRadius: 8,
  color: C_GREEN, fontSize: 12, fontWeight: 600,
  textAlign: "center",
};

export default UsolNToEngineerSection;
