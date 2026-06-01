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
// 2026-06-01 reconcile fix — usol_n 월정산 정책(세척 100% / 추가선택 85% / 냉매 제외) DB 측 RPC.
//   기사앱 EngineerApp.jsx line 4544 와 동일 호출 → 양쪽 금액 정합.
import { supabase } from "../../lib/supabase.js";

const C_PINK   = "#FF1B8D";
const C_GREEN  = "#1D9E75";
const C_AMBER  = "#F59E0B";
const C_GRAY   = "#9CA3AF";
const C_GRAY_BAR = "#3A3A3A";
// 2026-06-01 S2.5 — 기사별 막대 색 (시안 usoln_company_to_engineer_settlement_redesign).
const C_PINK_DEEP  = "#D4537E";  // 1차 (진분홍) — 옛 시안 (호환)
const C_PINK_LIGHT = "#F8CDD9";  // 2차 (연분홍) — 옛 시안 (호환)
// 2026-06-01 — 기사앱 정산 카드 미러링 (받음/예정/미확정 3단계).
const C_BUCKET_RECEIVED   = "#03C75A";   // 받음 (engineer_settled, 초록)
const C_BUCKET_SCHEDULED  = "#EF9F27";   // 예정 (naver_settled 미지급, 주황)
const C_BUCKET_UNCERTAIN  = "#6B7280";   // 미확정 (미정산, 회색)

// 2026-06-01 B3 — 옛 일괄 지급 버튼 보존 (코드 유지, render 숨김).
//   결정 🅑 — 기사별 게이트 지급으로 전환. 복구 시 SHOW_BULK_PAY 을 true 로.
const SHOW_BULK_PAY = false;

const ENGINEER_RATIO_FALLBACK = 0.6;
const COMPANY_RATE_FALLBACK   = 0.85;

// 2026-06-01 S2 — 회사 실입금 (작업월 기준).
//   APR/MAY 는 legacy net_amount 가 gross 로 오염 → 시트 기준 고정값.
//   JUN+ 는 신형식 (net < subtotal × 0.95) 만 net × 0.85 자동 합산.
//   순이익(월) = 회사 실입금 − 기사 지급 RPC 합산.
const COMPANY_NET_INCOME_BY_YM = {
  "2026-04": 35_048_310,
  "2026-05": 52_319_693,
};
const TRUE_NET_RATIO_CUTOFF = 0.95;       // net < subtotal × 0.95 → 신형식 (진짜 net)
const NAVER_NET_TO_COMPANY_FACTOR = 0.85; // 유솔 15% 차감 → 회사 실입금

// ── 돈 계산 (정책 — 세척 100% / 추가선택 85% / 냉매 제외) ────
// 2026-06-01 reconcile fix:
//   1순위 — engByItem (RPC compute_engineer_amount_per_item_batch) 결과 사용.
//     기사앱 EngineerApp.jsx 측 같은 RPC → 양쪽 금액 정합.
//   2순위 — RPC 미반환 시 fallback (legacy 추정 수식). 운영 데이터에선 거의 안 탐.
function calcItemEngineerAmount(item, engByItem) {
  if (item == null) return 0;
  if (engByItem && engByItem.has(item.id)) {
    return Number(engByItem.get(item.id)) || 0;
  }
  // fallback (RPC 결과 없을 때만 — 정확도 낮음)
  if (item.net_amount != null) return item.net_amount;
  const subtotal = item.subtotal || 0;
  return Math.floor(subtotal * COMPANY_RATE_FALLBACK * ENGINEER_RATIO_FALLBACK);
}

// ── 1·2차 버킷 분류 (2026-06-01 — 작업월 + naver 정산 여부 기준) ──
// 변경: selectedMonth (지급월) 의 naver_settled_at KST 윈도우 X →
//        gateYm (작업월) 의 task.completed_at KST 필터 + naver_settled_at NULL/NOT NULL.
//   · 1차 (first)  = 작업월 + naver_settled_at NOT NULL (정산 확정 → 지급 가능)
//   · 2차 (second) = 작업월 + naver_settled_at NULL     (미정산 예정 → 다음 cycle 지급)
//   · done_*       = engineer_settled_at NOT NULL (이미 지급)
//   · null         = 작업월 시야 외 / 취소
function bucketItem(item, gateYear, gateMonth) {
  if (item?.is_canceled) return null;
  if (!inKstMonth(item?.tasks?.completed_at, gateYear, gateMonth)) return null;
  if (item.engineer_settled_at) {
    return item.naver_settled_at ? "done_1" : "done_2";
  }
  if (item.naver_settled_at) return "first";
  return "second";
}

