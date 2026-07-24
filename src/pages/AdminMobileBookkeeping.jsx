// 2026-07-24 — 모바일 「가계부」 해체 → 🏦 통장 / 📊 손익 두 화면 분리 (사장님 확정).
//
// 사장님 spec (2026-07-24):
//   · [가계부|통장] 토글 제거 — 개요 타일에서 각각 직행 (mode prop: "bank" | "profit").
//   · 🏦 통장(금고): 잔고 히어로 + 버튼 3개(입금/출금/🧾지출) + 날짜별 거래 타임라인
//     (이번 달은 날짜별 마감 잔고 pill — 클라 계산).
//   · 📊 손익: ① 돈의 흐름 깔때기 (전체 매출 → 기사/원청 갈라짐 → 회사 몫
//     → 유솔N 합류·운영비 이탈 → 남은 돈 → 🏦 통장 잔고 점프)
//     ② 수입 카드 ③ 운영비 카드 ④ 분배·여유 컴팩트 ⑤ 누적 한 줄.
//     연결부는 문장 X — 들여쓴 −/+ 항목 줄 (v3 시안). "최근 4달" 카드 없음 (사장님 제외).
//   · 라벨·막대 2줄 구조 — 좁은 화면 짤림 원천 차단.
//
// 계산 로직·RPC 는 PC 와 100% 동일 (재사용). UI 만 모바일 전용.
// 2026-07-21 기능 유지: 🧾 지출(운영비→통장 자동, Mig 185), 자동 행 편집 잠금 칩.
// ⚠️ CLAUDE.md 금지 어근 자가 검사 통과 의무.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Minus, Receipt, Edit3, Trash2, X, Save } from "lucide-react";
import {
  listExpenses, addExpense, listDistributions,
  getUsolNTrackBMargin,
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
const KO_DOW_M = ["일","월","화","수","목","금","토"];
function ymdToDow(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m||1)-1, d||1);
  return isNaN(dt.getTime()) ? "" : KO_DOW_M[dt.getDay()];
}
function ymdToYm(ymd) { return (ymd || "").slice(0, 7); }
function shiftYmd(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m||1)-1, d||1);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
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
// 압축 표기 — 1,830만 / 34만 / 5,000
function fmtMan(n) {
  const v = Number(n) || 0;
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 10000) {
    const man = Math.round(a / 10000);
    return `${sign}${man.toLocaleString("ko-KR")}만`;
  }
  return `${sign}${a.toLocaleString("ko-KR")}`;
}
// 막대 % (0~100, total 0 가드)
function pctOf(v, total) {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, (Math.max(0, Number(v) || 0) / total) * 100));
}

