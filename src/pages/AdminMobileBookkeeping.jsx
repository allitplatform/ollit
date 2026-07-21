// 2026-07-21 — 모바일 가계부·통장 재설계 (🅒 대시보드형, 사장님 확정).
//
// 사장님 spec (2026-07-21):
//   · 가계부 탭: 순이익 대문짝 히어로(그라데이션) + 현금 2칸 + 수입/운영비 구성 막대 + 분배 게이지.
//   · 통장 탭: 마감잔고 히어로 + 버튼 3개 (입금/출금/🧾지출) + 거래 리스트 항상 표시 (자동/수동/운영비 칩).
//   · 🧾 지출 = 운영비(bookkeeping_expenses) 저장 → Mig 185 트리거가 통장 자동 반영 (모바일 지출 입력 구멍 해소).
//   · 자동 행(auto_*)은 편집/삭제 버튼 없음 — 실수 방지. 수동(manual)만 ✏️/🗑.
//   · 기준잔고(baseline) 문구 제거 (값은 내부 유지 — 2026-07-21 은행정합 42,118,374 보호).
//
// 계산 로직·RPC 는 PC 와 100% 동일 (재사용). UI 만 모바일 전용.
// ⚠️ CLAUDE.md 금지 어근 자가 검사 통과 의무.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Wallet, Plus, Minus, Receipt, Edit3, Trash2, X, Save } from "lucide-react";
import {
  listExpenses, addExpense, listDistributions,
  getUsolNTrackBMargin, getCumulativeCarryover,
  EXPENSE_CATEGORIES, EXPENSE_CATEGORY_KO,
} from "../lib/bookkeepingDb.js";
import { listOtherIncome } from "../lib/bookkeepingOtherIncomeDb.js";
import { getUsolnAdjustment } from "../lib/bookkeepingUsolnAdjustmentDb.js";
import {
  getCashflowSummary, listCashflow, addCashflow, updateCashflow, deleteCashflow,
  getCashflowDayClose, fetchTaskNoMap,
} from "../lib/bookkeepingCashflowDb.js";
// 2026-06-29 — PC 통합본과 동일: 현금/천장 산출용 정산판 요약 RPC. 산식 변경 0건.
import { getUsolnSettleBoardSummary } from "../lib/usolnSettleBoardDb.js";
import {
  computeRevenueByYmRange,
  getMonthRange,
} from "../utils/revenueStats.js";

