// Phase 5 Step 0.C-1 — 유솔N · 정산 추적 (DB 전환)
// 2026-05-19
// 흐름:
//   1) fetchUsolNCompletedTaskItems → 완료 작업 측 task_items 전체 (3개월 cutoff)
//   2) 주차 그룹핑 = tasks.completed_at 측 월~일
//   3) 이번주 받을 돈 카드 (회사 입금 X) + 주간 입금 이력 (이전 5주)
//   4) 13일+ 경고 (naver_settled_at 13일+ 경과 + 회사 입금 X)
//   5) "회사 입금 완료" 버튼 → company_received_at 일괄 UPDATE
// 옛 흐름 (localStorage + COMPANY_RATE) 폐기. net_amount NULL 시 fallback (subtotal × 0.85).
import { useState, useMemo, useEffect } from "react";
import { fetchUsolNCompletedTaskItems } from "../../lib/usolNTasksDb.js";
import {
  fetchPrincipalRemitsForAdmin,
  confirmPrincipalRemit,
} from "../../lib/principalRemitDb.js";
import { formatYmdHm } from "../../utils/dateLabel.js";

const COMPANY_RATE_FALLBACK = 0.85; // net_amount NULL 시 fallback

// 항목별 회사 받을 돈
function calcItemReceive(item) {
  if (item == null) return 0;
  if (item.net_amount != null) return item.net_amount;
  return Math.floor((item.subtotal || 0) * COMPANY_RATE_FALLBACK);
}

export function UsolNTracking() {
  const [items,   setItems]   = useState([]);
  const [remits,  setRemits]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [showWeekDetail, setShowWeekDetail] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      fetchUsolNCompletedTaskItems({ monthsBack: 3 }),
      fetchPrincipalRemitsForAdmin({ principalCodes: ["usol_h", "usol_n"], monthsBack: 3 }),
    ]).then(([itemsRes, remitRes]) => {
      if (!alive) return;
      if (!itemsRes.ok) setError(itemsRes.error || "불러오기 실패");
      setItems(itemsRes.items || []);
      setRemits(remitRes.remits || []);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadTick]);

  function refresh() { setReloadTick(v => v + 1); }

  // remit row → key = (principal_id, week_start)
  const remitByKey = useMemo(() => {
    const m = new Map();
    for (const r of remits) m.set(`${r.principal_id}|${r.week_start}`, r);
    return m;
  }, [remits]);

  const weeklyGroups = useMemo(() => groupItemsByWeek(items, remitByKey), [items, remitByKey]);
  const longPending  = useMemo(() => getLongPendingItems(items, 13), [items]);
  const monthSummary = useMemo(() => calcMonthSummary(items), [items]);
  const pendingConfirmCount = remits.filter(r => r.remitted_at && !r.confirmed_at).length;

  if (loading) {
    return <Empty>불러오는 중...</Empty>;
  }
  if (error) {
    return <Empty>⚠️ {error}</Empty>;
  }

  return (
    <div>
      {pendingConfirmCount > 0 && (
        <div style={{
          padding: 10,
          background: "rgba(245,158,11,0.10)",
          border: "2px solid rgba(245,158,11,0.5)",
          borderRadius: 10, marginBottom: 10,
          fontSize: 11, color: "#F59E0B", fontWeight: 700,
        }}>
          📣 유솔 입금 보고 {pendingConfirmCount}건 — 회사 확인 대기
        </div>
      )}
      {longPending.length > 0 && <LongPendingAlert items={longPending}/>}

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
          onConfirmRemit={async (remitIds) => {
            if (!remitIds || remitIds.length === 0) {
              alert("이 주차에 유솔이 보고한 입금이 없습니다.");
              return false;
            }
            const results = await Promise.all(remitIds.map(id => confirmPrincipalRemit({ remitId: id })));
            const failed = results.find(r => !r.ok);
            if (failed) {
              alert("입금 확인 실패: " + (failed.error || "알 수 없는 오류"));
              return false;
            }
            setShowWeekDetail(null);
            refresh();
            return true;
          }}
        />
      )}
    </div>
  );
}

