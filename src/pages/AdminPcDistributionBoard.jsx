// 2026-06-29 — PC 정산 현황판 (분배 계산).
//
// 사장님 spec:
//   "지금 회사가 나눌 수 있는 돈이 얼마냐"를 한 화면에서 자동 계산.
//   매번 수동 계산 안 하도록 — 숫자는 RPC 분배 산식(Mig 155 v6) 그대로 사용.
//
// 화면 3블록 (선택월 기준):
//   ① 지금 통장에 쥔 현금
//       = 통장 잔고 (baseline + 전체 거래)
//       − 전체 미지급 기사 줄 돈 (Σ b_eng_owed across all 작업월)
//       = 회사 실제 가용 현금
//
//   ② 선택월 분배 대상 = 선택월의 (N-1) 작업분 유솔 받을 회사몫
//       · 독촉 대상 c2_margin (구매확정 O / 회사 미입금) — 유솔 압박
//       · 대기 c1_margin     (구매확정 또는 CSV 매칭 대기)
//       · ⚠️ N월 분배는 (N-1)월 작업분만. N월 작업분은 (N+1) 분배 대상.
//
//   ③ 분배 천장 = ① + ②
//
// 월 스코프 차이 — 헷갈리지 않게 라벨/주석 명시:
//   · ① 현금 블록: 작업월 무관 "현재 통장 + 전체 미지급 차감"
//   · ② 분배 대상 블록: 선택월의 한 달 전 작업분만
//   · ③ 천장: ① + ②
//
// 데이터 출처:
//   · usoln_settle_board_summary(p_actor) → months[] (Mig 155 v6).
//   · bookkeeping_cashflow_summary(p_work_month, p_actor) → current_balance (시점 무관).
//
// 영향: 기존 AdminPcUsolnSettleBoard 무관. RPC 시그니처 보존, 옛 화면 회귀 없음.

import { useEffect, useMemo, useState } from "react";
import { Wallet, RefreshCw, ChevronLeft, ChevronRight, AlertCircle, TrendingUp, Coins, Banknote } from "lucide-react";
import { getUsolnSettleBoardSummary } from "../lib/usolnSettleBoardDb.js";
import { getCashflowSummary } from "../lib/bookkeepingCashflowDb.js";

const fmtKRW = n => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;