// ────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────
function kstYmd(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}
function nowKstYm() { return kstYmd().slice(0, 7); }
function shiftYm(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const total = (y * 12) + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
function shiftYmd(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m||1)-1, d||1);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
const KO_DOW_M = ["일","월","화","수","목","금","토"];
function ymdToDow(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m||1)-1, d||1);
  return isNaN(dt.getTime()) ? "" : KO_DOW_M[dt.getDay()];
}
function ymdToYm(ymd) { return (ymd || "").slice(0, 7); }
const fmtKRW = n => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
function fmtAmountInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}
function parseAmount(s) {
  return Number(String(s || "").replace(/\D/g, "")) || 0;
}
// 음수 처리 포맷 — "− ₩x"
function fmtMoney(n) {
  const v = Number(n) || 0;
  if (v < 0) return `− ₩${Math.abs(v).toLocaleString("ko-KR")}`;
  return `₩${v.toLocaleString("ko-KR")}`;
}
// 범례용 압축 표기 — 6.2M / 340K
function fmtCompact(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1000000) return `${(v / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1000)    return `${Math.round(v / 1000)}K`;
  return String(v);
}

// 운영비 카테고리 색 (구성 막대·범례 공용)
const EXPENSE_CAT_COLORS = {
  ad:    "#FF1B8D",
  tax:   "#8B5CF6",
  labor: "#FBBF24",
  meal:  "#60A5FA",
  rent:  "#2BB673",
  etc:   "#5C6470",
};

// 통장 source → 칩 라벨 (편집 가능 여부 포함)
function sourceChip(source) {
  switch (source) {
    case "auto_engineer_remit":     return { label: "자동·일정산", kind: "auto" };
    case "auto_usoln_remit":        return { label: "자동·유솔",   kind: "auto" };
    case "auto_principal_payout":   return { label: "자동·원청",   kind: "auto" };
    case "auto_principal_passthru": return { label: "자동·수수료", kind: "auto" };
    case "auto_expense":            return { label: "운영비",      kind: "expense" };
    default:                        return { label: "수동",        kind: "manual" };
  }
}

// ────────────────────────────────────────────
// 본체
// ────────────────────────────────────────────
export default function AdminMobileBookkeeping({ t, user, apiTasks = [], onBack }) {
  const todayYmd = kstYmd();
  const [selectedYm, setSelectedYm] = useState(nowKstYm());
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  // 'bookkeeping'(가계부) | 'cashflow'(통장)
  const [view, setView] = useState("bookkeeping");
  const actor = user?.user_id || user?.userId || user?.id;
  const isThisMonth = selectedYm === nowKstYm();
  const isToday = selectedDate === todayYmd;
  const dayDow = ymdToDow(selectedDate);

  // 통장 view 진입 시 selectedYm 을 selectedDate 의 월로 동기
  useEffect(() => {
    if (view !== "cashflow") return;
    const ymOfDate = ymdToYm(selectedDate);
    if (ymOfDate && ymOfDate !== selectedYm) setSelectedYm(ymOfDate);
  }, [view, selectedDate, selectedYm]);

  // ── 일정산 (track A owner) — 클라 계산
  const monthRange = useMemo(() => {
    const [y, m] = selectedYm.split("-").map(Number);
    return getMonthRange(y, m);
  }, [selectedYm]);
  const revenueStat = useMemo(
    () => computeRevenueByYmRange(apiTasks, monthRange.start, monthRange.end, user),
    [apiTasks, monthRange.start, monthRange.end, user]
  );
  const incomeTrackA = Number(revenueStat?.owner) || 0;

  // ── 유솔N 자동 (track B, Mig 123)
  const [usolNB, setUsolNB] = useState(0);
  useEffect(() => {
    if (!actor) { setUsolNB(0); return; }
    let alive = true;
    (async () => {
      const res = await getUsolNTrackBMargin(selectedYm, actor);
      if (alive) setUsolNB(res?.ok ? (Number(res.amount) || 0) : 0);
    })().catch(() => { if (alive) setUsolNB(0); });
    return () => { alive = false; };
  }, [selectedYm, actor]);

  // ── 유솔N 보정 (Mig 127/128)
  const [usolNAdj, setUsolNAdj] = useState(0);
  useEffect(() => {
    if (!actor) { setUsolNAdj(0); return; }
    let alive = true;
    (async () => {
      const res = await getUsolnAdjustment(selectedYm, actor);
      if (alive) setUsolNAdj(res?.ok && res.row ? (Number(res.row.amount) || 0) : 0);
    })().catch(() => { if (alive) setUsolNAdj(0); });
    return () => { alive = false; };
  }, [selectedYm, actor]);
  const usolNTotal = usolNB + usolNAdj;

  // ── 기타 수입
  const [otherIncomeSum, setOtherIncomeSum] = useState(0);
  useEffect(() => {
    if (!actor) { setOtherIncomeSum(0); return; }
    let alive = true;
    (async () => {
      const res = await listOtherIncome(selectedYm, actor);
      if (!alive) return;
      const sum = (res?.rows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      setOtherIncomeSum(sum);
    })().catch(() => { if (alive) setOtherIncomeSum(0); });
    return () => { alive = false; };
  }, [selectedYm, actor]);

  // ── 운영비 — 2026-07-21: rows 보관 (카테고리 구성 막대용). 합산 로직 동일.
  const [expenseRows, setExpenseRows] = useState([]);
  const [expReloadTick, setExpReloadTick] = useState(0);   // 모바일 지출 추가 시 ++
  useEffect(() => {
    if (!actor) { setExpenseRows([]); return; }
    let alive = true;
    (async () => {
      const res = await listExpenses(selectedYm, actor);
      if (!alive) return;
      setExpenseRows(res?.ok ? (res.rows || []) : []);
    })().catch(() => { if (alive) setExpenseRows([]); });
    return () => { alive = false; };
  }, [selectedYm, actor, expReloadTick]);
  const expenseSum = useMemo(
    () => expenseRows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [expenseRows]
  );
  const expenseByCat = useMemo(() => {
    const map = {};
    for (const r of expenseRows) {
      const c = EXPENSE_CATEGORIES.includes(r.category) ? r.category : "etc";
      map[c] = (map[c] || 0) + (Number(r.amount) || 0);
    }
    return map;
  }, [expenseRows]);

  // ── 분배
  const [distSum, setDistSum] = useState(0);
  useEffect(() => {
    if (!actor) { setDistSum(0); return; }
    let alive = true;
    (async () => {
      const res = await listDistributions(selectedYm, actor);
      if (!alive) return;
      const sum = (res?.rows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      setDistSum(sum);
    })().catch(() => { if (alive) setDistSum(0); });
    return () => { alive = false; };
  }, [selectedYm, actor]);

  // ── 누적 이월 (Mig 129)
  const [cum, setCum] = useState({ cumulative_carryover: 0, start_month: "2026-04" });
  const [cumLoading, setCumLoading] = useState(false);
  useEffect(() => {
    if (!actor) return;
    let alive = true;
    setCumLoading(true);
    (async () => {
      const res = await getCumulativeCarryover(selectedYm, actor);
      if (!alive) return;
      if (res?.ok) {
        setCum({
          cumulative_carryover: Number(res.cumulative_carryover) || 0,
          start_month: res.start_month || "2026-04",
        });
      }
      setCumLoading(false);
    })().catch(() => { if (alive) setCumLoading(false); });
    return () => { alive = false; };
  }, [selectedYm, actor]);

  // ── 통장 요약 (Mig 122) + 거래 목록
  const [cashflow, setCashflow] = useState({ month_in: 0, month_out: 0, current_balance: 0 });
  const [cashflowLoading, setCashflowLoading] = useState(false);
  const [cashflowRows, setCashflowRows] = useState([]);
  const [cashflowListLoading, setCashflowListLoading] = useState(false);
  const [cfReloadTick, setCfReloadTick] = useState(0);
  const [cfDialog, setCfDialog] = useState(null);   // { mode:'add'|'edit'|'delete'|'expense', direction?, row? }
  const [dayClose, setDayClose] = useState({ day_in: 0, day_out: 0, day_close_balance: 0 });
  const [taskNoMap, setTaskNoMap] = useState({});
  useEffect(() => {
    if (!actor) return;
    let alive = true;
    setCashflowLoading(true);
    setCashflowListLoading(true);
    (async () => {
      const [resSum, resList, resDay] = await Promise.all([
        getCashflowSummary(selectedYm, actor),
        listCashflow(selectedYm, actor),
        getCashflowDayClose(selectedDate, actor),
      ]);
      if (!alive) return;
      if (resSum?.ok) {
        setCashflow({
          month_in:        Number(resSum.month_in)        || 0,
          month_out:       Number(resSum.month_out)       || 0,
          current_balance: Number(resSum.current_balance) || 0,
        });
      }
      setCashflowRows(resList?.ok ? (resList.rows || []) : []);
      if (resDay?.ok) {
        setDayClose({
          day_in:            Number(resDay.day_in)            || 0,
          day_out:           Number(resDay.day_out)           || 0,
          day_close_balance: Number(resDay.day_close_balance) || 0,
        });
      }
      setCashflowLoading(false);
      setCashflowListLoading(false);
    })().catch(() => {
      if (alive) { setCashflowLoading(false); setCashflowListLoading(false); }
    });
    return () => { alive = false; };
  }, [selectedYm, selectedDate, actor, cfReloadTick]);

  // 그날 거래만 filter
  const dayRows = useMemo(
    () => (cashflowRows || []).filter(r => r.flow_date === selectedDate),
    [cashflowRows, selectedDate]
  );

  // auto_engineer_remit 행의 task_no 조회
  useEffect(() => {
    if (!actor) return;
    const ids = dayRows
      .filter(r => r.source === "auto_engineer_remit" && r.source_ref)
      .map(r => r.source_ref);
    if (ids.length === 0) { setTaskNoMap({}); return; }
    let alive = true;
    (async () => {
      const map = await fetchTaskNoMap(ids);
      if (alive) setTaskNoMap(map);
    })().catch(() => { /* 무시 */ });
    return () => { alive = false; };
  }, [dayRows, actor]);

  // ── 합산 계산 (기존 산식 그대로)
  const incomeTotal = incomeTrackA + usolNTotal + otherIncomeSum;
  const netProfit   = incomeTotal - expenseSum;
  const monthlyDiff = netProfit - distSum;
  const cumValue    = Number(cum.cumulative_carryover) || 0;

  // ── 현금 / 천장 (PC 통합본과 동일 산식)
  const [boardSummary, setBoardSummary] = useState({ months: [], start_month: "2026-04" });
  useEffect(() => {
    if (!actor) return;
    let alive = true;
    (async () => {
      const res = await getUsolnSettleBoardSummary(actor);
      if (!alive) return;
      if (res?.ok) {
        setBoardSummary({
          months: res.months || [],
          start_month: res.start_month || "2026-04",
        });
      }
    })().catch(() => { /* 실패 시 0 표시 */ });
    return () => { alive = false; };
  }, [actor]);
  const totalBEngOwed = useMemo(
    () => (boardSummary.months || []).reduce((s, m) => s + (Number(m.b_eng_owed) || 0), 0),
    [boardSummary.months]
  );
  const cashNow = (Number(cashflow.current_balance) || 0) - totalBEngOwed;
  const prevYm = shiftYm(selectedYm, -1);
  const prevMonthBoard = useMemo(
    () => (boardSummary.months || []).find(m => m.wm === prevYm) || null,
    [boardSummary.months, prevYm]
  );
  const ceiling = cashNow + (Number(prevMonthBoard?.c1_margin) || 0) + (Number(prevMonthBoard?.c2_margin) || 0);

  return (
    <div style={{ padding: "12px 14px 24px" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {onBack && (
          <button onClick={onBack} aria-label="뒤로" style={navBtn(t)}>
            <ArrowLeft size={16}/>
          </button>
        )}
        <Wallet size={18} style={{ color: t.accent }}/>
        <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
          {view === "bookkeeping" ? "가계부" : "통장"}
        </div>
        <div style={{ flex: 1 }}/>
      </div>

      {/* 토글 — [가계부] [통장] */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
        padding: 4, marginBottom: 10,
        background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 10,
      }}>
        {[
          { key: "bookkeeping", label: "📊 가계부" },
          { key: "cashflow",    label: "💳 통장" },
        ].map(seg => {
          const active = view === seg.key;
          return (
            <button key={seg.key} onClick={() => setView(seg.key)} style={{
              padding: "9px 8px",
              background: active ? t.bgElevated : "transparent",
              border: active ? `1.5px solid ${t.accent}` : `1px solid transparent`,
              borderRadius: 7, fontSize: 12, fontWeight: 800,
              color: active ? t.text : t.textMuted,
              cursor: "pointer", fontFamily: "inherit",
            }}>{seg.label}</button>
          );
        })}
      </div>

      {/* 네비게이터 — bookkeeping=월 / cashflow=일 */}
      {view === "bookkeeping" ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 10px", marginBottom: 12,
          background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10,
        }}>
          <button onClick={() => setSelectedYm(s => shiftYm(s, -1))} aria-label="이전 달" style={navBtn(t)}>
            <ChevronLeft size={14}/>
          </button>
          <div style={{
            flex: 1,
            padding: "6px 10px", background: t.bgInset, border: `1.5px solid ${t.accent}`,
            borderRadius: 7, fontSize: 13, fontWeight: 800, color: t.text, textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}>
            {selectedYm.slice(0, 4)}년 {Number(selectedYm.slice(5, 7))}월
          </div>
          <button onClick={() => setSelectedYm(s => shiftYm(s, +1))} aria-label="다음 달" style={navBtn(t)}>
            <ChevronRight size={14}/>
          </button>
          <button onClick={() => setSelectedYm(nowKstYm())} disabled={isThisMonth} style={{
            padding: "6px 10px",
            background: isThisMonth ? "transparent" : (t.accentBg || "rgba(0,123,255,0.1)"),
            border: `1px solid ${isThisMonth ? t.border : t.accent}`,
            borderRadius: 7, fontSize: 10, fontWeight: 700,
            color: isThisMonth ? t.textMuted : t.accent,
            cursor: isThisMonth ? "default" : "pointer", fontFamily: "inherit",
            opacity: isThisMonth ? 0.6 : 1,
          }}>
            이번달
          </button>
        </div>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 10px", marginBottom: 12,
          background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10,
        }}>
          <button onClick={() => setSelectedDate(s => shiftYmd(s, -1))} aria-label="이전 날" style={navBtn(t)}>
            <ChevronLeft size={14}/>
          </button>
          <label style={{
            flex: 1, position: "relative",
            padding: "6px 10px", background: t.bgInset, border: `1.5px solid ${t.accent}`,
            borderRadius: 7, fontSize: 13, fontWeight: 800, color: t.text, textAlign: "center",
            fontVariantNumeric: "tabular-nums",
            cursor: "pointer",
          }}>
            {selectedDate}{dayDow ? ` (${dayDow})` : ""}
            <input type="date" value={selectedDate}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              style={{
                position: "absolute", inset: 0, opacity: 0, cursor: "pointer",
                border: "none", background: "transparent", padding: 0,
              }}/>
          </label>
          <button onClick={() => setSelectedDate(s => shiftYmd(s, +1))} aria-label="다음 날" style={navBtn(t)}>
            <ChevronRight size={14}/>
          </button>
          <button onClick={() => setSelectedDate(todayYmd)} disabled={isToday} style={{
            padding: "6px 10px",
            background: isToday ? "transparent" : (t.accentBg || "rgba(0,123,255,0.1)"),
            border: `1px solid ${isToday ? t.border : t.accent}`,
            borderRadius: 7, fontSize: 10, fontWeight: 700,
            color: isToday ? t.textMuted : t.accent,
            cursor: isToday ? "default" : "pointer", fontFamily: "inherit",
            opacity: isToday ? 0.6 : 1,
          }}>
            오늘
          </button>
        </div>
      )}

      {/* ═══ 가계부 view — 🅒 대시보드형 (2026-07-21) ═══ */}
      {view === "bookkeeping" && <>

      {/* ① 순이익 히어로 — 그라데이션 + 번 돈/쓴 돈 요약 */}
      <div style={{
        background: `linear-gradient(135deg, ${t.accent}29, #8B5CF61A)`,
        border: `0.5px solid ${t.accent}`,
        borderRadius: 14,
        padding: "18px 14px 15px",
        textAlign: "center",
        marginBottom: 8,
      }}>
        <div style={{ fontSize: 12, fontWeight: 400, color: t.accent, letterSpacing: "-0.2px" }}>
          이번 달 순이익
        </div>
        <div style={{
          marginTop: 5,
          fontSize: 32, fontWeight: 600,
          color: netProfit < 0 ? t.danger : t.accent,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-1px", lineHeight: 1.1,
        }}>{fmtMoney(netProfit)}</div>
        <div style={{
          display: "flex", justifyContent: "center", gap: 16,
          marginTop: 8, fontSize: 11, fontWeight: 500,
          fontVariantNumeric: "tabular-nums", letterSpacing: "-0.2px",
        }}>
          <span style={{ color: t.success }}>번 돈 +{fmtCompact(incomeTotal)}</span>
          <span style={{ color: t.danger }}>쓴 돈 −{fmtCompact(expenseSum)}</span>
        </div>
      </div>

      {/* ② 현금 2칸 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div style={{
          background: t.bgElevated, border: `0.5px solid ${t.border}`,
          borderRadius: 12, padding: "11px 12px", textAlign: "center",
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: t.success }}>지금 현금</div>
          <div style={{
            marginTop: 4, fontSize: 17, fontWeight: 600,
            color: cashNow < 0 ? t.danger : t.success,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{fmtMoney(cashNow)}</div>
          <div style={{ marginTop: 3, fontSize: 9, color: t.textMuted }}>통장 − 기사 줄 돈</div>
        </div>
        <div style={{
          background: t.bgElevated, border: `0.5px solid ${t.border}`,
          borderRadius: 12, padding: "11px 12px", textAlign: "center",
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: t.accent }}>나눠도 됨</div>
          <div style={{
            marginTop: 4, fontSize: 17, fontWeight: 600,
            color: ceiling < 0 ? t.danger : t.accent,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{fmtMoney(ceiling)}</div>
          <div style={{ marginTop: 3, fontSize: 9, color: t.textMuted }}>분배 천장</div>
        </div>
      </div>

      {/* ③ 수입 구성 + 운영비 구성 — 막대 */}
      <div style={{
        background: t.bgElevated, border: `0.5px solid ${t.border}`,
        borderRadius: 12, padding: "12px 13px", marginBottom: 8,
      }}>
        <CompositionBar t={t}
          title="수입 구성" total={incomeTotal} totalColor={t.text}
          parts={[
            { label: "일정산", value: incomeTrackA,   color: "#2BB673" },
            { label: "유솔N",  value: usolNTotal,     color: "#60A5FA" },
            { label: "기타",   value: otherIncomeSum, color: "#8B5CF6" },
          ]}
        />
        <div style={{ height: 12 }}/>
        <CompositionBar t={t}
          title="운영비 구성" total={expenseSum} totalColor={t.danger} totalPrefix="− "
          parts={EXPENSE_CATEGORIES
            .map(c => ({
              label: EXPENSE_CATEGORY_KO[c] || c,
              value: expenseByCat[c] || 0,
              color: EXPENSE_CAT_COLORS[c] || "#5C6470",
            }))
            .filter(p => p.value > 0)}
        />
      </div>

      {/* ④ 분배 게이지 + 남은 것 + 누적 */}
      <div style={{
        background: t.bgElevated, border: `0.5px solid ${t.border}`,
        borderRadius: 12, padding: "12px 13px",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: t.textSecondary }}>분배</span>
          <span style={{
            marginLeft: "auto", fontSize: 14, fontWeight: 600, color: t.text,
            fontVariantNumeric: "tabular-nums",
          }}>{fmtMoney(distSum)}</span>
          <span style={{ fontSize: 9.5, color: t.textMuted, fontVariantNumeric: "tabular-nums" }}>
            / 천장 {fmtCompact(ceiling)}
          </span>
        </div>
        <div style={{
          height: 9, borderRadius: 999, background: t.bgInset,
          overflow: "hidden", marginTop: 8,
        }}>
          <div style={{
            height: "100%", borderRadius: 999, background: "#FBBF24",
            width: `${ceiling > 0 ? Math.min(100, Math.round((distSum / ceiling) * 100)) : 0}%`,
          }}/>
        </div>
        <div style={{
          marginTop: 10, textAlign: "center",
          fontSize: 11, fontWeight: 600,
          color: monthlyDiff < 0 ? t.danger : t.success,
          fontVariantNumeric: "tabular-nums", letterSpacing: "-0.2px",
        }}>
          회사에 남은 것 {fmtMoney(monthlyDiff)}
          <span style={{ color: t.textMuted, fontWeight: 400 }}>
            {"  ·  "}📦 누적 {cumLoading ? "…" : fmtMoney(cumValue)}
          </span>
        </div>
      </div>

      {/* 안내 — 분배·기타 수입은 PC (운영비는 통장 탭 🧾 지출로 모바일 입력 가능) */}
      <div style={{
        marginTop: 10,
        padding: "9px 12px",
        background: t.bgInset, border: `1px dashed ${t.border}`,
        borderRadius: 10,
        fontSize: 10.5, color: t.textSecondary, textAlign: "center", lineHeight: 1.5,
      }}>
        ✏️ 지출 입력은 통장 탭의 🧾 지출 버튼 · 분배/기타 수입은 PC 가계부에서
      </div>

      </>}

      {/* ═══ 통장 view — 3버튼 + 리스트 상시 표시 (2026-07-21) ═══ */}
      {view === "cashflow" && <>

      {/* 마감 잔고 히어로 + 그날 in/out + 버튼 3개 */}
      <div style={{
        background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
        padding: "14px 13px", marginBottom: 8, textAlign: "center",
      }}>
        {cashflowLoading ? (
          <span style={{ fontSize: 12, color: t.textMuted }}>불러오는 중...</span>
        ) : (
          <span className="mono" style={{
            fontSize: 26, fontWeight: 800,
            color: dayClose.day_close_balance < 0 ? t.danger : t.text,
            fontVariantNumeric: "tabular-nums",
          }}>
            {dayClose.day_close_balance < 0 ? "−" : ""}{fmtKRW(Math.abs(dayClose.day_close_balance))}
          </span>
        )}
        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>마감 잔고</div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1, background: t.bgInset, borderRadius: 8, padding: "7px 6px" }}>
            <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700 }}>들어온 돈</div>
            <div className="mono" style={{
              fontSize: 13, fontWeight: 800, color: t.success,
              fontVariantNumeric: "tabular-nums", marginTop: 2,
            }}>+{fmtKRW(dayClose.day_in)}</div>
          </div>
          <div style={{ flex: 1, background: t.bgInset, borderRadius: 8, padding: "7px 6px" }}>
            <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700 }}>나간 돈</div>
            <div className="mono" style={{
              fontSize: 13, fontWeight: 800, color: t.danger,
              fontVariantNumeric: "tabular-nums", marginTop: 2,
            }}>−{fmtKRW(dayClose.day_out)}</div>
          </div>
        </div>

        {/* 버튼 3개 — 입금 / 출금 / 지출 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
          <button onClick={() => setCfDialog({ mode: "add", direction: "in", row: null })} style={{
            padding: "10px 4px",
            background: t.success, color: "#fff", border: "none", borderRadius: 9,
            fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3,
          }}>
            <Plus size={13} strokeWidth={2.8}/>입금
          </button>
          <button onClick={() => setCfDialog({ mode: "add", direction: "out", row: null })} style={{
            padding: "10px 4px",
            background: t.danger, color: "#fff", border: "none", borderRadius: 9,
            fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3,
          }}>
            <Minus size={13} strokeWidth={2.8}/>출금
          </button>
          <button onClick={() => setCfDialog({ mode: "expense" })} style={{
            padding: "10px 4px",
            background: "#FBBF24", color: "#1A1A1A", border: "none", borderRadius: 9,
            fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3,
          }}>
            <Receipt size={13} strokeWidth={2.6}/>지출
          </button>
        </div>
      </div>

      {/* 그날 거래 — 상시 표시 */}
      <div style={{
        fontSize: 10.5, fontWeight: 800, color: t.textSecondary,
        margin: "2px 2px 6px",
      }}>
        이날 거래 {dayRows.length}건
      </div>
      {cashflowListLoading ? (
        <div style={{ padding: "12px", textAlign: "center", color: t.textMuted, fontSize: 11 }}>
          불러오는 중...
        </div>
      ) : dayRows.length === 0 ? (
        <div style={{
          padding: "16px 12px", textAlign: "center",
          background: t.bgElevated, border: `1px dashed ${t.border}`, borderRadius: 10,
          color: t.textMuted, fontSize: 11,
        }}>
          이 날짜엔 거래가 없어요
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {dayRows.map(r => (
            <CashflowMobileRow key={r.id} t={t} row={r}
              taskNo={taskNoMap[r.source_ref] || ""}
              onEdit={() => setCfDialog({ mode: "edit", direction: r.direction, row: r })}
              onDelete={() => setCfDialog({ mode: "delete", row: r })}
            />
          ))}
        </div>
      )}

      </>}

      {/* ═══ 다이얼로그 ═══ */}
      {cfDialog?.mode === "add" && (
        <CashflowDialog t={t} mode="add"
          actor={actor}
          direction={cfDialog.direction}
          defaultDate={selectedDate}
          onClose={() => setCfDialog(null)}
          onSaved={() => { setCfDialog(null); setCfReloadTick(n => n + 1); }}
        />
      )}
      {cfDialog?.mode === "edit" && (
        <CashflowDialog t={t} mode="edit"
          actor={actor}
          direction={cfDialog.direction}
          row={cfDialog.row}
          defaultDate={cfDialog.row.flow_date}
          onClose={() => setCfDialog(null)}
          onSaved={() => { setCfDialog(null); setCfReloadTick(n => n + 1); }}
        />
      )}
      {cfDialog?.mode === "delete" && (
        <CashflowDeleteDialog t={t} actor={actor} row={cfDialog.row}
          onClose={() => setCfDialog(null)}
          onDeleted={() => { setCfDialog(null); setCfReloadTick(n => n + 1); }}
        />
      )}
      {cfDialog?.mode === "expense" && (
        <ExpenseDialog t={t} actor={actor}
          defaultDate={view === "cashflow" ? selectedDate : kstYmd()}
          onClose={() => setCfDialog(null)}
          onSaved={() => {
            setCfDialog(null);
            // 통장(자동 미러) + 운영비 양쪽 갱신
            setCfReloadTick(n => n + 1);
            setExpReloadTick(n => n + 1);
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// 구성 막대 (수입/운영비 공용) — 표시 전용
// ────────────────────────────────────────────
function CompositionBar({ t, title, total, totalColor, totalPrefix = "", parts }) {
  const sum = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: t.textSecondary }}>{title}</span>
        <span style={{
          marginLeft: "auto", fontSize: 12, fontWeight: 600, color: totalColor,
          fontVariantNumeric: "tabular-nums",
        }}>{totalPrefix}{fmtKRW(total)}</span>
      </div>
      <div style={{
        display: "flex", height: 8, borderRadius: 999, overflow: "hidden",
        background: t.bgInset, marginTop: 7,
      }}>
        {sum > 0 && parts.map((p, i) => (
          <div key={i} style={{
            width: `${(p.value / sum) * 100}%`,
            background: p.color, height: "100%",
          }}/>
        ))}
      </div>
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "4px 10px", marginTop: 6,
        fontSize: 9.5, color: t.textSecondary, fontVariantNumeric: "tabular-nums",
      }}>
        {parts.map((p, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: p.color, display: "inline-block" }}/>
            {p.label} {fmtCompact(p.value)}
          </span>
        ))}
        {sum === 0 && <span style={{ color: t.textMuted }}>이번 달 내역 없음</span>}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// 작은 부품들
