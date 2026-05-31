// 2026-06-01 Phase 5 R-A2 — UsolNSettleScreen ① 섹션 (유솔 → 회사 주차별 받을 돈).
//
// PrincipalSettleTab WeekCard 디자인 미러링 (owner spec 색 규칙):
//   · 핑크 #FF1B8D — 금액(미수령) + 상태 "받을 예정"
//   · 회색          — 기간·건수, 상태 "유솔 보고 전", 금액(수령완료)
//   · 초록 #1D9E75  — 상태 "✓ 입금 확인 완료"
//   · 주황 #F59E0B  — 13일+ 경고 한 줄 (카드 위)
//
// 데이터 흐름 = UsolNTracking 과 동일:
//   fetchUsolNCompletedTaskItems({ monthsBack: 3 }) → task_items
//   fetchPrincipalRemitsForAdmin({ principalCodes: ["usol_h","usol_n"], monthsBack: 3 }) → remits
//   groupItemsByWeek(items, remitByKey) — naver_settled_at 기준 ISO 주
//
// 보존 (Phase A 절대 변경 금지):
//   confirmPrincipalRemit RPC 호출, calcItemReceive 수식 (= net_amount or subtotal × 0.85).
//   기존 UsolNTracking.jsx 파일은 손대지 않음 (D10 — 참고용 보존).

import { useState, useEffect, useMemo } from "react";
import { fetchUsolNCompletedTaskItems } from "../../lib/usolNTasksDb.js";
import {
  fetchPrincipalRemitsForAdmin,
  confirmPrincipalRemit,
} from "../../lib/principalRemitDb.js";
import { formatYmdHm } from "../../utils/dateLabel.js";

const C_PINK   = "#FF1B8D";
const C_GREEN  = "#1D9E75";
const C_AMBER  = "#F59E0B";
const C_GRAY   = "#9CA3AF";

const COMPANY_RATE_FALLBACK = 0.85;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ── 돈 계산 (UsolNTracking 과 동일 수식) ─────────────────────
function calcItemReceive(item) {
  if (item == null) return 0;
  if (item.net_amount != null) return item.net_amount;
  return Math.floor((item.subtotal || 0) * COMPANY_RATE_FALLBACK);
}

// ── 주차 그룹핑 (UsolNTracking 과 동일 로직) ─────────────────
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

function formatMD(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// naver_settled_at 기준 주차 그룹.
// remitByKey: Map<"principal_id|week_start", remit row>
function groupItemsByWeek(items, remitByKey) {
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
        remits: [],
      };
    }
    weekMap[weekKey].items.push(it);
  });

  // remit row 매핑
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

  return Object.values(weekMap).sort((a, b) => b.monday.getTime() - a.monday.getTime());
}

// 13일+ 경고 — naver_settled_at 13일+ 경과 + company_received_at NULL
function getLongPendingItems(items, daysCutoff) {
  const cutoffMs = Date.now() - daysCutoff * 24 * 60 * 60 * 1000;
  return items.filter(it => {
    if (!it.naver_settled_at) return false;
    if (it.company_received_at) return false;
    const t = new Date(it.naver_settled_at).getTime();
    return t < cutoffMs;
  });
}

