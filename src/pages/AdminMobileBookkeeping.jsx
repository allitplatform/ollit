// 2026-06-14 — 모바일 가계부 (읽기 전용, 4카드).
//
// 사장님 spec:
//   PC AdminPcBookkeeping 은 maxWidth 1400 + 고정 픽셀 grid 라 모바일(380px) 깨짐.
//   → 모바일 전용 간소 뷰 신규. 진입은 개요 탭의 "📊 가계부 보기" 버튼.
//
// 4카드 (전부 읽기 전용):
//   1) 📊 손익 — 그 달 수입(일정산/유솔N/기타) + 운영비 + 순이익 + 분배 + 당월 차이
//   2) 📦 누적 이월 — 시작월(2026-04) ~ 당월 누적 (Mig 129 RPC)
//   3) 💳 통장 — 잔고 + 이번달 in/out (Mig 122 RPC)
//   4) ✏️ 안내 — "입력/편집은 PC 가계부에서"
//
// 계산 로직·RPC 는 PC 와 100% 동일 (재사용). UI 컴포넌트만 모바일 전용.
//
// ⚠️ CLAUDE.md 금지 어근 자가 검사 통과 의무.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import {
  listExpenses, listDistributions,
  getUsolNTrackBMargin, getCumulativeCarryover,
} from "../lib/bookkeepingDb.js";
import { listOtherIncome } from "../lib/bookkeepingOtherIncomeDb.js";
import { getUsolnAdjustment } from "../lib/bookkeepingUsolnAdjustmentDb.js";
import { getCashflowSummary } from "../lib/bookkeepingCashflowDb.js";
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
const fmtKRW = n => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
const fmtSigned = n => {
  const v = Number(n) || 0;
  if (v === 0) return "₩0";
  return (v < 0 ? "−" : "+") + fmtKRW(Math.abs(v)).replace("₩", "₩");
};