function ThisWeekCard({ week, onClick }) {
  if (!week || week.items.length === 0) {
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

  const companyReceive = week.items.reduce((s, it) => s + calcItemReceive(it), 0);

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
          {week.dateRange} 작업 항목 {week.items.length}개
        </span>
        <span style={{ fontSize: 9, color: "#03C75A", fontWeight: 600 }}>
          상세 보기 →
        </span>
      </div>
    </button>
  );
}

function WeekHistoryCard({ week, latest, onClick }) {
  const companyReceive = week.items.reduce((s, it) => s + calcItemReceive(it), 0);
  // 신규 워크플로 — remit row 측 측 측 측
  //   confirmed_at 측 측 → 입금완료
  //   remitted_at 측 측 (confirmed_at NULL) → 확인 대기 (유솔 측 측 측)
  //   row 측 X → 보고 전
  const remits = week.remits || [];
  const allConfirmed = remits.length > 0 && remits.every(r => r.confirmed_at);
  const anyReported  = remits.some(r => r.remitted_at && !r.confirmed_at);

  let statusBadge;
  if (allConfirmed) {
    statusBadge = <span style={{ fontSize: 9, color: "#03C75A" }}>✓ 입금 확인 완료</span>;
  } else if (anyReported) {
    statusBadge = <span style={{ fontSize: 9, color: "#F59E0B", fontWeight: 700 }}>⏳ 유솔 보고 측 — 확인 대기</span>;
  } else {
    statusBadge = <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>· 유솔 보고 전</span>;
  }

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", padding: 11,
        background: anyReported ? "rgba(245,158,11,0.10)" : (latest ? "rgba(3,199,90,0.06)" : "var(--bg-secondary)"),
        border: anyReported
          ? "2px solid rgba(245,158,11,0.5)"
          : (latest ? "1px solid rgba(3,199,90,0.3)" : "1px solid var(--border)"),
        borderRadius: 10, marginBottom: 4,
        cursor: "pointer",
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
          {statusBadge}
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
        {week.dateRange} 항목 {week.items.length}개
      </div>
    </button>
  );
}