// 주차 상태 판정
//   kind: "done" (전부 confirmed) / "reported" (보고는 있는데 confirm X) / "none" (보고 X)
function getWeekStatus(remits) {
  if (!remits || remits.length === 0) return { kind: "none" };
  const allConfirmed = remits.every(r => r.confirmed_at);
  if (allConfirmed) {
    const last = remits.map(r => r.confirmed_at).filter(Boolean).sort().pop();
    return { kind: "done", lastConfirmAt: last };
  }
  const anyReported = remits.some(r => r.remitted_at);
  if (anyReported) return { kind: "reported" };
  return { kind: "none" };
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export function UsolNToCompanySection() {
  const [items,   setItems]   = useState([]);
  const [remits,  setRemits]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [selectedWeek, setSelectedWeek] = useState(null);
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

  const remitByKey = useMemo(() => {
    const m = new Map();
    for (const r of remits) m.set(`${r.principal_id}|${r.week_start}`, r);
    return m;
  }, [remits]);

  const weeks       = useMemo(() => groupItemsByWeek(items, remitByKey), [items, remitByKey]);
  const longPending = useMemo(() => getLongPendingItems(items, 13), [items]);

  const thisWeekKey = useMemo(() => getWeekKey(new Date()), []);

  if (loading) {
    return <SectionEmpty>불러오는 중...</SectionEmpty>;
  }
  if (error) {
    return <SectionEmpty>⚠️ {error}</SectionEmpty>;
  }

  return (
    <div>
      {longPending.length > 0 && <LongPendingRow count={longPending.length}/>}

      {weeks.length === 0 ? (
        <SectionEmpty>네이버 정산된 주차가 없습니다</SectionEmpty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {weeks.map(wk => (
            <WeekCard
              key={wk.weekKey}
              week={wk}
              isThisWeek={wk.weekKey === thisWeekKey}
              onClick={() => setSelectedWeek(wk)}
            />
          ))}
        </div>
      )}

      {selectedWeek && (
        <WeekDetailModal
          week={selectedWeek}
          onClose={() => setSelectedWeek(null)}
          onConfirmRemit={async (remitIds) => {
            if (!remitIds || remitIds.length === 0) {
              alert("이 주차에 유솔이 보고한 입금이 없습니다.");
              return false;
            }
            const results = await Promise.all(
              remitIds.map(id => confirmPrincipalRemit({ remitId: id }))
            );
            const failed = results.find(r => !r.ok);
            if (failed) {
              alert("입금 확인 실패: " + (failed.error || "알 수 없는 오류"));
              return false;
            }
            setSelectedWeek(null);
            refresh();
            return true;
          }}
        />
      )}
    </div>
  );
}

// ── 13일+ 경고 한 줄 (주황) ────────────────────────────────
function LongPendingRow({ count }) {
  return (
    <div style={{
      padding: "10px 12px", marginBottom: 10,
      background: "rgba(245,158,11,0.08)",
      border: `1px solid ${C_AMBER}`,
      borderLeft: `4px solid ${C_AMBER}`,
      borderRadius: 8,
      fontSize: 11, color: C_AMBER, fontWeight: 700,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span>🚨</span>
      <span>13일+ 회사 입금 대기 {count}건 — 유솔 입금 지연 확인 필요</span>
    </div>
  );
}

// ── WeekCard (PrincipalSettleTab 디자인 미러링, owner 색 규칙) ──
function WeekCard({ week, isThisWeek, onClick }) {
  const sumReceive = week.items.reduce((s, it) => s + calcItemReceive(it), 0);
  const status     = getWeekStatus(week.remits);
  const isReceived = status.kind === "done";

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", fontFamily: "inherit",
        background: "var(--bg-elevated, #1F1F1F)",
        border: `1px solid ${isThisWeek ? C_PINK : "var(--border, #2A2A2A)"}`,
        borderRadius: 10,
        padding: "12px 14px",
        cursor: "pointer",
        boxShadow: isThisWeek ? `0 0 0 1px ${C_PINK}55` : "none",
      }}
    >
      {/* 상단 — 주차 라벨 + 기간 / 우측 건수 */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: "var(--text-primary, #FAF8F5)",
          }}>
            {week.mondayLabel} (월)
          </span>
          <span style={{ fontSize: 11, color: C_GRAY }}>
            {week.dateRange}
          </span>
        </div>
        <span style={{ fontSize: 11, color: C_GRAY, whiteSpace: "nowrap" }}>
          네이버 정산 {week.items.length}건
        </span>
      </div>

      {/* 하단 — 상태 / 금액 */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
      }}>
        <StatusElem status={status}/>
        <span style={{
          fontSize: isReceived ? 14 : 17,
          fontWeight: isReceived ? 600 : 800,
          color: isReceived ? C_GRAY : C_PINK,
          fontFamily: "inherit", lineHeight: 1,
        }}>
          ₩{sumReceive.toLocaleString()}
        </span>
      </div>
    </button>
  );
}

function StatusElem({ status }) {
  if (status.kind === "done") {
    const d = status.lastConfirmAt ? new Date(status.lastConfirmAt) : null;
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, color: C_GREEN,
        display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap",
      }}>
        ✓ 입금 확인 완료{d ? ` ${formatMD(d)}` : ""}
      </span>
    );
  }
  if (status.kind === "reported") {
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, color: C_PINK, whiteSpace: "nowrap",
      }}>
        받을 예정
      </span>
    );
  }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color: C_GRAY, whiteSpace: "nowrap",
    }}>
      유솔 보고 전
    </span>
  );
}