// 집계 — 측 item을 bucketItem 로 분류한 후 합산.
// 반환:
//   firstTotal       = 1차 (naver_settled · 미지급)         = "예정" (주황)
//   secondTotal      = 2차 (미정산 · 미지급)                 = "미확정" (회색)
//   done1Total       = naver_settled · 이미 지급             = "받음 1차"
//   done2Total       = 미정산 · 이미 지급 (드문 케이스)        = "받음 2차"
//   doneTotal        = done1+done2                          = "받음" (초록)
//   naverConfirmed   = firstTotal + done1Total              = 회사 실입금이 잡힌 분 (순이익 산식 모집단)
//   pendingTotal     = firstTotal + secondTotal             = 미지급 합
//   pendingItems     = 1차+2차 미지급 task_items (지급 게이트 대상)
function splitByBucket(items, year, month, engByItem) {
  const result = {
    firstItems: [], secondItems: [], doneItems_1: [], doneItems_2: [],
    firstTotal: 0, secondTotal: 0, done1Total: 0, done2Total: 0,
  };
  for (const it of items) {
    const k = bucketItem(it, year, month);
    if (!k) continue;
    const amt = calcItemEngineerAmount(it, engByItem);
    if (k === "first")  { result.firstItems.push(it);   result.firstTotal  += amt; }
    if (k === "second") { result.secondItems.push(it);  result.secondTotal += amt; }
    if (k === "done_1") { result.doneItems_1.push(it);  result.done1Total  += amt; }
    if (k === "done_2") { result.doneItems_2.push(it);  result.done2Total  += amt; }
  }
  result.doneTotal      = result.done1Total + result.done2Total;
  result.naverConfirmed = result.firstTotal + result.done1Total;
  result.pendingItems   = [...result.firstItems, ...result.secondItems];
  result.pendingTotal   = result.firstTotal + result.secondTotal;
  return result;
}

// ── 작업월 (gateYm) 기준 회사 실입금 / 기사 지급 합산 ─────────
// items 전부에서 task.completed_at 이 KST 그 달인 것 필터.
//   gateYm = 작업월 ("YYYY-MM"). selectedMonth 의 한 달 전 = 지급 대상 작업월.
function inKstMonth(completedAt, year, month) {
  if (!completedAt) return false;
  const t = new Date(completedAt).getTime();
  if (isNaN(t)) return false;
  const start = Date.UTC(year, month - 1, 1, -9, 0, 0, 0);  // KST 1일 00:00
  const end   = Date.UTC(year, month,     1, -9, 0, 0, 0);  // 다음 달 KST 1일 00:00
  return t >= start && t < end;
}

// 회사 실입금 (작업월 기준).
//   APR/MAY = 상수 (legacy gross 오염). JUN+ = 자동 (신형식 net × 0.85).
function computeCompanyNetIncome(items, gateYm) {
  if (!gateYm) return { amount: 0, source: "n/a", validation: null };
  if (COMPANY_NET_INCOME_BY_YM[gateYm] != null) {
    return { amount: COMPANY_NET_INCOME_BY_YM[gateYm], source: "constant", validation: null };
  }
  const [y, m] = gateYm.split("-").map(Number);
  let sumTrueNet = 0;
  let countTrue = 0, countGross = 0, countNull = 0, countActive = 0;
  for (const it of items) {
    if (it.is_canceled) continue;
    if (!inKstMonth(it.tasks?.completed_at, y, m)) continue;
    countActive += 1;
    const net = Number(it.net_amount);
    const sub = Number(it.subtotal);
    if (it.net_amount == null || net === 0) { countNull += 1; continue; }
    if (sub > 0 && net < sub * TRUE_NET_RATIO_CUTOFF) {
      sumTrueNet += net;
      countTrue  += 1;
    } else {
      countGross += 1;
    }
  }
  return {
    amount: Math.round(sumTrueNet * NAVER_NET_TO_COMPANY_FACTOR),
    source: "auto",
    validation: { countActive, countTrue, countGross, countNull },
  };
}