// ────────────────────────────────────────────
function navBtn(t) {
  return {
    background: "transparent", border: `1px solid ${t.border}`,
    borderRadius: 7, padding: "6px 7px",
    color: t.text, cursor: "pointer", display: "flex",
    fontFamily: "inherit",
  };
}

// ────────────────────────────────────────────
// 통장 거래 행 — 칩 구분 + 자동 행 편집 잠금 (2026-07-21)
// ────────────────────────────────────────────
function CashflowMobileRow({ t, row, taskNo, onEdit, onDelete }) {
  const isIn = row.direction === "in";
  const chip = sourceChip(row.source);
  const editable = chip.kind === "manual";
  const chipStyle = {
    auto:    { background: t.bgInset,               color: t.textMuted },
    expense: { background: "rgba(251,191,36,0.12)", color: "#FBBF24" },
    manual:  { background: t.accentBg || "rgba(255,27,141,0.1)", color: t.accent },
  }[chip.kind];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7,
      padding: "8px 9px",
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 9,
    }}>
      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <span className="mono" style={{
          fontSize: 12.5, fontWeight: 800,
          color: isIn ? t.success : t.danger,
          fontVariantNumeric: "tabular-nums",
        }}>
          {isIn ? "+" : "−"}{fmtKRW(row.amount)}
        </span>
        <span style={{
          fontSize: 10, color: t.textSecondary,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {row.memo || "—"}{taskNo ? ` · ${taskNo}` : ""}
        </span>
      </div>
      <span style={{
        fontSize: 8.5, fontWeight: 800, borderRadius: 999, padding: "2px 7px",
        flexShrink: 0, ...chipStyle,
      }}>{chip.label}</span>
      {editable && (
        <>
          <button onClick={onEdit} title="편집" style={iconBtnSm(t)}>
            <Edit3 size={11}/>
          </button>
          <button onClick={onDelete} title="삭제" style={{ ...iconBtnSm(t), color: t.danger }}>
            <Trash2 size={11}/>
          </button>
        </>
      )}
    </div>
  );
}