// 운영비 카테고리 색 (구성·범례 공용)
const EXPENSE_CAT_COLORS = {
  ad:    "#FF1B8D",
  tax:   "#8B5CF6",
  labor: "#FBBF24",
  meal:  "#60A5FA",
  rent:  "#2BB673",
  etc:   "#5C6470",
};
const C_ENG    = "#06B6D4";   // 기사 몫
const C_PRIN   = "#8B5CF6";   // 원청 수수료
const C_OWNER  = "#2BB673";   // 회사 몫
const C_REMAIN = "#60A5FA";   // 남은 돈 / 통장

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
// 본체 — mode: "bank"(🏦 통장) | "profit"(📊 손익)
// ────────────────────────────────────────────
export default function AdminMobileBookkeeping({ t, user, apiTasks = [], onBack, mode = "bank", onJumpBank }) {
  const todayYmd = kstYmd();
  const [selectedYm, setSelectedYm] = useState(nowKstYm());
  const actor = user?.user_id || user?.userId || user?.id;
  const isThisMonth = selectedYm === nowKstYm();
  const isBank = mode === "bank";

  // 2026-07-24 — 통장 [일별|월별] 탭 (사장님 spec: 기본 = 오늘, 날짜 선택 가능)
  const [bankView, setBankView] = useState("day");   // "day" | "month"
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const isToday = selectedDate === todayYmd;
  const dayDow = ymdToDow(selectedDate);
  // 일별 탭에서 날짜 이동 시 그 달 거래를 fetch 하도록 월 동기
  useEffect(() => {
    if (!isBank || bankView !== "day") return;
    const ymOfDate = ymdToYm(selectedDate);
    if (ymOfDate && ymOfDate !== selectedYm) setSelectedYm(ymOfDate);
  }, [isBank, bankView, selectedDate, selectedYm]);

  // ── 일정산 (track A) — 클라 계산 (전체 매출/기사/원청/회사 몫 전부 사용)
  const monthRange = useMemo(() => {
    const [y, m] = selectedYm.split("-").map(Number);
    return getMonthRange(y, m);
  }, [selectedYm]);
  const revenueStat = useMemo(
    () => computeRevenueByYmRange(apiTasks, monthRange.start, monthRange.end, user),
    [apiTasks, monthRange.start, monthRange.end, user]
  );
  const grossTotal   = Number(revenueStat?.total)     || 0;   // 전체 매출
  const engShare     = Number(revenueStat?.engineer)  || 0;   // 기사 몫
  const prinShare    = Number(revenueStat?.principal) || 0;   // 원청 수수료
  const incomeTrackA = Number(revenueStat?.owner)     || 0;   // 회사 몫 (일정산)

  // ── 유솔N 자동 (track B, Mig 123)
  const [usolNB, setUsolNB] = useState(0);
  useEffect(() => {
    if (!actor || isBank) { setUsolNB(0); return; }
    let alive = true;
    (async () => {
      const res = await getUsolNTrackBMargin(selectedYm, actor);
      if (alive) setUsolNB(res?.ok ? (Number(res.amount) || 0) : 0);
    })().catch(() => { if (alive) setUsolNB(0); });
    return () => { alive = false; };
  }, [selectedYm, actor, isBank]);

  // ── 유솔N 보정 (Mig 127/128)
  const [usolNAdj, setUsolNAdj] = useState(0);
  useEffect(() => {
    if (!actor || isBank) { setUsolNAdj(0); return; }
    let alive = true;
    (async () => {
      const res = await getUsolnAdjustment(selectedYm, actor);
      if (alive) setUsolNAdj(res?.ok && res.row ? (Number(res.row.amount) || 0) : 0);
    })().catch(() => { if (alive) setUsolNAdj(0); });
    return () => { alive = false; };
  }, [selectedYm, actor, isBank]);
  const usolNTotal = usolNB + usolNAdj;

  // ── 기타 수입
  const [otherIncomeSum, setOtherIncomeSum] = useState(0);
  useEffect(() => {
    if (!actor || isBank) { setOtherIncomeSum(0); return; }
    let alive = true;
    (async () => {
      const res = await listOtherIncome(selectedYm, actor);
      if (!alive) return;
      const sum = (res?.rows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      setOtherIncomeSum(sum);
    })().catch(() => { if (alive) setOtherIncomeSum(0); });
    return () => { alive = false; };
  }, [selectedYm, actor, isBank]);

  // ── 운영비 — rows 보관 (카테고리 상세용)
  const [expenseRows, setExpenseRows] = useState([]);
  const [expReloadTick, setExpReloadTick] = useState(0);
  useEffect(() => {
    if (!actor || isBank) { setExpenseRows([]); return; }
    let alive = true;
    (async () => {
      const res = await listExpenses(selectedYm, actor);
      if (!alive) return;
      setExpenseRows(res?.ok ? (res.rows || []) : []);
    })().catch(() => { if (alive) setExpenseRows([]); });
    return () => { alive = false; };
  }, [selectedYm, actor, isBank, expReloadTick]);
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
    if (!actor || isBank) { setDistSum(0); return; }
    let alive = true;
    (async () => {
      const res = await listDistributions(selectedYm, actor);
      if (!alive) return;
      const sum = (res?.rows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      setDistSum(sum);
    })().catch(() => { if (alive) setDistSum(0); });
    return () => { alive = false; };
  }, [selectedYm, actor, isBank]);

  // 2026-07-24 — 누적 이월 표시 제거 (사장님 spec) → RPC 호출도 제거.

  // ── 통장 요약 (Mig 122) + 거래 목록 — 두 화면 다 사용 (손익은 잔고 표시용)
  const [cashflow, setCashflow] = useState({ month_in: 0, month_out: 0, current_balance: 0 });
  const [cashflowLoading, setCashflowLoading] = useState(false);
  const [cashflowRows, setCashflowRows] = useState([]);
  const [cashflowListLoading, setCashflowListLoading] = useState(false);
  const [cfReloadTick, setCfReloadTick] = useState(0);
  const [cfDialog, setCfDialog] = useState(null);   // { mode:'add'|'edit'|'delete'|'expense', direction?, row? }
  const [taskNoMap, setTaskNoMap] = useState({});
  // 일별 탭용 — 그날 마감 잔고 + in/out (Mig 158 RPC)
  const [dayClose, setDayClose] = useState({ day_in: 0, day_out: 0, day_close_balance: 0 });
  useEffect(() => {
    if (!actor) return;
    let alive = true;
    setCashflowLoading(true);
    setCashflowListLoading(true);
    (async () => {
      const [resSum, resList, resDay] = await Promise.all([
        getCashflowSummary(selectedYm, actor),
        isBank ? listCashflow(selectedYm, actor) : Promise.resolve({ ok: true, rows: [] }),
        isBank ? getCashflowDayClose(selectedDate, actor) : Promise.resolve(null),
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
  }, [selectedYm, selectedDate, actor, isBank, cfReloadTick]);

  // 일별 탭 — 그날 거래만
  const dayRows = useMemo(
    () => (cashflowRows || []).filter(r => r.flow_date === selectedDate),
    [cashflowRows, selectedDate]
  );

  // ── 타임라인: 날짜별 그룹 (최신 날짜부터)
  const dayGroups = useMemo(() => {
    const byDate = {};
    for (const r of cashflowRows || []) {
      const d = r.flow_date;
      if (!d) continue;
      (byDate[d] = byDate[d] || []).push(r);
    }
    return Object.keys(byDate).sort().reverse().map(d => ({ date: d, rows: byDate[d] }));
  }, [cashflowRows]);

  // 날짜별 마감 잔고 — 클라 계산 (이번 달만 정확: 현재 잔고에서 이후 거래 되감기).
  //   과거 달은 다음 달 거래가 rows 에 없어 어긋남 → pill 숨김.
  const dayCloseMap = useMemo(() => {
    if (!isThisMonth) return {};
    const map = {};
    let after = 0;   // d 이후(더 최신) 거래의 signed 합
    for (const g of dayGroups) {           // dayGroups = 최신 → 과거
      map[g.date] = (Number(cashflow.current_balance) || 0) - after;
      after += g.rows.reduce((s, r) =>
        s + (r.direction === "in" ? 1 : -1) * (Number(r.amount) || 0), 0);
    }
    return map;
  }, [dayGroups, cashflow.current_balance, isThisMonth]);

  // auto_engineer_remit 행의 task_no 조회 (그 달 거래)
  useEffect(() => {
    if (!actor || !isBank) return;
    const ids = (cashflowRows || [])
      .filter(r => r.source === "auto_engineer_remit" && r.source_ref)
      .map(r => r.source_ref);
    if (ids.length === 0) { setTaskNoMap({}); return; }
    let alive = true;
    (async () => {
      const map = await fetchTaskNoMap(ids);
      if (alive) setTaskNoMap(map);
    })().catch(() => { /* 무시 */ });
    return () => { alive = false; };
  }, [cashflowRows, actor, isBank]);

  // ── 합산 (기존 산식 그대로)
  const incomeTotal = incomeTrackA + usolNTotal + otherIncomeSum;
  const netProfit   = incomeTotal - expenseSum;
  const monthlyDiff = netProfit - distSum;

  // ── 현금 / 천장 (PC 통합본과 동일 산식) — 손익 화면 분배·여유 카드용
  const [boardSummary, setBoardSummary] = useState({ months: [], start_month: "2026-04" });
  useEffect(() => {
    if (!actor || isBank) return;
    let alive = true;
    (async () => {
      const res = await getUsolnSettleBoardSummary(actor);
      if (!alive) return;
      if (res?.ok) {
        setBoardSummary({ months: res.months || [], start_month: res.start_month || "2026-04" });
      }
    })().catch(() => { /* 실패 시 0 표시 */ });
    return () => { alive = false; };
  }, [actor, isBank]);
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

  // ── 월 네비게이터 (공용)
  const monthNav = (
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
  );

  return (
    <div style={{ padding: "12px 14px 24px" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {onBack && (
          <button onClick={onBack} aria-label="뒤로" style={navBtn(t)}>
            <ArrowLeft size={16}/>
          </button>
        )}
        <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
          {isBank ? "🏦 통장" : "📊 손익"}
        </div>
        <div style={{ flex: 1 }}/>
      </div>

      {/* 네비게이터 — 손익: 월 / 통장: 탭에 따라 일·월 */}
      {!isBank && monthNav}

      {/* ═══ 🏦 통장 — [일별|월별] 탭 + 잔고 히어로 + 버튼 3개 + 거래 ═══ */}
      {isBank && <>

      {/* 탭 — 일별(기본) / 월별 */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
        padding: 4, marginBottom: 10,
        background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 10,
      }}>
        {[
          { key: "day",   label: "📆 일별" },
          { key: "month", label: "🗓 월별" },
        ].map(seg => {
          const active = bankView === seg.key;
          return (
            <button key={seg.key} onClick={() => setBankView(seg.key)} style={{
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

      {/* 일별 = 날짜 네비게이터 (date picker) / 월별 = 월 네비게이터 */}
      {bankView === "day" ? (
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
      ) : monthNav}

      <div style={{
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderTop: `3px solid ${C_REMAIN}`,
        borderRadius: 12, padding: "14px 13px", marginBottom: 8, textAlign: "center",
      }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: t.textMuted }}>
          {bankView === "day" ? (isToday ? "지금 통장에" : "이날 마감 잔고") : "지금 통장에"}
        </div>
        {cashflowLoading ? (
          <div style={{ fontSize: 12, color: t.textMuted, padding: "8px 0" }}>불러오는 중...</div>
        ) : (
          <div className="mono" style={{
            marginTop: 3,
            fontSize: 27, fontWeight: 900,
            color: (bankView === "day" ? dayClose.day_close_balance : cashflow.current_balance) < 0 ? t.danger : C_REMAIN,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px",
          }}>{fmtMoney(bankView === "day" ? dayClose.day_close_balance : cashflow.current_balance)}</div>
        )}
        <div style={{
          display: "flex", justifyContent: "center", gap: 14,
          marginTop: 6, fontSize: 11, fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}>
          {bankView === "day" ? (
            <>
              <span style={{ color: t.success }}>이날 +{fmtMan(dayClose.day_in)}</span>
              <span style={{ color: t.danger }}>−{fmtMan(dayClose.day_out)}</span>
            </>
          ) : (
            <>
              <span style={{ color: t.success }}>{Number(selectedYm.slice(5, 7))}월 +{fmtMan(cashflow.month_in)}</span>
              <span style={{ color: t.danger }}>−{fmtMan(cashflow.month_out)}</span>
            </>
          )}
        </div>

        {/* 버튼 3개 — 입금 / 출금 / 지출 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 11 }}>
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

      {/* 거래 — 일별: 그날 리스트 / 월별: 날짜별 타임라인 */}
      {cashflowListLoading ? (
        <div style={{ padding: "14px", textAlign: "center", color: t.textMuted, fontSize: 11 }}>
          불러오는 중...
        </div>
      ) : bankView === "day" ? (
        dayRows.length === 0 ? (
          <div style={{
            padding: "18px 12px", textAlign: "center",
            background: t.bgElevated, border: `1px dashed ${t.border}`, borderRadius: 10,
            color: t.textMuted, fontSize: 11,
          }}>
            이 날짜엔 거래가 없어요
          </div>
        ) : (
          <>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: t.textSecondary, margin: "2px 2px 6px" }}>
              이날 거래 {dayRows.length}건
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {dayRows.map(r => (
                <CashflowMobileRow key={r.id} t={t} row={r}
                  taskNo={taskNoMap[r.source_ref] || ""}
                  onEdit={() => setCfDialog({ mode: "edit", direction: r.direction, row: r })}
                  onDelete={() => setCfDialog({ mode: "delete", row: r })}
                />
              ))}
            </div>
          </>
        )
      ) : dayGroups.length === 0 ? (
        <div style={{
          padding: "18px 12px", textAlign: "center",
          background: t.bgElevated, border: `1px dashed ${t.border}`, borderRadius: 10,
          color: t.textMuted, fontSize: 11,
        }}>
          이 달엔 거래가 없어요
        </div>
      ) : (
        dayGroups.map(g => (
          <div key={g.date} style={{ marginBottom: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              margin: "2px 2px 5px",
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: t.textSecondary }}>
                {Number(g.date.slice(5, 7))}/{Number(g.date.slice(8, 10))} ({ymdToDow(g.date)})
              </span>
              <span style={{ fontSize: 9.5, color: t.textMuted }}>{g.rows.length}건</span>
              {isThisMonth && dayCloseMap[g.date] != null && (
                <span className="mono" style={{
                  marginLeft: "auto",
                  fontSize: 9, fontWeight: 800, borderRadius: 999, padding: "2px 8px",
                  background: t.bgInset, color: t.textSecondary,
                  fontVariantNumeric: "tabular-nums",
                }}>마감 {fmtMan(dayCloseMap[g.date])}</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {g.rows.map(r => (
                <CashflowMobileRow key={r.id} t={t} row={r}
                  taskNo={taskNoMap[r.source_ref] || ""}
                  onEdit={() => setCfDialog({ mode: "edit", direction: r.direction, row: r })}
                  onDelete={() => setCfDialog({ mode: "delete", row: r })}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <div style={{
        marginTop: 6,
        padding: "9px 12px",
        background: t.bgInset, border: `1px dashed ${t.border}`,
        borderRadius: 10,
        fontSize: 10.5, color: t.textSecondary, textAlign: "center", lineHeight: 1.5,
      }}>
        ✏️ 기준 잔고 설정은 PC 통장에서
      </div>

      </>}

      {/* ═══ 📊 손익 — 흐름 깔때기 + 수입 + 운영비 + 분배·여유 + 누적 ═══ */}
      {!isBank && <>

      {/* ① 이번 달 돈의 흐름 (깔때기, v3 시안) */}
      <div style={{
        background: t.bgElevated, border: `1.5px solid ${t.accent}`,
        borderRadius: 13, padding: "13px 14px", marginBottom: 8,
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: t.text, marginBottom: 9 }}>
          💸 이번 달 돈의 흐름
        </div>

        {grossTotal <= 0 && incomeTotal <= 0 ? (
          <div style={{ fontSize: 11, color: t.textMuted, textAlign: "center", padding: "10px 0" }}>
            이 달엔 아직 내역이 없어요
          </div>
        ) : (
          <>
            {/* 전체 매출 */}
            <FlowStage t={t} label="전체 매출" amount={grossTotal} amountColor={t.text}>
              <div style={{ display: "flex", height: 15, borderRadius: 5, overflow: "hidden", background: t.bgInset }}>
                <div style={{ width: `${pctOf(engShare, grossTotal)}%`,  background: C_ENG }}/>
                <div style={{ width: `${pctOf(prinShare, grossTotal)}%`, background: C_PRIN }}/>
                <div style={{ width: `${pctOf(incomeTrackA, grossTotal)}%`, background: C_OWNER }}/>
              </div>
            </FlowStage>
            <FlowMid t={t} rows={[
              { label: "기사 몫",     value: -engShare,  color: C_ENG },
              { label: "원청 수수료", value: -prinShare, color: C_PRIN },
            ]}/>

            {/* 회사 몫 */}
            <FlowStage t={t} label="회사 몫" amount={incomeTrackA} amountColor={C_OWNER}>
              <div style={{ width: `${Math.max(pctOf(incomeTrackA, grossTotal), 3)}%`, height: 15, borderRadius: 5, background: C_OWNER }}/>
            </FlowStage>
            <FlowMid t={t} rows={[
              { label: "유솔N 월정산", value: usolNTotal,      color: C_OWNER, hide: usolNTotal === 0 },
              { label: "기타 수입",    value: otherIncomeSum,  color: C_OWNER, hide: otherIncomeSum === 0 },
              { label: "운영비",       value: -expenseSum,     color: t.danger },
            ]}/>

            {/* 남은 돈 */}
            <FlowStage t={t} label="남은 돈" labelBold amount={netProfit}
              amountColor={netProfit < 0 ? t.danger : C_REMAIN} amountSize={15}>
              <div style={{
                width: `${Math.max(pctOf(netProfit, grossTotal || Math.abs(netProfit) || 1), 3)}%`,
                height: 15, borderRadius: 5,
                background: netProfit < 0 ? t.danger : C_REMAIN,
              }}/>
            </FlowStage>

            {/* → 통장 */}
            <div style={{
              margin: "3px 0 0 5px", padding: "5px 0 0 14px",
              borderLeft: `2px solid ${C_REMAIN}`,
            }}>
              <button onClick={onJumpBank} disabled={!onJumpBank} style={{
                width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "transparent", border: "none", padding: "2px 0",
                cursor: onJumpBank ? "pointer" : "default", fontFamily: "inherit",
              }}>
                <span style={{ fontSize: 11, color: t.textSecondary, fontWeight: 600 }}>🏦 통장 잔고</span>
                <span className="mono" style={{
                  fontSize: 12.5, fontWeight: 800, color: C_REMAIN,
                  fontVariantNumeric: "tabular-nums",
                }}>{fmtMan(cashflow.current_balance)}{onJumpBank ? " ›" : ""}</span>
              </button>
            </div>

            {/* 범례 */}
            {grossTotal > 0 && (
              <div style={{
                display: "flex", flexWrap: "wrap", gap: "4px 10px", marginTop: 9,
                fontSize: 9, fontWeight: 700, color: t.textSecondary,
              }}>
                <LegendDot color={C_ENG}   label={`기사 ${Math.round(pctOf(engShare, grossTotal))}%`}/>
                <LegendDot color={C_PRIN}  label={`원청 ${Math.round(pctOf(prinShare, grossTotal))}%`}/>
                <LegendDot color={C_OWNER} label={`회사 ${Math.round(pctOf(incomeTrackA, grossTotal))}%`}/>
              </div>
            )}
          </>
        )}
      </div>

      {/* ② 수입 */}
      <div style={{
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 13, padding: "13px 14px", marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>수입</span>
          <span className="mono" style={{
            marginLeft: "auto", fontSize: 12, fontWeight: 700, color: t.success,
            fontVariantNumeric: "tabular-nums",
          }}>{fmtMoney(incomeTotal)}</span>
        </div>
        <IncomeRow t={t} label="일정산"      value={incomeTrackA}   total={incomeTotal} color={C_OWNER}/>
        <IncomeRow t={t} label="유솔N 월정산" value={usolNTotal}     total={incomeTotal} color={C_ENG}/>
        {otherIncomeSum !== 0 && (
          <IncomeRow t={t} label="기타 수입"  value={otherIncomeSum} total={incomeTotal} color={C_PRIN}/>
        )}
      </div>

      {/* ③ 운영비 */}
      <div style={{
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 13, padding: "13px 14px", marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>🧾 운영비</span>
          <span className="mono" style={{
            marginLeft: "auto", fontSize: 12, fontWeight: 700, color: t.danger,
            fontVariantNumeric: "tabular-nums",
          }}>− {fmtKRW(expenseSum)}</span>
        </div>
        {expenseSum === 0 ? (
          <div style={{ fontSize: 11, color: t.textMuted, textAlign: "center", padding: "6px 0" }}>
            이 달엔 운영비 내역이 없어요
          </div>
        ) : (
          EXPENSE_CATEGORIES
            .map(c => ({ key: c, label: EXPENSE_CATEGORY_KO[c] || c, value: expenseByCat[c] || 0 }))
            .filter(p => p.value > 0)
            .sort((a, b) => b.value - a.value)
            .map(p => (
              <div key={p.key} style={{
                display: "flex", alignItems: "center", gap: 7,
                fontSize: 12, padding: "6px 0",
                borderBottom: `0.5px solid ${t.border}`,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 2, flexShrink: 0,
                  background: EXPENSE_CAT_COLORS[p.key] || "#5C6470",
                }}/>
                <span style={{ color: t.textSecondary }}>{p.label}</span>
                <span className="mono" style={{
                  marginLeft: "auto", fontWeight: 700, color: t.text,
                  fontVariantNumeric: "tabular-nums",
                }}>{fmtKRW(p.value)}</span>
              </div>
            ))
        )}
        <div style={{ fontSize: 9.5, color: t.textMuted, marginTop: 7, textAlign: "center" }}>
          지출 입력은 🏦 통장 화면의 🧾 지출 버튼
        </div>
      </div>

      {/* ④ 분배·여유 — 컴팩트 (기존 천장 산식 유지) */}
      <div style={{
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 13, padding: "12px 14px", marginBottom: 8,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
          <span style={{ color: t.textSecondary }}>이번 달 분배</span>
          <span className="mono" style={{ fontWeight: 700, color: t.text, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(distSum)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
          <span style={{ color: t.textSecondary }}>나눠도 됨 (천장)</span>
          <span className="mono" style={{ fontWeight: 700, color: ceiling < 0 ? t.danger : t.accent, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(ceiling)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
          <span style={{ color: t.textSecondary }}>분배 후 남는 것</span>
          <span className="mono" style={{ fontWeight: 700, color: monthlyDiff < 0 ? t.danger : t.success, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(monthlyDiff)}</span>
        </div>
      </div>

      {/* 2026-07-24 — 하단 누적·PC 안내 박스 제거 (사장님 spec) */}

      </>}

      {/* ═══ 다이얼로그 (통장 화면) ═══ */}
      {cfDialog?.mode === "add" && (
        <CashflowDialog t={t} mode="add"
          actor={actor}
          direction={cfDialog.direction}
          defaultDate={isBank && bankView === "day" ? selectedDate : (isThisMonth ? todayYmd : `${selectedYm}-01`)}
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
          defaultDate={isBank && bankView === "day" ? selectedDate : (isThisMonth ? todayYmd : `${selectedYm}-01`)}
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
// 손익 깔때기 부품 — 라벨·숫자 윗줄 + 막대 아랫줄 (짤림 차단, v3 시안)
// ────────────────────────────────────────────
function FlowStage({ t, label, labelBold, amount, amountColor, amountSize = 13, children }) {
  return (
    <div style={{ padding: "2px 0" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontSize: 12, marginBottom: 4,
      }}>
        <span style={{
          fontWeight: labelBold ? 800 : 700,
          color: labelBold ? t.text : t.textSecondary,
        }}>{label}</span>
        <b className="mono" style={{
          fontWeight: 800, fontSize: amountSize, color: amountColor,
          fontVariantNumeric: "tabular-nums",
        }}>{fmtMan(amount)}</b>
      </div>
      {children}
    </div>
  );
}

function FlowMid({ t, rows }) {
  const visible = rows.filter(r => !r.hide);
  if (visible.length === 0) return null;
  return (
    <div style={{
      margin: "3px 0 3px 5px", padding: "4px 0 4px 14px",
      borderLeft: `2px solid ${t.bgInset}`,
    }}>
      {visible.map((r, i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 11, padding: "2.5px 0",
        }}>
          <span style={{ color: t.textSecondary }}>{r.label}</span>
          <b className="mono" style={{
            fontWeight: 700, color: r.color,
            fontVariantNumeric: "tabular-nums",
          }}>{r.value > 0 ? "+" : ""}{fmtMan(r.value)}</b>
        </div>
      ))}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: 3, background: color, display: "inline-block" }}/>
      {label}
    </span>
  );
}

// 수입 행 — 라벨 윗줄 + 막대 아랫줄
function IncomeRow({ t, label, value, total, color }) {
  return (
    <div style={{ padding: "3px 0 7px" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontSize: 11.5, marginBottom: 4,
      }}>
        <span style={{ color: t.textSecondary, fontWeight: 600 }}>{label}</span>
        <b className="mono" style={{
          fontWeight: 700, color: value < 0 ? t.danger : t.text,
          fontVariantNumeric: "tabular-nums",
        }}>{value > 0 ? "+" : ""}{fmtMan(value)}</b>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: t.bgInset, overflow: "hidden" }}>
        <div style={{ width: `${pctOf(value, total)}%`, height: "100%", borderRadius: 4, background: color }}/>
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