// ── 기사별 그룹 ───────────────────────────────────────────
// 2026-06-01 — 받음 (done1+done2) / 예정 (first) / 미확정 (second) 3단계 트래킹.
function groupItemsByEngineer(items, engineers, year, month, engByItem) {
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
        firstAmount:    0,   // 예정 (naver settled, 미지급)
        secondAmount:   0,   // 미확정 (미정산)
        done1Amount:    0,   // 받음 1차 (naver settled · 이미 지급)
        done2Amount:    0,   // 받음 2차 (미정산 · 이미 지급 — 드묾)
        doneAmount:     0,   // = done1 + done2 (호환)
        itemCount:      0,
        pendingItemIds: [],   // 1차 + 2차 (미지급) item ids — B3 게이트 지급용
      };
    }
    const slot = map[key];
    const amt = calcItemEngineerAmount(it, engByItem);
    if (k === "first")  { slot.firstAmount  += amt; slot.pendingItemIds.push(it.id); }
    if (k === "second") { slot.secondAmount += amt; slot.pendingItemIds.push(it.id); }
    if (k === "done_1") { slot.done1Amount += amt; slot.doneAmount += amt; }
    if (k === "done_2") { slot.done2Amount += amt; slot.doneAmount += amt; }
    slot.itemCount += 1;
  }
  // 합계(total = 받음+예정+미확정) 내림차순
  return Object.values(map).sort((a, b) => {
    const at = a.doneAmount + a.firstAmount + a.secondAmount;
    const bt = b.doneAmount + b.firstAmount + b.secondAmount;
    return bt - at;
  });
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

  // 2026-06-01 reconcile fix — RPC 측 item별 engineer_amount 측측 (정책 측측).
  //   기사앱 EngineerApp.jsx line 4544 와 동일 호출 — 같은 RPC = 같은 금액.
  const [engByItem, setEngByItem] = useState(new Map());

  useEffect(() => {
    if (!items || items.length === 0) { setEngByItem(new Map()); return; }
    let alive = true;
    const taskIds = [...new Set(items.map(it => it.tasks?.id).filter(Boolean))];
    if (taskIds.length === 0) { setEngByItem(new Map()); return; }
    (async () => {
      const { data, error } = await supabase
        .rpc("compute_engineer_amount_per_item_batch", { p_task_ids: taskIds });
      if (!alive) return;
      if (error) {
        console.error("[UsolNToEngineerSection.engRpc]", error);
        return;
      }
      if (Array.isArray(data)) {
        setEngByItem(new Map(
          data.map(r => [r.task_item_id, Number(r.engineer_amount) || 0])
        ));
      }
    })();
    return () => { alive = false; };
  }, [items]);

  const [year, month] = selectedMonth.split("-").map(Number);

  // 2026-06-01 B3 — 세금계산서 / 게이트 지급 기준 ym = 한 달 전 (지급월 → 작업월).
  const gateYm = useMemo(() => {
    const prevDate = new Date(year, month - 2, 1);
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  }, [year, month]);
  const [gateYear, gateMonth] = useMemo(
    () => gateYm.split("-").map(Number),
    [gateYm]
  );

  // 2026-06-01 — bucketItem 가 gateYm 작업월 기준으로 동작 (naver_settled_at NULL/NOT NULL split).
  const split  = useMemo(
    () => splitByBucket(items, gateYear, gateMonth, engByItem),
    [items, gateYear, gateMonth, engByItem]
  );
  const byEng  = useMemo(
    () => groupItemsByEngineer(items, engineers, gateYear, gateMonth, engByItem),
    [items, engineers, gateYear, gateMonth, engByItem]
  );

  // 2026-06-01 S2 — 회사 순이익 (작업월 = gateYm 기준).
  //   순이익 = 회사 실입금 − 기사 지급 (1차 모집단만 = naver_settled NOT NULL).
  //   2차 (미정산) 는 회사 실입금 아직 없음 → 순이익 계산 제외.
  const companyNet = useMemo(
    () => computeCompanyNetIncome(items, gateYm),
    [items, gateYm]
  );
  const profit = companyNet.amount - split.naverConfirmed;

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
            gateYm={gateYm}
            split={split}
          />

          {/* 회사 순이익 카드 (작업월 = gateYm 기준) */}
          <CompanyProfitCard
            gateYm={gateYm}
            companyNet={companyNet}
            split={split}
            profit={profit}
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
//   year/month = 지급월 (selectedMonth, 1차 15일 · 2차 말일 date 라벨용)
//   gateYm     = 작업월 (title 표시용)
//   split.firstTotal  = "예정" (naver settled 미지급) — 진분홍 유지 (지급 cycle 의미)
//   split.secondTotal = "미확정" (미정산) — 회색
function MonthlyStackCard({ year, month, gateYm, split }) {
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
        {gateYm || `${year}년 ${month}월`} 작업 미지급 합계
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

// ── 회사 순이익 카드 (작업월 = gateYm 기준) ─────────────────
// 회사 실입금 − 기사 지급 = 순이익. (모두 작업월 기준).
// APR/MAY 는 시트 기준 상수 (legacy net_amount gross 오염). JUN+ 는 자동.
function CompanyProfitCard({ gateYm, companyNet, split, profit }) {
  if (!gateYm) return null;
  const isConstant = companyNet.source === "constant";
  const v = companyNet.validation;
  // naverConfirmed = 1차(예정) + done1(이미 지급, naver settled) — 회사 실입금 모집단 일치.
  const engineerPayFirst = split.naverConfirmed || 0;
  const engineerPaySecond = split.secondTotal || 0;
  const engineerReceived = split.doneTotal || 0;

  return (
    <div style={{
      padding: "14px 16px", marginTop: 10, marginBottom: 14,
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border)",
      borderRadius: 12,
    }}>
      <div style={{
        fontSize: 11, color: C_GRAY, fontWeight: 600, marginBottom: 8,
      }}>
        회사 순이익 · 작업월 {gateYm}
      </div>

      <ProfitRow label="회사 실입금" amount={companyNet.amount} sign="+"/>
      <ProfitRow label="기사 지급 (1차 — naver 정산 확정 모집단)" amount={engineerPayFirst} sign="−"/>

      <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }}/>

      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginTop: 4,
      }}>
        <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700 }}>
          순이익
        </span>
        <span style={{
          fontSize: 18, fontFamily: "inherit", fontWeight: 800,
          color: profit >= 0 ? C_GREEN : "#ff4444",
        }}>
          ₩{profit.toLocaleString()}
        </span>
      </div>

      {/* 출처 안내 */}
      <div style={{
        marginTop: 8, fontSize: 9, color: C_GRAY, lineHeight: 1.5,
      }}>
        {isConstant ? (
          <>ⓘ {gateYm} 회사 실입금 = 시트 기준 고정값 (legacy net_amount gross 오염).</>
        ) : (
          <>ⓘ {gateYm} 회사 실입금 = 신형식 net × 0.85 자동 합산.</>
        )}
      </div>

      {/* 2차 미정산 + 이미 지급 정보 (순이익 계산 제외) */}
      {(engineerPaySecond > 0 || engineerReceived > 0) && (
        <div style={{
          marginTop: 8, padding: "8px 10px",
          background: "rgba(156,163,175,0.06)",
          border: "1px dashed var(--border)",
          borderRadius: 6,
          fontSize: 10, color: C_GRAY, lineHeight: 1.6,
        }}>
          {engineerPaySecond > 0 && (
            <div>
              · 2차 미정산 기사 지급분: <span style={{ fontFamily: "inherit", fontWeight: 700, color: "var(--text-primary)" }}>
                ₩{engineerPaySecond.toLocaleString()}
              </span> — 회사 실입금이 아직 없음 → 순이익 계산 제외
            </div>
          )}
          {engineerReceived > 0 && (
            <div>
              · 받음 (이미 지급): <span style={{ fontFamily: "inherit", fontWeight: 700, color: C_GREEN }}>
                ₩{engineerReceived.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 6월+ 검증 — 신형식 / gross 의심 / NULL 카운트 */}
      {!isConstant && v && (
        <div style={{
          marginTop: 8, padding: "8px 10px",
          background: v.countGross > 0 ? "rgba(245,158,11,0.08)" : "rgba(29,158,117,0.06)",
          border: `1px solid ${v.countGross > 0 ? C_AMBER : C_GREEN}55`,
          borderRadius: 6,
          fontSize: 10, fontWeight: 600,
          color: v.countGross > 0 ? C_AMBER : C_GREEN,
        }}>
          {v.countGross > 0 ? "⚠️" : "✓"} 검증 — 활성 {v.countActive}건 ·
          신형식 {v.countTrue} / gross 의심 {v.countGross} / NULL {v.countNull}
          {v.countGross > 0 && (
            <div style={{ color: C_GRAY, fontWeight: 500, marginTop: 2 }}>
              gross 의심 (net == subtotal) 은 합산 제외. 데이터 검수 필요.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProfitRow({ label, amount, sign }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      padding: "3px 0", fontSize: 11,
    }}>
      <span style={{ color: C_GRAY, fontWeight: 600 }}>{label}</span>
      <span style={{
        color: "var(--text-primary)", fontFamily: "inherit", fontWeight: 700,
      }}>
        {sign}₩{(Number(amount) || 0).toLocaleString()}
      </span>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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

// 색 규칙 (R-A3 fix + S2.5 시안):
//   · 합계 — 기본색 (primary), 큰 숫자.
//   · 막대 (S2.5) — 진분홍 (1차 #D4537E) + 연분홍 (2차 #F8CDD9). 길이 = 총액 / maxTotal.
//   · 1차 / 2차 텍스트 — 작은 회색 라벨.
// 2026-06-01 B3:
//   · 세금계산서 상태 뱃지 (미발행 / 발행함·확인 필요 / 확인 완료).
//   · [확인] 버튼 (발행함·미확인 시) → confirmTaxInvoice.
//   · [지급] 버튼 (게이트) — confirmed_at 있을 때만 활성. pending 항목만 마킹.
//   · [확인 취소] secondary (확인됨 시 옆에) → unconfirmTaxInvoice.
function EngineerRow({ row, invoice, invoiceLoading, gateYm, adminId, onRefresh }) {
  const [busy, setBusy] = useState(false);

  // 2026-06-01 — 3단계 (받음/예정/미확정) 미러링.
  //   total = 받음 + 예정 + 미확정 (전체 모집단, 막대 길이용).
  //   pending = 예정 + 미확정 (미지급, 게이트 지급 대상).
  const received = row.doneAmount   || 0;   // 받음
  const scheduled = row.firstAmount || 0;   // 예정 (naver settled, 미지급)
  const uncertain = row.secondAmount || 0;  // 미확정 (미정산)
  const total   = received + scheduled + uncertain;
  const pending = scheduled + uncertain;
  const isAllDone = pending === 0 && received > 0;
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
      `예정 ₩${scheduled.toLocaleString()} + 미확정 ₩${uncertain.toLocaleString()}\n` +
      `= 총 ₩${pending.toLocaleString()}`
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
        marginBottom: 6,
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

      {/* 2행 — 가로 막대 (3색: 받음 초록 / 예정 주황 / 미확정 회색) — 항상 100% 채움 */}
      <EngineerBar
        received={received}
        scheduled={scheduled}
        uncertain={uncertain}
        total={total}
      />

      {/* 3행 — 받음/예정/미확정 라벨 (작게, 색 dot + 회색 텍스트) */}
      <div style={{
        marginTop: 6,
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4,
        fontSize: 10, color: C_GRAY,
      }}>
        <BucketLabel
          color={C_BUCKET_RECEIVED}
          label="받음"
          amount={received}
        />
        <BucketLabel
          color={C_BUCKET_SCHEDULED}
          label="예정"
          amount={scheduled}
        />
        <BucketLabel
          color={C_BUCKET_UNCERTAIN}
          label="미확정"
          amount={uncertain}
        />
      </div>

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

// ── 기사별 가로 막대 (3색 — 기사앱 정산 카드 미러링) ─────────
// 길이 = 항상 100% (행 간 상대 비교 X). 내부: 받음(초록) / 예정(주황) / 미확정(회색).
// 기사앱 prev月 정산 카드와 동일 — 측 행 내 자기 total 대비 비율만.
function EngineerBar({ received, scheduled, uncertain, total }) {
  const trackHeight = 9;
  const trackBg = "rgba(255,255,255,0.05)";

  if (!total || total <= 0) {
    return (
      <div style={{
        width: "100%", height: trackHeight, borderRadius: trackHeight / 2,
        background: trackBg,
      }}/>
    );
  }

  const rPct = (received  / total) * 100;
  const sPct = (scheduled / total) * 100;
  const uPct = (uncertain / total) * 100;

  return (
    <div style={{
      width: "100%", height: trackHeight, borderRadius: trackHeight / 2,
      background: trackBg, overflow: "hidden",
      display: "flex",
    }}>
      {rPct > 0 && <div style={{ width: `${rPct}%`, height: "100%", background: C_BUCKET_RECEIVED  }}/>}
      {sPct > 0 && <div style={{ width: `${sPct}%`, height: "100%", background: C_BUCKET_SCHEDULED }}/>}
      {uPct > 0 && <div style={{ width: `${uPct}%`, height: "100%", background: C_BUCKET_UNCERTAIN }}/>}
    </div>
  );
}

// ── 받음/예정/미확정 라벨 (작은 dot + 텍스트) ────────────────
function BucketLabel({ color, label, amount }) {
  const isZero = !amount || amount <= 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
      <span style={{
        width: 6, height: 6, borderRadius: 1, background: color,
        display: "inline-block", flexShrink: 0,
        opacity: isZero ? 0.3 : 1,
      }}/>
      <span style={{ color: isZero ? "var(--text-tertiary)" : C_GRAY, whiteSpace: "nowrap" }}>
        {label}{" "}
        <span style={{
          fontFamily: "inherit", fontWeight: 700,
          color: isZero ? "var(--text-tertiary)" : color,
        }}>
          ₩{(amount || 0).toLocaleString()}
        </span>
      </span>
    </span>
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
