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
import { ArrowLeft, ChevronLeft, ChevronRight, Wallet, Plus, Minus, Edit3, Trash2, X, Save } from "lucide-react";
import {
  listExpenses, listDistributions,
  getUsolNTrackBMargin, getCumulativeCarryover,
} from "../lib/bookkeepingDb.js";
import { listOtherIncome } from "../lib/bookkeepingOtherIncomeDb.js";
import { getUsolnAdjustment } from "../lib/bookkeepingUsolnAdjustmentDb.js";
import {
  getCashflowSummary, listCashflow, addCashflow, updateCashflow, deleteCashflow,
} from "../lib/bookkeepingCashflowDb.js";
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
function fmtAmountInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}
function parseAmount(s) {
  return Number(String(s || "").replace(/\D/g, "")) || 0;
}

// ────────────────────────────────────────────
// 본체
// ────────────────────────────────────────────
export default function AdminMobileBookkeeping({ t, user, apiTasks = [], onBack }) {
  const [selectedYm, setSelectedYm] = useState(nowKstYm());
  // 2026-06-14 — 화면 상단 토글: 'bookkeeping'(손익+누적이월, 읽기전용) | 'cashflow'(통장, 입력 가능)
  const [view, setView] = useState("bookkeeping");
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

  // ── 통장 요약 (Mig 122) + 거래 목록 (모바일에서 입력 가능 — 유일하게)
  const [cashflow, setCashflow] = useState({ month_in: 0, month_out: 0, current_balance: 0, baseline_amount: 0 });
  const [cashflowLoading, setCashflowLoading] = useState(false);
  const [cashflowRows, setCashflowRows] = useState([]);
  const [cashflowListLoading, setCashflowListLoading] = useState(false);
  const [cfReloadTick, setCfReloadTick] = useState(0);   // 거래 추가/편집/삭제 시 ++
  const [cfDialog, setCfDialog] = useState(null);         // { mode:'add'|'edit'|'delete', direction?, row? }
  const [cfListOpen, setCfListOpen] = useState(false);    // 거래 목록 접기/펼치기 (default 접힘)
  useEffect(() => {
    if (!actor) return;
    let alive = true;
    setCashflowLoading(true);
    setCashflowListLoading(true);
    (async () => {
      const [resSum, resList] = await Promise.all([
        getCashflowSummary(selectedYm, actor),
        listCashflow(selectedYm, actor),
      ]);
      if (!alive) return;
      if (resSum?.ok) {
        setCashflow({
          month_in:        Number(resSum.month_in)        || 0,
          month_out:       Number(resSum.month_out)       || 0,
          current_balance: Number(resSum.current_balance) || 0,
          baseline_amount: Number(resSum.baseline_amount) || 0,
        });
      }
      setCashflowRows(resList?.ok ? (resList.rows || []) : []);
      setCashflowLoading(false);
      setCashflowListLoading(false);
    })().catch(() => {
      if (alive) { setCashflowLoading(false); setCashflowListLoading(false); }
    });
    return () => { alive = false; };
  }, [selectedYm, actor, cfReloadTick]);

  // ── 합산 계산
  const incomeTotal = incomeTrackA + usolNTotal + otherIncomeSum;
  const netProfit   = incomeTotal - expenseSum;
  const monthlyDiff = netProfit - distSum;
  const cumValue    = Number(cum.cumulative_carryover) || 0;
  const cumNeg      = cumValue < 0;

  return (
    <div style={{ padding: "12px 14px 24px" }}>
      {/* 헤더 — 뒤로가기 + 제목 + view 별 상태 */}
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
        <span style={{ fontSize: 10, color: t.textMuted }}>
          {view === "bookkeeping" ? "읽기 전용" : "입력 가능"}
        </span>
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

      {/* 가계부 view — 손익 + 누적이월 (읽기 전용) */}
      {view === "bookkeeping" && <>
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
      </>}

      {/* 통장 view — 입출금 가능 */}
      {view === "cashflow" && <>
      {/* 카드 3: 💳 통장 — 모바일에서 입력 가능한 유일한 카드 */}
      <div>
        <Card t={t} title="💳 통장" subtitle="입출금 추가/편집 가능 (baseline 은 PC)">
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

          {/* + 입금 / + 출금 버튼 */}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => setCfDialog({ mode: "add", direction: "in", row: null })} style={{
              flex: 1, padding: "10px 12px",
              background: t.success, color: "#fff", border: "none", borderRadius: 8,
              fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}>
              <Plus size={13} strokeWidth={2.8}/>
              입금
            </button>
            <button onClick={() => setCfDialog({ mode: "add", direction: "out", row: null })} style={{
              flex: 1, padding: "10px 12px",
              background: t.danger, color: "#fff", border: "none", borderRadius: 8,
              fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}>
              <Minus size={13} strokeWidth={2.8}/>
              출금
            </button>
          </div>

          {/* 거래 목록 토글 */}
          {cashflowRows.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <button onClick={() => setCfListOpen(o => !o)} style={{
                width: "100%", padding: "8px 10px",
                background: "transparent", border: `1px solid ${t.border}`, borderRadius: 7,
                fontSize: 11, fontWeight: 700, color: t.textMuted,
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}>
                {cfListOpen ? "▾" : "▸"} 이번달 거래 {cashflowRows.length}건
              </button>

              {cfListOpen && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  {cashflowListLoading ? (
                    <div style={{ padding: "10px", textAlign: "center", color: t.textMuted, fontSize: 11 }}>
                      불러오는 중...
                    </div>
                  ) : (
                    cashflowRows.map(r => (
                      <CashflowMobileRow key={r.id} t={t} row={r}
                        onEdit={() => setCfDialog({ mode: "edit", direction: r.direction, row: r })}
                        onDelete={() => setCfDialog({ mode: "delete", row: r })}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      </>}

      {/* 통장 거래 다이얼로그 (view 와 무관하게 cfDialog 열려있으면 표시) */}
      {cfDialog?.mode === "add" && (
        <CashflowDialog t={t} mode="add"
          actor={actor}
          direction={cfDialog.direction}
          defaultDate={kstYmd()}
          onClose={() => setCfDialog(null)}
          onSaved={() => { setCfDialog(null); setCfReloadTick(n => n + 1); setCfListOpen(true); }}
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

      {/* PC 안내 footer — view 별 다른 문구 */}
      <div style={{
        marginTop: 12,
        padding: "10px 12px",
        background: t.bgInset, border: `1px dashed ${t.border}`,
        borderRadius: 10,
        fontSize: 11, color: t.textSecondary, textAlign: "center", lineHeight: 1.5,
      }}>
        {view === "bookkeeping"
          ? "✏️ 운영비 · 분배 · 기타 수입 등 입력은 PC 가계부에서"
          : "✏️ 기준 잔고(baseline) 설정은 PC 통장에서"}
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

// ────────────────────────────────────────────
// 통장 거래 행 (모바일)
// ────────────────────────────────────────────
function CashflowMobileRow({ t, row, onEdit, onDelete }) {
  const isIn = row.direction === "in";
  const dateShort = (row.flow_date || "").slice(5); // "MM-DD"
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "44px 1fr 28px 28px",
      gap: 6, alignItems: "center",
      padding: "8px 8px",
      background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 7,
    }}>
      <span style={{ fontSize: 10, color: t.textMuted, fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
        {dateShort}
      </span>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span className="mono" style={{
          fontSize: 12, fontWeight: 800,
          color: isIn ? t.success : t.danger,
          fontVariantNumeric: "tabular-nums",
        }}>
          {isIn ? "+" : "−"}{fmtKRW(row.amount).replace("₩", "₩")}
        </span>
        <span style={{
          fontSize: 10, color: t.textSecondary,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {row.memo || "—"}
        </span>
      </div>
      <button onClick={onEdit} title="편집" style={iconBtnSm(t)}>
        <Edit3 size={11}/>
      </button>
      <button onClick={onDelete} title="삭제" style={{ ...iconBtnSm(t), color: t.danger }}>
        <Trash2 size={11}/>
      </button>
    </div>
  );
}

function iconBtnSm(t) {
  return {
    padding: "4px 5px",
    background: "transparent", border: `1px solid ${t.border}`,
    color: t.textSecondary, borderRadius: 5,
    cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontFamily: "inherit",
  };
}

// ────────────────────────────────────────────
// 통장 거래 추가/편집 다이얼로그 (모바일, 380px 최적화)
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
            placeholder="예: 유솔 입금 / 식대"
            style={inputStyle(t)}
          />
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
            {isIn ? "+" : "−"}{fmtKRW(row.amount).replace("₩", "₩")}
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
