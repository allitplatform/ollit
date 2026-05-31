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
// 2026-06-01 Phase B (B3) — 세금계산서 확인 / 운영자 측 RPC.
import {
  fetchTaxInvoicesByYm,
  confirmTaxInvoice,
  unconfirmTaxInvoice,
} from "../../lib/taxInvoiceDb.js";

const C_PINK   = "#FF1B8D";
const C_GREEN  = "#1D9E75";
const C_AMBER  = "#F59E0B";
const C_GRAY   = "#9CA3AF";
const C_GRAY_BAR = "#3A3A3A";

// 2026-06-01 B3 — 옛 일괄 지급 버튼 보존 (코드 유지, render 숨김).
//   결정 🅑 — 기사별 게이트 지급으로 전환. 복구 시 SHOW_BULK_PAY 을 true 로.
const SHOW_BULK_PAY = false;

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

// ── 기사별 그룹 ───────────────────────────────────────────
// 2026-06-01 B3 — pendingItemIds 추가 (기사별 게이트 지급 대상).
function groupItemsByEngineer(items, engineers, year, month) {
  const map = {};
  for (const it of items) {
    const k = bucketItem(it, year, month);
    if (!k) continue;
    const eid = (it.tasks && it.tasks.assigned_engineer_id) || null;
    const key = eid || "unassigned";
    if (!map[key]) {
      map[key] = {
        engineerKey:    key,
        engineerId:     eid,
        engineer:       engineers.find(e => e.id === eid) || null,
        engineerName:   (it.tasks && it.tasks.assignedEngineer) || null,
        firstAmount:    0,
        secondAmount:   0,
        doneAmount:     0,
        itemCount:      0,
        pendingItemIds: [],   // 1차 + 2차 (미지급) item ids — B3 게이트 지급용
      };
    }
    const slot = map[key];
    const amt = calcItemEngineerAmount(it);
    if (k === "first")  { slot.firstAmount  += amt; slot.pendingItemIds.push(it.id); }
    if (k === "second") { slot.secondAmount += amt; slot.pendingItemIds.push(it.id); }
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
// 2026-06-01 B3 — adminId (로그인 운영자 users.id) prop 추가.
//   gateYm = prevMonth(selectedMonth) — 세금계산서 / 게이트 지급 기준 (기사 prevYm 과 동일).
export function UsolNToEngineerSection({ adminId = null }) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmedInfo, setConfirmedInfo] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [showEngineerList, setShowEngineerList] = useState(false);

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

  // 2026-06-01 B3 — 세금계산서 / 게이트 지급 기준 ym = 한 달 전 (지급월 → 작업월).
  const gateYm = useMemo(() => {
    const prevDate = new Date(year, month - 2, 1);
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  }, [year, month]);

  function refresh() { setReloadTick(v => v + 1); }

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

  // 기사별 보기 — 별도 화면 (D8 — 인라인 X. 16명+ 가독성 위해 분리).
  if (showEngineerList) {
    return (
      <EngineerListScreen
        rows={byEng}
        monthLabel={selectedMonth}
        gateYm={gateYm}
        adminId={adminId}
        reloadTick={reloadTick}
        onRefresh={refresh}
        onBack={() => setShowEngineerList(false)}
      />
    );
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

          {/* 기사별 보기 — primary 핑크 (R-A3 fix: 주 동작) */}
          <button
            onClick={() => setShowEngineerList(true)}
            style={{
              width: "100%", marginTop: 14, padding: 14,
              background: C_PINK, border: "none", borderRadius: 10,
              color: "#fff", fontSize: 13, fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <span>기사별 보기 ({byEng.length}명)</span>
            <span style={{ fontSize: 18, fontWeight: 700, opacity: 0.85 }}>›</span>
          </button>

          {/* 일괄 지급 — Phase B (B3): 기사별 게이트 지급으로 전환. 평소 숨김.
              SHOW_BULK_PAY=true 로 바꾸면 복구. handleBulkSettle / RPC 호출 그대로 유지. */}
          {SHOW_BULK_PAY && split.pendingItems.length > 0 && (
            <button
              onClick={handleBulkSettle}
              disabled={confirming}
              style={{
                width: "100%", marginTop: 8, padding: "9px 12px",
                background: "var(--bg-secondary, #1A1A1A)",
                border: "1px solid var(--border, #2A2A2A)",
                borderRadius: 8,
                color: "var(--text-secondary, #9CA3AF)",
                fontSize: 11, fontWeight: 600,
                cursor: confirming ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: confirming ? 0.5 : 1,
              }}
            >
              {confirming
                ? "처리 중..."
                : `${selectedMonth} 일괄 지급 (1차+2차) · ${split.pendingItems.length}건`}
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

// ── 기사별 보기 — 별도 화면 (D8) ────────────────────────────
// 2026-06-01 B3 — 세금계산서 일괄 조회 (gateYm 기준 한 번) + 기사별 게이트 지급.
function EngineerListScreen({
  rows, monthLabel, gateYm, adminId, reloadTick, onRefresh, onBack,
}) {
  const [search, setSearch] = useState("");
  const [invoiceMap, setInvoiceMap] = useState(new Map());
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");

  // gateYm 변화 또는 부모 reloadTick → 일괄 조회.
  useEffect(() => {
    if (!gateYm) return;
    let alive = true;
    setInvoiceLoading(true);
    setInvoiceError("");
    fetchTaxInvoicesByYm({ ym: gateYm })
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setInvoiceError(res.error || "세금계산서 조회 실패");
          setInvoiceMap(new Map());
        } else {
          const m = new Map();
          for (const inv of res.invoices) m.set(inv.engineer_id, inv);
          setInvoiceMap(m);
        }
      })
      .finally(() => { if (alive) setInvoiceLoading(false); });
    return () => { alive = false; };
  }, [gateYm, reloadTick]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const name = (r.engineer?.name || r.engineerName || "").toLowerCase();
      return name.includes(q);
    });
  }, [rows, search]);

  return (
    <div>
      {/* 헤더 — 뒤로가기 + 월 라벨 + N명 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
      }}>
        <button onClick={onBack} style={backButtonStyle}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 800,
            color: "var(--text-primary, #FAF8F5)",
          }}>
            기사별 보기
          </div>
          <div style={{ fontSize: 10, color: C_GRAY, marginTop: 2 }}>
            {monthLabel} 지급 · 세금계산서 기준 {gateYm} · {rows.length}명
          </div>
        </div>
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

      {invoiceError && (
        <div style={{
          padding: "8px 10px", marginBottom: 8,
          background: "rgba(255,68,68,0.08)",
          border: "1px solid rgba(255,68,68,0.3)",
          borderRadius: 6,
          color: "#ff4444", fontSize: 10, fontWeight: 600,
        }}>
          ⚠️ {invoiceError}
        </div>
      )}

      {filtered.length === 0 ? (
        <SectionEmpty>
          {search ? "검색 결과 없음" : "해당 월 항목 없음"}
        </SectionEmpty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map(row => (
            <EngineerRow
              key={row.engineerKey}
              row={row}
              invoice={row.engineerId ? invoiceMap.get(row.engineerId) || null : null}
              invoiceLoading={invoiceLoading}
              gateYm={gateYm}
              adminId={adminId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 색 규칙 (R-A3 fix):
//   · 합계 — 기본색 (primary), 핑크 X. 한 행 한 큰 숫자.
//   · 1차 / 2차 — 작은 회색 라벨 + 회색 금액.
//   · 핑크는 위 요약(미지급 총액 + 1차 바)에만, 목록 행엔 사용 X.
// 2026-06-01 B3:
//   · 세금계산서 상태 뱃지 (미발행 / 발행함·확인 필요 / 확인 완료).
//   · [확인] 버튼 (발행함·미확인 시) → confirmTaxInvoice.
//   · [지급] 버튼 (게이트) — confirmed_at 있을 때만 활성. pending 항목만 마킹.
//   · [확인 취소] secondary (확인됨 시 옆에) → unconfirmTaxInvoice.
function EngineerRow({ row, invoice, invoiceLoading, gateYm, adminId, onRefresh }) {
  const [busy, setBusy] = useState(false);

  const total = row.firstAmount + row.secondAmount;
  const isAllDone = total === 0 && row.doneAmount > 0;
  const isUnassigned = row.engineerKey === "unassigned" || !row.engineerId;

  const engineerLabel = row.engineer?.name
    || row.engineerName
    || (isUnassigned ? "미배정" : `기사 ${(row.engineerKey || "").slice(0, 8)}`);

  // 세금계산서 상태 판정.
  //   unknown (load 중 / unassigned)
  const invStatus = useMemo(() => {
    if (isUnassigned) return "unassigned";
    if (invoiceLoading && !invoice) return "loading";
    if (!invoice || !invoice.marked_at) return "unmarked";
    if (invoice.confirmed_at) return "confirmed";
    return "marked";
  }, [invoice, invoiceLoading, isUnassigned]);

  async function handleConfirm() {
    if (busy || !row.engineerId || !gateYm) return;
    if (!confirm(
      `${engineerLabel} 기사의 ${gateYm} 세금계산서 확인 처리할까요?\n` +
      `→ 지급 버튼이 활성화됩니다.`
    )) return;
    setBusy(true);
    const res = await confirmTaxInvoice({
      engineerId: row.engineerId, ym: gateYm, actor: adminId,
    });
    setBusy(false);
    if (!res.ok) { alert("확인 처리 실패: " + res.error); return; }
    onRefresh && onRefresh();
  }

  async function handleUnconfirm() {
    if (busy || !row.engineerId || !gateYm) return;
    if (!confirm(
      `${engineerLabel} 기사의 ${gateYm} 세금계산서 확인을 취소할까요?\n` +
      `→ 지급 버튼이 비활성화됩니다.`
    )) return;
    setBusy(true);
    const res = await unconfirmTaxInvoice({
      engineerId: row.engineerId, ym: gateYm,
    });
    setBusy(false);
    if (!res.ok) { alert("확인 취소 실패: " + res.error); return; }
    onRefresh && onRefresh();
  }

  async function handleSettle() {
    if (busy) return;
    if (row.pendingItemIds.length === 0) return;
    if (invStatus !== "confirmed") return;
    if (!confirm(
      `${engineerLabel} 기사에게 ${row.pendingItemIds.length}건 지급 마킹할까요?\n` +
      `1차 ₩${row.firstAmount.toLocaleString()} + 2차 ₩${row.secondAmount.toLocaleString()}\n` +
      `= 총 ₩${total.toLocaleString()}`
    )) return;
    setBusy(true);
    const res = await markTaskItemsField(row.pendingItemIds, "engineer_settled_at");
    setBusy(false);
    if (!res.ok) { alert("지급 마킹 실패: " + res.error); return; }
    onRefresh && onRefresh();
  }

  const canSettle = invStatus === "confirmed" && row.pendingItemIds.length > 0;

  return (
    <div style={{
      padding: "10px 12px",
      background: isAllDone ? "rgba(29,158,117,0.05)" : "var(--bg-elevated, #1F1F1F)",
      border: isAllDone ? `1px solid ${C_GREEN}55` : "1px solid var(--border)",
      borderRadius: 10,
    }}>
      {/* 1행 — 이름 + 총액 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 4,
      }}>
        {row.engineer ? (
          <EngineerBadge engineer={row.engineer} size="sm"/>
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {engineerLabel}
          </span>
        )}
        <span style={{
          fontSize: 14, fontFamily: "inherit", fontWeight: 800,
          color: isAllDone ? C_GREEN : "var(--text-primary, #FAF8F5)",
        }}>
          ₩{total.toLocaleString()}
        </span>
      </div>

      {/* 2행 — 1차 / 2차 */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 10,
      }}>
        <span style={{ color: C_GRAY }}>
          1차{" "}
          <span style={{
            color: C_GRAY, fontFamily: "inherit", fontWeight: 700, marginLeft: 4,
          }}>
            ₩{row.firstAmount.toLocaleString()}
          </span>
        </span>
        <span style={{ color: C_GRAY, textAlign: "right" }}>
          2차{" "}
          <span style={{
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

      {/* 3행 — 세금계산서 뱃지 + 액션 */}
      {!isUnassigned && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: "1px dashed var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 6, flexWrap: "wrap",
        }}>
          <TaxBadge status={invStatus}/>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {invStatus === "marked" && (
              <SmallBtn
                kind="primary"
                onClick={handleConfirm}
                disabled={busy || !adminId}
                title={!adminId ? "운영자 ID 누락" : ""}
              >
                확인
              </SmallBtn>
            )}
            {invStatus === "confirmed" && (
              <SmallBtn
                kind="secondary"
                onClick={handleUnconfirm}
                disabled={busy}
              >
                확인 취소
              </SmallBtn>
            )}
            <SmallBtn
              kind={canSettle ? "settle" : "disabled"}
              onClick={canSettle ? handleSettle : undefined}
              disabled={!canSettle || busy}
              title={
                !canSettle && invStatus !== "confirmed"
                  ? "세금계산서 확인 먼저"
                  : (row.pendingItemIds.length === 0 ? "지급 대상 없음" : "")
              }
            >
              {row.pendingItemIds.length === 0
                ? "지급 대상 없음"
                : `지급 (${row.pendingItemIds.length}건)`}
            </SmallBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 세금계산서 상태 뱃지 ────────────────────────────────────
function TaxBadge({ status }) {
  if (status === "unassigned") {
    return <BadgeBase color={C_GRAY}>미배정 — 세금계산서 X</BadgeBase>;
  }
  if (status === "loading") {
    return <BadgeBase color={C_GRAY}>세금계산서 확인 중...</BadgeBase>;
  }
  if (status === "unmarked") {
    return <BadgeBase color={C_GRAY}>세금계산서 미발행</BadgeBase>;
  }
  if (status === "marked") {
    return <BadgeBase color={C_AMBER}>발행함 · 확인 필요</BadgeBase>;
  }
  // confirmed
  return <BadgeBase color={C_GREEN}>✓ 확인 완료</BadgeBase>;
}

function BadgeBase({ color, children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color,
      padding: "3px 8px", borderRadius: 6,
      background: `${color}1A`,
      border: `1px solid ${color}55`,
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

// ── 작은 액션 버튼 ───────────────────────────────────────────
function SmallBtn({ kind = "primary", onClick, disabled, title, children }) {
  const styleByKind = {
    primary:   { background: "var(--accent, #03C75A)", color: "#fff", border: "none" },
    secondary: { background: "transparent",            color: C_GRAY,  border: `1px solid ${C_GRAY}55` },
    settle:    { background: C_PINK,                   color: "#fff", border: "none" },
    disabled:  { background: "var(--bg-secondary, #1A1A1A)", color: C_GRAY, border: "1px solid var(--border)" },
  };
  const s = styleByKind[kind] || styleByKind.primary;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || ""}
      style={{
        ...s,
        padding: "5px 10px",
        borderRadius: 6,
        fontSize: 11, fontWeight: 700,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
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

const backButtonStyle = {
  background: "var(--bg-secondary, #1A1A1A)",
  border: "1px solid var(--border, #2A2A2A)",
  borderRadius: 8,
  padding: "6px 10px",
  color: "var(--text-primary, #FAF8F5)",
  fontSize: 14, fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
  flexShrink: 0,
};

export default UsolNToEngineerSection;