// ────────────────────────────────────────────
// 본체
// ────────────────────────────────────────────
export default function AdminMobileBookkeeping({ t, user, apiTasks = [], onBack }) {
  const [selectedYm, setSelectedYm] = useState(nowKstYm());
  const actor = user?.user_id || user?.userId || user?.id;
  const isThisMonth = selectedYm === nowKstYm();

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

  // ── 운영비
  const [expenseSum, setExpenseSum] = useState(0);
  useEffect(() => {
    if (!actor) { setExpenseSum(0); return; }
    let alive = true;
    (async () => {
      const res = await listExpenses(selectedYm, actor);
      if (!alive) return;
      const sum = (res?.rows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      setExpenseSum(sum);
    })().catch(() => { if (alive) setExpenseSum(0); });
    return () => { alive = false; };
  }, [selectedYm, actor]);

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

  // ── 통장 요약 (Mig 122)
  const [cashflow, setCashflow] = useState({ month_in: 0, month_out: 0, current_balance: 0, baseline_amount: 0 });
  const [cashflowLoading, setCashflowLoading] = useState(false);
  useEffect(() => {
    if (!actor) return;
    let alive = true;
    setCashflowLoading(true);
    (async () => {
      const res = await getCashflowSummary(selectedYm, actor);
      if (!alive) return;
      if (res?.ok) {
        setCashflow({
          month_in:        Number(res.month_in)        || 0,
          month_out:       Number(res.month_out)       || 0,
          current_balance: Number(res.current_balance) || 0,
          baseline_amount: Number(res.baseline_amount) || 0,
        });
      }
      setCashflowLoading(false);
    })().catch(() => { if (alive) setCashflowLoading(false); });
    return () => { alive = false; };
  }, [selectedYm, actor]);

  // ── 합산 계산
  const incomeTotal = incomeTrackA + usolNTotal + otherIncomeSum;
  const netProfit   = incomeTotal - expenseSum;
  const monthlyDiff = netProfit - distSum;
  const cumValue    = Number(cum.cumulative_carryover) || 0;
  const cumNeg      = cumValue < 0;

  return (
    <div style={{ padding: "12px 14px 24px" }}>
      {/* 헤더 — 뒤로가기 + 제목 + 읽기전용 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {onBack && (
          <button onClick={onBack} aria-label="뒤로" style={navBtn(t)}>
            <ArrowLeft size={16}/>
          </button>
        )}
        <Wallet size={18} style={{ color: t.accent }}/>
        <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>가계부</div>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 10, color: t.textMuted }}>읽기 전용</span>
      </div>

      {/* 월 선택 */}
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

      {/* 카드 1: 📊 손익 */}
      <Card t={t} title="📊 손익" subtitle="그 달 수입 − 운영비 − 분배">
        <Row t={t} label="일정산 (track A)"           value={incomeTrackA} color="#3B82F6"/>
        <Row t={t} label="유솔N 월정산 (자동+보정)"   value={usolNTotal}   color="#8B5CF6"
          hint={usolNAdj !== 0 ? `자동 ${fmtKRW(usolNB)} + 보정 ${fmtSigned(usolNAdj)}` : null}
        />
        <Row t={t} label="기타 (세스코·개인건 등)"     value={otherIncomeSum} color="#14B8A6"/>
        <Divider t={t}/>
        <Row t={t} label="수입 합계"  value={incomeTotal} color={t.text} bold/>
        <Row t={t} label="운영비"     value={expenseSum}  color={t.danger} negative/>
        <Divider t={t}/>
        <Row t={t} label="순이익"     value={netProfit}   color={t.accent} big highlight/>
        <Row t={t} label="분배"       value={distSum}     color={t.warning || "#F59E0B"} negative/>
        <Row t={t} label="당월 차이"  value={monthlyDiff} color={monthlyDiff < 0 ? t.danger : t.success} signed/>
      </Card>

      {/* 카드 2: 📦 누적 이월 */}
      <div style={{
        marginTop: 12,
        background: cumNeg ? (t.dangerBg || "rgba(255,59,92,0.08)") : (t.successBg || "rgba(34,197,94,0.08)"),
        border: `2px solid ${cumNeg ? (t.dangerBorder || t.danger) : (t.successBorder || t.success)}`,
        borderRadius: 12, overflow: "hidden",
      }}>
        <div style={{ padding: "14px 14px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: cumNeg ? t.danger : t.success }}>📦 누적 이월</span>
            <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>
              {cum.start_month} ~ {selectedYm}
            </span>
          </div>
          <div style={{ marginTop: 6, textAlign: "center" }}>
            {cumLoading ? (
              <span style={{ fontSize: 12, color: t.textMuted }}>불러오는 중...</span>
            ) : (
              <span className="mono" style={{
                fontSize: 26, fontWeight: 900,
                color: cumNeg ? t.danger : t.success,
                fontVariantNumeric: "tabular-nums",
              }}>
                {cumNeg ? "−" : ""}{fmtKRW(Math.abs(cumValue)).replace("₩", "₩")}
              </span>
            )}
          </div>
          {!cumLoading && cumNeg && (
            <div style={{ marginTop: 6, padding: "6px 10px", textAlign: "center",
              fontSize: 10, color: t.textSecondary, lineHeight: 1.5,
            }}>
              💡 아직 못 채운 금액. 다음 달 수입이 쌓이면 메워집니다.
            </div>
          )}
        </div>
        <div style={{
          padding: "8px 14px",
          background: t.bgInset,
          borderTop: `1px solid ${cumNeg ? (t.dangerBorder || t.danger) : (t.successBorder || t.success)}`,
          fontSize: 10, color: t.textMuted, textAlign: "center",
        }}>
          월별 표는 PC 가계부에서 확인
        </div>
      </div>

      {/* 카드 3: 💳 통장 */}
      <div style={{ marginTop: 12 }}>
        <Card t={t} title="💳 통장" subtitle="baseline + 누적 거래">
          <div style={{ textAlign: "center", padding: "4px 0 10px" }}>
            {cashflowLoading ? (
              <span style={{ fontSize: 12, color: t.textMuted }}>불러오는 중...</span>
            ) : (
              <span className="mono" style={{
                fontSize: 24, fontWeight: 900,
                color: cashflow.current_balance < 0 ? t.danger : t.text,
                fontVariantNumeric: "tabular-nums",
              }}>
                {cashflow.current_balance < 0 ? "−" : ""}{fmtKRW(Math.abs(cashflow.current_balance)).replace("₩", "₩")}
              </span>
            )}
            <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>현재 잔고</div>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            padding: "8px 10px",
            background: t.bgInset, borderRadius: 8,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, marginBottom: 2 }}>이번달 들어온 돈</div>
              <div className="mono" style={{
                fontSize: 13, fontWeight: 800, color: t.success,
                fontVariantNumeric: "tabular-nums",
              }}>+{fmtKRW(cashflow.month_in).replace("₩", "₩")}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, marginBottom: 2 }}>이번달 나간 돈</div>
              <div className="mono" style={{
                fontSize: 13, fontWeight: 800, color: t.danger,
                fontVariantNumeric: "tabular-nums",
              }}>−{fmtKRW(cashflow.month_out).replace("₩", "₩")}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* 카드 4: ✏️ PC 안내 */}
      <div style={{
        marginTop: 12,
        padding: "10px 12px",
        background: t.bgInset, border: `1px dashed ${t.border}`,
        borderRadius: 10,
        fontSize: 11, color: t.textSecondary, textAlign: "center", lineHeight: 1.5,
      }}>
        ✏️ 입력/편집은 PC 가계부에서
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// 작은 부품들 — 모바일 전용
// ────────────────────────────────────────────
function navBtn(t) {
  return {
    background: "transparent", border: `1px solid ${t.border}`,
    borderRadius: 7, padding: "6px 7px",
    color: t.text, cursor: "pointer", display: "flex",
    fontFamily: "inherit",
  };
}

function Card({ t, title, subtitle, children }) {
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
      padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{title}</span>
        {subtitle && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{subtitle}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function Divider({ t }) {
  return <div style={{ height: 1, background: t.border, margin: "2px 0" }}/>;
}

function Row({ t, label, value, color, hint, negative, signed, big, bold, highlight }) {
  const v = Number(value) || 0;
  let display;
  if (signed) {
    display = v === 0 ? "₩0" : (v < 0 ? "−" : "+") + fmtKRW(Math.abs(v)).replace("₩", "₩");
  } else if (negative && v > 0) {
    display = "−" + fmtKRW(v).replace("₩", "₩");
  } else {
    display = fmtKRW(v);
  }
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 8,
      padding: highlight ? "6px 8px" : "2px 0",
      background: highlight ? color + "11" : undefined,
      borderRadius: highlight ? 7 : 0,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
        <span style={{
          fontSize: big ? 12 : bold ? 11.5 : 11,
          fontWeight: (bold || big) ? 800 : 600,
          color: (bold || big) ? t.text : t.textSecondary,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{label}</span>
        {hint && (
          <span style={{ fontSize: 9, color: t.textMuted, fontWeight: 500 }}>{hint}</span>
        )}
      </div>
      <span className="mono" style={{
        fontSize: big ? 18 : 14,
        fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}>{display}</span>
    </div>
  );
}