// ── 드릴인 모달 (UsolNTracking 의 WeekDetailModal 복사 — 색 규칙만 신규 톤으로) ──
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
            <div style={{
              fontSize: 14, fontWeight: 700,
              color: "var(--text-primary, #FAF8F5)",
            }}>
              {week.mondayLabel} (월) 입금 상세
            </div>
            <div style={{ fontSize: 10, color: C_GRAY, marginTop: 2 }}>
              {week.dateRange} · 항목 {week.items.length}개
              {pendingRemits.length > 0 && (
                <> · 확인 대기 {pendingRemits.length}건</>
              )}
            </div>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <div style={{
          padding: 14, marginBottom: 14,
          background: allConfirmed ? "rgba(29,158,117,0.08)" : "rgba(255,27,141,0.08)",
          border: `1px solid ${allConfirmed ? C_GREEN : C_PINK}`,
          borderRadius: 10,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: allConfirmed ? C_GREEN : C_PINK,
            }}>
              네이버 정산금액
            </span>
            <span style={{
              fontFamily: "inherit", fontWeight: 800, fontSize: 14,
              color: allConfirmed ? C_GREEN : C_PINK,
            }}>
              ₩{companyReceive.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 11, color: C_GRAY, marginBottom: 6, fontWeight: 600 }}>
          항목 목록 ({week.items.length})
        </div>

        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {week.items.map(item => (
            <DetailItemRow key={item.id} item={item}/>
          ))}
        </div>

        {noReport && (
          <div style={{
            marginTop: 14, padding: 12,
            background: "var(--bg-secondary)",
            border: "1px dashed var(--border)",
            borderRadius: 10, textAlign: "center",
            fontSize: 11, color: C_GRAY,
          }}>
            유솔이 아직 "입금했습니다" 보고를 하지 않았습니다.<br/>
            <span style={{ fontSize: 10, opacity: 0.7 }}>
              유솔앱 정산 탭에서 보고하면 여기에 노출됩니다.
            </span>
          </div>
        )}

        {canConfirm && (
          <div style={{
            marginTop: 14, padding: 10, marginBottom: 8,
            background: "rgba(255,27,141,0.08)",
            border: `1px solid ${C_PINK}`,
            borderRadius: 10,
            fontSize: 11,
          }}>
            <div style={{ color: C_PINK, fontWeight: 700, marginBottom: 2 }}>
              📣 유솔 보고 — 회사 확인 대기
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              보고 금액{" "}
              <span style={{
                fontFamily: "inherit", fontWeight: 700,
                color: "var(--text-primary)",
              }}>
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
              background: C_GREEN,
              border: "none", borderRadius: 10,
              color: "#fff", fontSize: 12, fontWeight: 700,
              fontFamily: "inherit",
              cursor: confirming ? "not-allowed" : "pointer",
              opacity: confirming ? 0.5 : 1,
            }}
          >
            {confirming
              ? "확인 처리 중..."
              : `✓ 입금 확인 (₩${reportedAmount.toLocaleString()})`}
          </button>
        )}

        {allConfirmed && (
          <div style={{
            marginTop: 14, padding: 10,
            background: "rgba(29,158,117,0.08)",
            border: `1px solid ${C_GREEN}`,
            borderRadius: 10,
            textAlign: "center", fontSize: 11, color: C_GREEN, fontWeight: 700,
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
      padding: 10, marginBottom: 4,
      background: isReceived
        ? "rgba(29,158,117,0.05)"
        : (isExtra ? "rgba(245,158,11,0.04)" : "var(--bg-secondary)"),
      border: isReceived
        ? `1px solid ${C_GREEN}55`
        : (isExtra ? `1px solid ${C_AMBER}55` : "1px solid var(--border)"),
      borderRadius: 8,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600 }}>
            {item.tasks?.customer_name || "—"}
          </span>
          <span style={{ fontSize: 9, color: C_GRAY }}>
            · {label} ×{item.qty || 1}
          </span>
          {isExtra && (
            <span style={{
              fontSize: 8, color: C_AMBER,
              background: "rgba(245,158,11,0.2)",
              padding: "1px 4px", borderRadius: 2, fontWeight: 700,
            }}>추가</span>
          )}
          {isReceived && <span style={{ fontSize: 9, color: C_GREEN }}>🟠</span>}
        </div>
        <span style={{
          fontSize: 11, fontFamily: "inherit",
          color: isReceived ? C_GRAY : C_PINK, fontWeight: 600,
        }}>
          ₩{receive.toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 9, color: C_GRAY }}>
        {item.tasks?.task_no || "—"}
        {item.tasks?.completed_at && (
          <> · {formatYmdHm(item.tasks.completed_at)}</>
        )}
      </div>
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

// ── 스타일 ────────────────────────────────────────────────
const modalOverlayStyle = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 200,
  padding: 16,
};

const modalContentStyle = {
  width: "100%", maxWidth: 480,
  maxHeight: "90vh",
  overflowY: "auto",
  background: "var(--bg-elevated, #1F1F1F)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 16,
  fontFamily: "inherit",
};

const modalHeaderStyle = {
  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
  marginBottom: 14,
  gap: 8,
};

const closeButtonStyle = {
  background: "transparent", border: "none",
  color: C_GRAY, fontSize: 16,
  cursor: "pointer", padding: 4,
  fontFamily: "inherit",
  flexShrink: 0,
};

export default UsolNToCompanySection;