function WeekDetailModal({ week, onClose, onConfirmRemit }) {
  const [confirming, setConfirming] = useState(false);
  const companyReceive = week.items.reduce((s, it) => s + calcItemReceive(it), 0);
  const remits = week.remits || [];
  const pendingRemits = remits.filter(r => r.remitted_at && !r.confirmed_at);
  const allConfirmed  = remits.length > 0 && remits.every(r => r.confirmed_at);
  const noReport      = remits.length === 0;
  const canConfirm    = pendingRemits.length > 0;
  const reportedAmount = pendingRemits.reduce((s, r) => s + (Number(r.remitted_amount) || 0), 0);

  async function handleConfirm() {
    if (!canConfirm) return;
    setConfirming(true);
    const ok = await onConfirmRemit(pendingRemits.map(r => r.id));
    setConfirming(false);
    if (!ok) return;
  }

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#03C75A" }}>
              {week.mondayLabel} (월) 입금 상세
            </div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
              {week.dateRange} · 항목 {week.items.length}개 · 대기 {pendingItems.length}개
            </div>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <div style={{
          padding: 14,
          background: "rgba(3,199,90,0.08)",
          borderRadius: 10, marginBottom: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "#03C75A", fontWeight: 700 }}>회사 받을 돈</span>
            <span style={{
              fontFamily: "inherit", color: "#03C75A",
              fontWeight: 700, fontSize: 13,
            }}>
              ₩{companyReceive.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
          항목 목록 ({week.items.length})
        </div>

        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {week.items.map(item => (
            <DetailItemRow key={item.id} item={item}/>
          ))}
        </div>

        {/* 입금 워크플로 상태 */}
        {noReport && (
          <div style={{
            marginTop: 14, padding: 12,
            background: "var(--bg-secondary)",
            border: "1px dashed var(--border)",
            borderRadius: 10, textAlign: "center",
            fontSize: 11, color: "var(--text-secondary)",
          }}>
            유솔이 아직 "입금했습니다" 보고를 하지 않았습니다.<br/>
            <span style={{ fontSize: 10, opacity: 0.7 }}>원청 측 측 측 측 측 측 측 측 측.</span>
          </div>
        )}

        {canConfirm && (
          <div style={{
            marginTop: 14,
            padding: 10,
            background: "rgba(245,158,11,0.10)",
            border: "1px solid rgba(245,158,11,0.4)",
            borderRadius: 10, marginBottom: 8,
            fontSize: 11,
          }}>
            <div style={{ color: "#F59E0B", fontWeight: 700, marginBottom: 2 }}>
              📣 유솔 보고 — 회사 확인 대기
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              보고 금액 <span style={{ fontFamily: "inherit", fontWeight: 700, color: "var(--text-primary)" }}>
                ₩{reportedAmount.toLocaleString()}
              </span>
              {pendingRemits[0]?.remitted_at && (
                <> · 보고 시각 {formatYmdHm(pendingRemits[0].remitted_at)}</>
              )}
            </div>
          </div>
        )}

        {canConfirm && (
          <button
            onClick={handleConfirm}
            disabled={confirming}
            style={{
              width: "100%", padding: 12,
              background: "#03C75A",
              border: "none", borderRadius: 10,
              color: "#fff", fontSize: 12, fontWeight: 700,
              fontFamily: "inherit",
              cursor: confirming ? "not-allowed" : "pointer",
              opacity: confirming ? 0.5 : 1,
            }}
          >
            {confirming ? "확인 처리 중..." : `✓ 입금 확인 (₩${reportedAmount.toLocaleString()})`}
          </button>
        )}

        {allConfirmed && (
          <div style={{
            marginTop: 14, padding: 10,
            background: "rgba(3,199,90,0.08)",
            border: "1px solid rgba(3,199,90,0.3)",
            borderRadius: 10,
            textAlign: "center", fontSize: 11, color: "#03C75A", fontWeight: 700,
          }}>
            ✓ 입금 확인 완료
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItemRow({ item }) {
  const isExtra = item.order_type === "추가선택";
  const receive = calcItemReceive(item);
  const wt = item.work_types && item.work_types.name;
  const at = item.appliance_types && item.appliance_types.name;
  const label = at || wt || item.order_type || "—";
  const isReceived = !!item.company_received_at;

  return (
    <div style={{
      padding: 10,
      background: isReceived
        ? "rgba(29,158,117,0.05)"
        : (isExtra ? "rgba(245,158,11,0.04)" : "var(--bg-secondary)"),
      border: isReceived
        ? "1px solid rgba(29,158,117,0.3)"
        : (isExtra ? "1px solid rgba(245,158,11,0.3)" : "1px solid var(--border)"),
      borderRadius: 8, marginBottom: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600 }}>
            {item.tasks?.customer_name || "—"}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
            · {label} ×{item.qty || 1}
          </span>
          {isExtra && (
            <span style={{
              fontSize: 8, color: "#F59E0B",
              background: "rgba(245,158,11,0.2)",
              padding: "1px 4px", borderRadius: 2, fontWeight: 700,
            }}>추가</span>
          )}
          {isReceived && (
            <span style={{ fontSize: 9, color: "#1D9E75" }}>🟠</span>
          )}
        </div>
        <span style={{
          fontSize: 11, fontFamily: "inherit",
          color: "#03C75A", fontWeight: 600,
        }}>
          ₩{receive.toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))" }}>
        {item.tasks?.task_no || "—"}
        {item.tasks?.completed_at && (
          <> · {formatYmdHm(item.tasks.completed_at)}</>
        )}
      </div>
    </div>
  );
}

function LongPendingAlert({ items }) {
  return (
    <div style={{
      padding: 12,
      background: "rgba(255,68,68,0.08)",
      border: "2px solid rgba(255,68,68,0.4)",
      borderRadius: 10, marginBottom: 14,
    }}>
      <div style={{ fontSize: 11, color: "#ff4444", fontWeight: 700, marginBottom: 4 }}>
        🚨 13일+ 회사 입금 대기 항목 {items.length}개
      </div>
      <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
        네이버 결제완료 후 13일+ 경과 · 유솔 측 회사 입금 지연 spec 확인 필요
      </div>
    </div>
  );
}

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
        <span style={{ color: "var(--text-secondary)" }}>받은 돈 (회사 입금 완료)</span>
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

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekKey(date) {
  const m = getMondayOfWeek(date);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
}

// 항목 (task_items) 측 주차 그룹 — naver_settled_at 기준 (정산 탭과 일치)
// remitByKey: Map<"principal_id|week_start", remit row>
function groupItemsByWeek(items, remitByKey) {
  const result = { thisWeek: null, lastWeek: null, previousWeeks: [] };

  const weekMap = {};
  items.forEach(it => {
    const settledAt = it.naver_settled_at;
    if (!settledAt) return;
    const settledDate = new Date(settledAt);
    const weekKey = getWeekKey(settledDate);

    if (!weekMap[weekKey]) {
      const monday = getMondayOfWeek(settledDate);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      weekMap[weekKey] = {
        weekKey,
        monday,
        sunday,
        mondayLabel: `${monday.getMonth() + 1}/${monday.getDate()}`,
        dateRange:   `${monday.getMonth() + 1}/${monday.getDate()}~${sunday.getMonth() + 1}/${sunday.getDate()}`,
        items: [],
        remits: [],   // 그 주차의 입금 보고 row (principal별 1건)
      };
    }
    weekMap[weekKey].items.push(it);
  });

  // 측 주차에 remit row 매핑 — items의 principal_id 측 측 측 remitByKey 측 catch
  if (remitByKey) {
    for (const wk of Object.values(weekMap)) {
      const weekStartIso = `${wk.monday.getFullYear()}-${String(wk.monday.getMonth() + 1).padStart(2, "0")}-${String(wk.monday.getDate()).padStart(2, "0")}`;
      const pids = [...new Set(wk.items.map(it => it.tasks?.principal_id).filter(Boolean))];
      for (const pid of pids) {
        const r = remitByKey.get(`${pid}|${weekStartIso}`);
        if (r) wk.remits.push(r);
      }
    }
  }

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

  result.previousWeeks = result.previousWeeks.slice(0, 4);
  return result;
}

// 13일+ 회사 입금 대기 (naver_settled_at 13일+ 경과 + company_received_at NULL)
function getLongPendingItems(items, daysCutoff) {
  const cutoffMs = Date.now() - daysCutoff * 24 * 60 * 60 * 1000;
  return items.filter(it => {
    if (!it.naver_settled_at) return false;
    if (it.company_received_at) return false;
    const t = new Date(it.naver_settled_at).getTime();
    return t < cutoffMs;
  });
}

// 월 누적 — 이번달 항목 측 회사 입금 received / pending
function calcMonthSummary(items) {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthItems = items.filter(it => {
    const completedAt = it.tasks && it.tasks.completed_at;
    if (!completedAt) return false;
    const d = new Date(completedAt);
    return d >= monthStart && d <= monthEnd;
  });

  const received = monthItems
    .filter(it => it.company_received_at)
    .reduce((s, it) => s + calcItemReceive(it), 0);

  const pending = monthItems
    .filter(it => !it.company_received_at)
    .reduce((s, it) => s + calcItemReceive(it), 0);

  return {
    monthLabel: `${now.getMonth() + 1}월`,
    received,
    pending,
    total: received + pending,
  };
}

// ── 스타일 ───────────────────────────────────
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

export default UsolNTracking;