// 선택월(YYYY-MM) → 한 달 전 wm
function prevMonthWm(wm) {
  if (!wm) return null;
  const [y, m] = wm.split("-").map(Number);
  if (!y || !m) return null;
  const total = y * 12 + (m - 1) - 1;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export default function AdminPcDistributionBoard({ t, user }) {
  const actor = user?.user_id || user?.userId || user?.id;

  const [summary, setSummary]   = useState({ months: [], start_month: "2026-04" });
  const [cashflow, setCashflow] = useState(null);  // { current_balance, baseline_amount, ... }
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [selectedWm, setSelectedWm] = useState(null);

  // 데이터 로드 — summary 는 selectedWm 결정에 사용, cashflow 는 시점 무관 잔고.
  useEffect(() => {
    if (!actor) { setLoading(false); return; }
    let alive = true;
    setLoading(true); setErr("");
    (async () => {
      // selectedWm 초기값 — 이번 KST 월. 없으면 months 마지막.
      const nowKstYm = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul", year: "numeric", month: "2-digit",
      }).format(new Date()).slice(0, 7);

      const [resSummary, resCashflow] = await Promise.all([
        getUsolnSettleBoardSummary(actor),
        getCashflowSummary(nowKstYm, actor),  // current_balance 만 사용 — workMonth 영향 없음
      ]);

      if (!alive) return;

      if (!resSummary?.ok) {
        setErr(resSummary?.error || "정산판 조회 실패");
        setLoading(false);
        return;
      }
      if (!resCashflow?.ok) {
        setErr(resCashflow?.error || "통장 조회 실패");
        setLoading(false);
        return;
      }

      const monthsList = resSummary.months || [];
      setSummary({
        months: monthsList,
        start_month: resSummary.start_month || "2026-04",
      });
      setCashflow(resCashflow);

      if (!selectedWm && monthsList.length > 0) {
        // 기본 = 이번 KST 월. months 에 없으면 가장 최근 월.
        const matchNow = monthsList.find(x => x.wm === nowKstYm);
        setSelectedWm((matchNow || monthsList[monthsList.length - 1]).wm);
      }

      setLoading(false);
    })().catch(e => {
      if (alive) { setErr(e?.message || "에러"); setLoading(false); }
    });
    return () => { alive = false; };
  }, [actor, reloadTick]);

  // 선택월 + 전/다음 월 결정 (분배 대상은 선택월의 N-1 작업분).
  const { selectedMonth, prevMonth, prevWmTarget, prevPickable, nextPickable } = useMemo(() => {
    const months = summary.months || [];
    if (months.length === 0 || !selectedWm) {
      return { selectedMonth: null, prevMonth: null, prevWmTarget: null, prevPickable: null, nextPickable: null };
    }
    const idx = months.findIndex(x => x.wm === selectedWm);
    const sel = idx >= 0 ? months[idx] : null;

    const prevWm = prevMonthWm(selectedWm);
    const prev   = prevWm ? months.find(x => x.wm === prevWm) || null : null;

    return {
      selectedMonth: sel,
      prevMonth:     prev,
      prevWmTarget:  prevWm,
      prevPickable:  idx > 0 ? months[idx - 1].wm : null,
      nextPickable:  idx >= 0 && idx < months.length - 1 ? months[idx + 1].wm : null,
    };
  }, [summary.months, selectedWm]);

  // 전체 작업월 미지급 기사 줄 돈 합 (① 현금 차감용 — 작업월 무관).
  const totalBEngOwed = useMemo(() => {
    return (summary.months || []).reduce((sum, m) => sum + (Number(m.b_eng_owed) || 0), 0);
  }, [summary.months]);

  const currentBalance = Number(cashflow?.current_balance) || 0;
  const cashNow        = currentBalance - totalBEngOwed;

  // ② 분배 대상 — 선택월의 N-1 작업분 c1+c2 margin (= 유솔이 회사에 줄 돈 중 마진분).
  const c1Margin    = Number(prevMonth?.c1_margin) || 0;
  const c2Margin    = Number(prevMonth?.c2_margin) || 0;
  const incomingTotal = c1Margin + c2Margin;

  // ③ 분배 천장
  const ceiling = cashNow + incomingTotal;

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1100, margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <Wallet size={22} style={{ color: t.accent }}/>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>정산 현황판</div>
        <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>· 분배 계산</div>

        {selectedWm && (
          <MonthPicker t={t}
            wm={selectedWm}
            onPrev={prevPickable ? () => setSelectedWm(prevPickable) : null}
            onNext={nextPickable ? () => setSelectedWm(nextPickable) : null}
          />
        )}

        <div style={{ flex: 1 }}/>
        <button onClick={() => setReloadTick(n => n + 1)} disabled={loading} style={{
          padding: "8px 14px",
          background: "transparent", border: `1px solid ${t.border}`,
          borderRadius: 8, fontSize: 12, fontWeight: 700, color: t.text,
          cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <RefreshCw size={13} style={{ opacity: loading ? 0.5 : 1 }}/>
          새로고침
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
          불러오는 중...
        </div>
      ) : err ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: t.danger, fontSize: 13 }}>
          ⚠️ {err}
        </div>
      ) : selectedMonth ? (
        <DistributionLayout
          t={t}
          selectedWm={selectedWm}
          prevWmTarget={prevWmTarget}
          prevMonthExists={!!prevMonth}
          currentBalance={currentBalance}
          totalBEngOwed={totalBEngOwed}
          cashNow={cashNow}
          c1Margin={c1Margin}
          c2Margin={c2Margin}
          incomingTotal={incomingTotal}
          ceiling={ceiling}
          baselineAmount={Number(cashflow?.baseline_amount) || 0}
        />
      ) : (
        <div style={{ padding: "60px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
          데이터 없음
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// MonthPicker
// ──────────────────────────────────────────────────────────
function MonthPicker({ t, wm, onPrev, onNext }) {
  const [y, m] = String(wm).split("-").map(Number);
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 6px",
      background: t.bgInset, border: `1px solid ${t.border}`,
      borderRadius: 999,
    }}>
      <button onClick={onPrev} disabled={!onPrev} aria-label="이전 달" style={pickerBtnStyle(t, !!onPrev)}>
        <ChevronLeft size={14}/>
      </button>
      <span style={{
        fontSize: 13, fontWeight: 800, color: t.text,
        padding: "0 10px", letterSpacing: "-0.2px",
      }}>{y}년 {m}월 분배</span>
      <button onClick={onNext} disabled={!onNext} aria-label="다음 달" style={pickerBtnStyle(t, !!onNext)}>
        <ChevronRight size={14}/>
      </button>
    </div>
  );
}
function pickerBtnStyle(t, enabled) {
  return {
    background: "transparent", border: "none",
    padding: 4, borderRadius: 999,
    cursor: enabled ? "pointer" : "not-allowed",
    color: enabled ? t.text : t.textMuted,
    opacity: enabled ? 1 : 0.4,
    display: "inline-flex", alignItems: "center", fontFamily: "inherit",
  };
}