function iconBtnSm(t) {
  return {
    padding: "4px 5px",
    background: "transparent", border: `1px solid ${t.border}`,
    color: t.textSecondary, borderRadius: 5,
    cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontFamily: "inherit", flexShrink: 0,
  };
}

// ────────────────────────────────────────────
// 통장 거래 추가/편집 다이얼로그
// ────────────────────────────────────────────
function CashflowDialog({ t, mode, actor, direction, row, defaultDate, onClose, onSaved }) {
  const [amountStr, setAmountStr] = useState(row?.amount != null ? Number(row.amount).toLocaleString("ko-KR") : "");
  const [date, setDate]           = useState(row?.flow_date || defaultDate);
  const [memo, setMemo]           = useState(row?.memo || "");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");

  const amount = parseAmount(amountStr);
  const isIn = direction === "in";
  const dirKo = isIn ? "입금" : "출금";
  const dirColor = isIn ? t.success : t.danger;

  async function handleSave() {
    if (!actor) { setActionErr("관리자 사용자 ID 없음"); return; }
    if (amount <= 0) { setActionErr("금액을 입력해주세요."); return; }
    if (!date)       { setActionErr("날짜를 선택해주세요."); return; }
    setActionErr("");
    setBusy(true);
    try {
      let res;
      if (mode === "add") {
        res = await addCashflow({ direction, amount, flowDate: date, memo, actor });
      } else {
        res = await updateCashflow({ id: row.id, direction, amount, flowDate: date, memo, actor });
      }
      if (!res?.ok) {
        setActionErr(res?.error || "저장 실패");
      } else {
        onSaved?.();
      }
    } catch (e) {
      setActionErr(e?.message || "예외 발생");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div onClick={busy ? undefined : onClose} style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 200,
      }}/>
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(360px, 92vw)",
        background: t.bgElevated, borderRadius: 14,
        border: `2px solid ${dirColor}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        zIndex: 201, padding: "18px 18px",
        display: "flex", flexDirection: "column", gap: 12,
        maxHeight: "90vh", overflow: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: dirColor }}>
            {mode === "add" ? `${dirKo} 추가` : `${dirKo} 편집`}
          </span>
          <span style={{ fontSize: 9.5, color: t.textMuted, fontWeight: 600 }}>
            통장 직접 기록
          </span>
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} disabled={busy} aria-label="닫기" style={{
            background: "transparent", border: "none", padding: 4,
            color: t.textMuted, cursor: "pointer",
          }}>
            <X size={16}/>
          </button>
        </div>

        {/* 금액 */}
        <div>
          <label style={fieldLabel(t)}>금액 (₩) <span style={{ color: t.danger }}>*</span></label>
          <input type="text" value={amountStr} inputMode="numeric"
            onChange={e => setAmountStr(fmtAmountInput(e.target.value))}
            placeholder="예: 500,000"
            style={{
              ...inputStyle(t),
              fontFamily: "ui-monospace, monospace",
              fontVariantNumeric: "tabular-nums",
              textAlign: "right",
              fontSize: 16, fontWeight: 800,
              color: dirColor,
            }}
          />
        </div>

        {/* 날짜 */}
        <div>
          <label style={fieldLabel(t)}>날짜 <span style={{ color: t.danger }}>*</span></label>
          <input type="date" value={date}
            onChange={e => setDate(e.target.value)}
            style={inputStyle(t)}
          />
        </div>

        {/* 메모 */}
        <div>
          <label style={fieldLabel(t)}>내용 (선택)</label>
          <input type="text" value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder={isIn ? "예: 유솔 입금 / 직접수금" : "예: 분배 / 지급"}
            style={inputStyle(t)}
          />
        </div>

        {/* 2026-07-21 — 출금엔 운영비 안내 (지출 버튼 유도) */}
        {!isIn && mode === "add" && (
          <div style={{
            padding: "8px 10px",
            background: t.bgInset, border: `1px dashed ${t.border}`,
            borderRadius: 7, fontSize: 10.5, color: t.textSecondary, lineHeight: 1.5,
          }}>
            ⚠️ 식비·광고비 같은 <b style={{ color: "#FBBF24" }}>지출은 🧾 지출 버튼</b>으로!
            여기서 넣으면 운영비(손익)에 안 잡혀요.
          </div>
        )}

        {actionErr && (
          <div style={{
            padding: "8px 10px",
            background: t.dangerBg || "rgba(255,59,92,0.08)",
            border: `1px solid ${t.dangerBorder || t.danger}`,
            borderRadius: 7, fontSize: 11, color: t.danger, fontWeight: 600,
          }}>⚠️ {actionErr}</div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={ghostBtn(t)}>
            취소
          </button>
          <button onClick={handleSave} disabled={busy} style={{
            flex: 1, padding: "11px 12px",
            background: busy ? t.bgInset : dirColor,
            color: busy ? t.textMuted : "#fff",
            border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 800,
            cursor: busy ? "wait" : "pointer", fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
            opacity: busy ? 0.6 : 1,
          }}>
            <Save size={13}/>
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────
// 🧾 지출(운영비) 추가 다이얼로그 — 2026-07-21 신규
//   addExpense RPC (Mig 103 계열) → Mig 185 트리거가 통장 자동 미러.
// ────────────────────────────────────────────
function ExpenseDialog({ t, actor, defaultDate, onClose, onSaved }) {
  const AMBER = "#FBBF24";
  const [category, setCategory]   = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [date, setDate]           = useState(defaultDate);
  const [memo, setMemo]           = useState("");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");

  const amount = parseAmount(amountStr);

  async function handleSave() {
    if (!actor)     { setActionErr("관리자 사용자 ID 없음"); return; }
    if (!category)  { setActionErr("카테고리를 선택해주세요."); return; }
    if (amount <= 0){ setActionErr("금액을 입력해주세요."); return; }
    if (!date)      { setActionErr("날짜를 선택해주세요."); return; }
    setActionErr("");
    setBusy(true);
    try {
      const res = await addExpense({
        workMonth: ymdToYm(date),
        category, amount,
        expenseDate: date, memo, actor,
      });
      if (!res?.ok) {
        setActionErr(res?.error || "저장 실패");
      } else {
        onSaved?.();
      }
    } catch (e) {
      setActionErr(e?.message || "예외 발생");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div onClick={busy ? undefined : onClose} style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 200,
      }}/>
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(360px, 92vw)",
        background: t.bgElevated, borderRadius: 14,
        border: `2px solid ${AMBER}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        zIndex: 201, padding: "18px 18px",
        display: "flex", flexDirection: "column", gap: 12,
        maxHeight: "90vh", overflow: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: AMBER }}>
            🧾 지출 추가
          </span>
          <span style={{ fontSize: 9.5, color: t.textMuted, fontWeight: 600 }}>
            운영비로 기록
          </span>
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} disabled={busy} aria-label="닫기" style={{
            background: "transparent", border: "none", padding: 4,
            color: t.textMuted, cursor: "pointer",
          }}>
            <X size={16}/>
          </button>
        </div>

        {/* 카테고리 */}
        <div>
          <label style={fieldLabel(t)}>카테고리 <span style={{ color: t.danger }}>*</span></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
            {EXPENSE_CATEGORIES.map(c => {
              const on = category === c;
              return (
                <button key={c} onClick={() => setCategory(c)} disabled={busy} style={{
                  padding: "9px 4px",
                  background: on ? "rgba(251,191,36,0.10)" : t.bgInset,
                  border: `1.5px solid ${on ? AMBER : t.border}`,
                  borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                  color: on ? AMBER : t.textSecondary,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  {EXPENSE_CATEGORY_KO[c] || c}
                </button>
              );
            })}
          </div>
        </div>

        {/* 금액 */}
        <div>
          <label style={fieldLabel(t)}>금액 (₩) <span style={{ color: t.danger }}>*</span></label>
          <input type="text" value={amountStr} inputMode="numeric"
            onChange={e => setAmountStr(fmtAmountInput(e.target.value))}
            placeholder="예: 300,000"
            style={{
              ...inputStyle(t),
              fontFamily: "ui-monospace, monospace",
              fontVariantNumeric: "tabular-nums",
              textAlign: "right",
              fontSize: 16, fontWeight: 800,
              color: AMBER,
            }}
          />
        </div>

        {/* 날짜 */}
        <div>
          <label style={fieldLabel(t)}>날짜 <span style={{ color: t.danger }}>*</span></label>
          <input type="date" value={date}
            onChange={e => setDate(e.target.value)}
            style={inputStyle(t)}
          />
        </div>

        {/* 메모 */}
        <div>
          <label style={fieldLabel(t)}>내용 (선택)</label>
          <input type="text" value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="예: 네이버 파워링크 충전"
            style={inputStyle(t)}
          />
        </div>

        <div style={{
          padding: "8px 10px",
          background: t.bgInset, border: `1px dashed ${t.border}`,
          borderRadius: 7, fontSize: 10.5, color: t.textSecondary, lineHeight: 1.5,
        }}>
          💡 저장하면 <b>운영비 + 통장</b>에 동시 반영돼요 (자동연동)
        </div>

        {actionErr && (
          <div style={{
            padding: "8px 10px",
            background: t.dangerBg || "rgba(255,59,92,0.08)",
            border: `1px solid ${t.dangerBorder || t.danger}`,
            borderRadius: 7, fontSize: 11, color: t.danger, fontWeight: 600,
          }}>⚠️ {actionErr}</div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={ghostBtn(t)}>
            취소
          </button>
          <button onClick={handleSave} disabled={busy} style={{
            flex: 1, padding: "11px 12px",
            background: busy ? t.bgInset : AMBER,
            color: busy ? t.textMuted : "#1A1A1A",
            border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 800,
            cursor: busy ? "wait" : "pointer", fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
            opacity: busy ? 0.6 : 1,
          }}>
            <Save size={13}/>
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────
// 통장 거래 삭제 확인
// ────────────────────────────────────────────
function CashflowDeleteDialog({ t, actor, row, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const isIn = row.direction === "in";

  async function handleDelete() {
    if (!actor) { setActionErr("관리자 사용자 ID 없음"); return; }
    setBusy(true);
    try {
      const res = await deleteCashflow(row.id, actor);
      if (!res?.ok) {
        setActionErr(res?.error || "삭제 실패");
      } else {
        onDeleted?.();
      }
    } catch (e) {
      setActionErr(e?.message || "예외 발생");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div onClick={busy ? undefined : onClose} style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 200,
      }}/>
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(340px, 92vw)",
        background: t.bgElevated, borderRadius: 14,
        border: `2px solid ${t.danger}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        zIndex: 201, padding: "18px 18px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: t.danger }}>
          🗑 거래 삭제
        </div>
        <div style={{ fontSize: 12, color: t.text, lineHeight: 1.6 }}>
          이 거래를 정말 삭제하시겠습니까?
        </div>
        <div style={{
          padding: "10px 12px",
          background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 8,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ fontSize: 11, color: t.textMuted }}>
            {row.flow_date} · {isIn ? "입금" : "출금"}
          </div>
          <div className="mono" style={{
            fontSize: 16, fontWeight: 800,
            color: isIn ? t.success : t.danger,
            fontVariantNumeric: "tabular-nums",
          }}>
            {isIn ? "+" : "−"}{fmtKRW(row.amount)}
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary }}>
            {row.memo || "(메모 없음)"}
          </div>
        </div>

        {actionErr && (
          <div style={{
            padding: "8px 10px",
            background: t.dangerBg || "rgba(255,59,92,0.08)",
            border: `1px solid ${t.dangerBorder || t.danger}`,
            borderRadius: 7, fontSize: 11, color: t.danger, fontWeight: 600,
          }}>⚠️ {actionErr}</div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={ghostBtn(t)}>
            되돌리기
          </button>
          <button onClick={handleDelete} disabled={busy} style={{
            flex: 1, padding: "11px 12px",
            background: busy ? t.bgInset : t.danger,
            color: busy ? t.textMuted : "#fff",
            border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 800,
            cursor: busy ? "wait" : "pointer", fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
            opacity: busy ? 0.6 : 1,
          }}>
            <Trash2 size={12}/>
            {busy ? "삭제 중..." : "정말 삭제"}
          </button>
        </div>
      </div>
    </>
  );
}

// 다이얼로그 공용 스타일
function fieldLabel(t) {
  return {
    display: "block",
    fontSize: 10, color: t.textMuted, fontWeight: 700,
    marginBottom: 4, letterSpacing: 0.3,
  };
}
function inputStyle(t) {
  return {
    width: "100%", boxSizing: "border-box",
    padding: "10px 12px",
    background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 8,
    fontSize: 13, color: t.text, fontFamily: "inherit",
    outline: "none",
  };
}
function ghostBtn(t) {
  return {
    padding: "11px 14px",
    background: "transparent", border: `1px solid ${t.border}`,
    color: t.text, borderRadius: 8,
    fontSize: 12, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  };
}