// ──────────────────────────────────────────────────────────
// DistributionLayout — 3 블록 세로
// ──────────────────────────────────────────────────────────
function DistributionLayout({
  t, selectedWm, prevWmTarget, prevMonthExists,
  currentBalance, totalBEngOwed, cashNow,
  c1Margin, c2Margin, incomingTotal, ceiling, baselineAmount,
}) {
  const prevYM = prevWmTarget ? prevWmTarget.split("-").map(Number) : [null, null];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* 블록 ① — 지금 통장에 쥔 현금 */}
      <Card t={t} icon={<Banknote size={16}/>} title="① 지금 통장에 쥔 현금" subtitle="작업월 무관 · 현재 시점">
        <FlowRow t={t} label="통장 잔고 (baseline + 거래)" amount={currentBalance}/>
        <FlowRow t={t} label="− 미지급 기사 줄 돈 (전체 작업월 합)" amount={totalBEngOwed} negative/>
        <FlowRow t={t} label="= 회사 실제 가용 현금" amount={cashNow} green bold large sumBorder/>

        <Hint t={t}>
          · 통장 잔고는 작업월에 무관한 baseline + 모든 거래 합산.<br/>
          · 미지급 기사 줄 돈은 받음(company_received_at NOT NULL) · 기사 미지급(engineer_settled_at IS NULL) 합 — 작업월 전부.<br/>
          {baselineAmount > 0 && (
            <span>· baseline 갱신값: {fmtKRW(baselineAmount)}.</span>
          )}
        </Hint>
      </Card>

      {/* 블록 ② — 선택월 분배 대상 (= N-1 작업분 유솔 받을 회사몫) */}
      <Card t={t}
        icon={<TrendingUp size={16}/>}
        title={`② ${prevYM[0] ? `${prevYM[0]}년 ${prevYM[1]}월` : "이전 달"} 작업분 — 유솔 받을 회사 마진`}
        subtitle={`${selectedWm.split("-")[1]}월 분배 대상 (N−1 작업분만)`}
      >
        {prevMonthExists ? (
          <>
            <FlowRow t={t} label="독촉 대상 (구매확정 O · 회사 미입금)" amount={c2Margin}/>
            <FlowRow t={t} label="대기 (구매확정 또는 CSV 매칭 대기)" amount={c1Margin}/>
            <FlowRow t={t} label="= 유솔 받을 회사 마진 합" amount={incomingTotal} green bold large sumBorder/>

            <Hint t={t}>
              · 독촉(c2): 구매확정 O · 회사 미입금 → 유솔에 입금 요청.<br/>
              · 대기(c1): 구매확정 또는 유솔 CSV 매칭 전 → 자연 풀림 대기.<br/>
              · 회사 마진은 분배 산식 _excl_extra (Mig 155 v6 동일).
            </Hint>
          </>
        ) : (
          <div style={{ padding: "20px 14px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
            {prevYM[0] ? `${prevYM[0]}년 ${prevYM[1]}월` : "이전 달"} 데이터 없음 (분배 대상 0).
          </div>
        )}
      </Card>

      {/* 블록 ③ — 분배 천장 */}
      <Card t={t}
        icon={<Coins size={16}/>}
        title="③ 분배 천장"
        subtitle="이번 분배에서 나눌 수 있는 최대"
        emphasize
      >
        <FlowRow t={t} label="① 지금 쥔 현금" amount={cashNow}/>
        <FlowRow t={t} label="+ ② 유솔 받을 회사 마진 합" amount={incomingTotal}/>
        <FlowRow t={t} label="= 분배 천장" amount={ceiling} green bold large sumBorder/>

        <Hint t={t}>
          · 이 금액을 초과해 분배하면 통장 마이너스 위험.<br/>
          · ② 가 들어오는 시점은 유솔 입금 시점에 달림 — 즉시 가용은 ① 만큼.
        </Hint>
      </Card>

      {/* 푸터 — 산식 출처 */}
      <div style={{
        marginTop: 4,
        padding: "10px 14px",
        background: t.bgInset, border: `1px dashed ${t.border}`, borderRadius: 7,
        fontSize: 11, color: t.textMuted, lineHeight: 1.7,
      }}>
        · 분배 산식: Mig 155 v6 — 정산판 v5 item_alloc 동일 (_excl_extra).<br/>
        · 보증금 2,000만은 통장 외 자산 — 위 계산에 들어가지 않음 (운영 정책).<br/>
        · 통장 baseline 갱신은 운영자가 SQL 로 수동 — 갱신 후 새로고침.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Card — 한 블록 외곽
// ──────────────────────────────────────────────────────────
function Card({ t, icon, title, subtitle, emphasize, children }) {
  return (
    <div style={{
      background: t.bgElevated,
      border: `${emphasize ? 1.5 : 1}px solid ${emphasize ? t.accent : t.border}`,
      borderRadius: 14, overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 18px",
        borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", gap: 10,
        background: emphasize ? (t.accentBg || "rgba(255,27,141,0.05)") : "transparent",
      }}>
        <span style={{ color: emphasize ? t.accent : t.textSecondary, display: "inline-flex" }}>{icon}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
          <div style={{
            fontSize: 14, fontWeight: 900, color: t.text, letterSpacing: "-0.2px",
          }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>{subtitle}</div>
          )}
        </div>
      </div>
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 2 }}>
        {children}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// FlowRow — 라벨/금액 한 줄
// ──────────────────────────────────────────────────────────
function FlowRow({ t, label, amount, negative, green, bold, large, sumBorder }) {
  const v = Number(amount) || 0;
  let display;
  if (negative && v > 0) display = "−" + fmtKRW(v);
  else if (v < 0)        display = "−" + fmtKRW(Math.abs(v));
  else                   display = fmtKRW(v);

  const amtColor = v < 0 ? t.danger
                : negative ? t.danger
                : green ? t.success
                : t.text;

  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 14,
      padding: large ? "12px 4px" : "8px 4px",
      borderTop: sumBorder ? `1.5px solid ${t.border}` : "none",
      marginTop: sumBorder ? 4 : 0,
    }}>
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: large ? 14 : (bold ? 13 : 12.5),
        fontWeight: large ? 900 : (bold ? 800 : 600),
        color: t.text,
        letterSpacing: "-0.2px",
      }}>{label}</span>
      <span style={{
        fontSize: large ? 22 : (bold ? 18 : 16),
        fontWeight: large ? 900 : (bold ? 800 : 700),
        color: amtColor,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        letterSpacing: "-0.3px",
      }}>{display}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Hint — 하단 작은 설명
// ──────────────────────────────────────────────────────────
function Hint({ t, children }) {
  return (
    <div style={{
      marginTop: 8, padding: "8px 10px",
      background: t.bgInset, borderRadius: 7,
      fontSize: 11, color: t.textMuted, lineHeight: 1.7,
    }}>
      <AlertCircle size={11} style={{ marginRight: 4, verticalAlign: "-1px", display: "inline-block" }}/>
      {children}
    </div>
  );
}
