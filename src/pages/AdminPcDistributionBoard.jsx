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
// 데이터 출처:
//   · usoln_settle_board_summary(p_actor) → months[] (Mig 155 v6).
//   · bookkeeping_cashflow_summary(p_work_month, p_actor) → current_balance (시점 무관).
//
// 2026-06-29 r2 — 디자인 개선 (사장님 spec):
//   계산 로직 0건 변경 — 레이아웃·스타일만.
//   weight 400/500 만, 핵심 숫자 30~38px, 색 토큰(success/danger/warning/accent) 사용.
//   각주 줄이고 한 줄 계산식으로 통합. ③ 분배 천장 주인공 — 가운데 정렬 + 강조.

import { useEffect, useMemo, useState } from "react";
import { Wallet, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { getUsolnSettleBoardSummary } from "../lib/usolnSettleBoardDb.js";
import { getCashflowSummary } from "../lib/bookkeepingCashflowDb.js";

// 금액 포맷 — 천단위 콤마. 음수면 "− ₩x".
function fmtKRW(n) {
  const v = Number(n) || 0;
  if (v < 0) return `− ₩${Math.abs(v).toLocaleString("ko-KR")}`;
  return `₩${v.toLocaleString("ko-KR")}`;
}

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
    <div style={{ padding: "20px 24px 40px", maxWidth: 880, margin: "0 auto" }}>
      {/* 헤더 — weight 500 통일 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <Wallet size={20} style={{ color: t.accent }}/>
        <div style={{
          fontSize: 18, fontWeight: 500, color: t.text, letterSpacing: "-0.4px",
        }}>정산 현황판</div>
        <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 400 }}>· 분배 계산</div>

        {selectedWm && (
          <MonthPicker t={t}
            wm={selectedWm}
            onPrev={prevPickable ? () => setSelectedWm(prevPickable) : null}
            onNext={nextPickable ? () => setSelectedWm(nextPickable) : null}
          />
        )}

        <div style={{ flex: 1 }}/>
        <button onClick={() => setReloadTick(n => n + 1)} disabled={loading} style={{
          padding: "7px 12px",
          background: "transparent", border: `0.5px solid ${t.border}`,
          borderRadius: 8, fontSize: 12, fontWeight: 500, color: t.textSecondary,
          cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <RefreshCw size={12} style={{ opacity: loading ? 0.5 : 1 }}/>
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
// MonthPicker — ◀ YYYY년 M월 분배 ▶
// ──────────────────────────────────────────────────────────
function MonthPicker({ t, wm, onPrev, onNext }) {
  const [y, m] = String(wm).split("-").map(Number);
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 6px",
      background: t.bgInset, border: `0.5px solid ${t.border}`,
      borderRadius: 999,
    }}>
      <button onClick={onPrev} disabled={!onPrev} aria-label="이전 달" style={pickerBtnStyle(t, !!onPrev)}>
        <ChevronLeft size={13}/>
      </button>
      <span style={{
        fontSize: 12.5, fontWeight: 500, color: t.text,
        padding: "0 10px", letterSpacing: "-0.2px",
      }}>{y}년 {m}월 분배</span>
      <button onClick={onNext} disabled={!onNext} aria-label="다음 달" style={pickerBtnStyle(t, !!onNext)}>
        <ChevronRight size={13}/>
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
// DistributionLayout — 3 카드 세로 + 푸터
// ──────────────────────────────────────────────────────────
function DistributionLayout({
  t, selectedWm, prevWmTarget, prevMonthExists,
  currentBalance, totalBEngOwed, cashNow,
  c1Margin, c2Margin, incomingTotal, ceiling,
}) {
  const prevYM = prevWmTarget ? prevWmTarget.split("-").map(Number) : [null, null];
  const prevMonthLabel = prevYM[1] ? `${prevYM[1]}월 작업분` : "이전 달 작업분";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ① 지금 회사가 쥔 현금 */}
      <CardPlain t={t}>
        <HeadlineRow
          t={t}
          label="① 지금 회사가 쥔 현금"
          value={cashNow}
          valueColor={cashNow < 0 ? t.danger : t.success}
        />
        <SubLine t={t}>
          통장 {fmtKRW(currentBalance)} − 기사 줄 돈 {fmtKRW(totalBEngOwed)}
        </SubLine>
      </CardPlain>

      {/* ② 유솔한테 받을 회사 몫 (N-1 작업분) */}
      <CardPlain t={t}>
        <HeadlineRow
          t={t}
          label="② 유솔한테 받을 회사 몫"
          sublabel={prevMonthLabel}
          value={incomingTotal}
          valueColor={t.text}
        />
        {prevMonthExists ? (
          <SplitTwo t={t}
            left={{
              title: "독촉",
              note: "유솔이 입금만 안 함",
              value: c2Margin,
              fg: t.danger,
              bg: "rgba(255,68,68,0.10)",
              border: "rgba(255,68,68,0.28)",
            }}
            right={{
              title: "대기",
              note: "진행 중",
              value: c1Margin,
              fg: "#B45309",   // warning fg fallback
              bg: "rgba(245,158,11,0.12)",
              border: "rgba(245,158,11,0.30)",
            }}
          />
        ) : (
          <SubLine t={t}>{prevMonthLabel} 데이터 없음 (분배 대상 0).</SubLine>
        )}
      </CardPlain>

      {/* ③ 분배 천장 — 주인공 */}
      <CardAccent t={t}>
        <div style={{
          fontSize: 14, fontWeight: 500,
          color: t.accent, letterSpacing: "-0.3px",
          opacity: 0.95,
        }}>③ 이번에 나눌 수 있는 최대</div>
        <div style={{
          marginTop: 8,
          fontSize: 38, fontWeight: 500,
          color: ceiling < 0 ? t.danger : t.accent,
          letterSpacing: "-1.2px",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}>{fmtKRW(ceiling)}</div>
        <div style={{
          marginTop: 10,
          fontSize: 12, fontWeight: 400,
          color: t.accent, opacity: 0.7,
          letterSpacing: "-0.2px",
        }}>
          ① {fmtKRW(cashNow)} + ② {fmtKRW(incomingTotal)} · 유솔 입금 들어오면 채워짐
        </div>
      </CardAccent>

      {/* 푸터 — 한 줄 */}
      <div style={{
        marginTop: 2,
        fontSize: 12, fontWeight: 400,
        color: t.textMuted, lineHeight: 1.6,
        letterSpacing: "-0.2px",
        textAlign: "center",
      }}>
        보증금 2,000만은 통장 밖 자산이라 위 계산에서 뺐다. baseline 갱신은 운영자가 수동.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// CardPlain — 흰 배경 카드 (radius 12 / 0.5px 보더)
// ──────────────────────────────────────────────────────────
function CardPlain({ t, children }) {
  return (
    <div style={{
      background: t.bgElevated,
      border: `0.5px solid ${t.border}`,
      borderRadius: 12,
      padding: "18px 20px",
    }}>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// CardAccent — 강조 배경 카드 (③ 천장 전용)
// ──────────────────────────────────────────────────────────
function CardAccent({ t, children }) {
  return (
    <div style={{
      background: t.accentBg || "rgba(255,27,141,0.08)",
      border: `0.5px solid ${t.accent}`,
      borderRadius: 12,
      padding: "22px 20px 20px",
      textAlign: "center",
    }}>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// HeadlineRow — 좌측 라벨(작게) + 우측 큰 숫자
// ──────────────────────────────────────────────────────────
function HeadlineRow({ t, label, sublabel, value, valueColor }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 14, fontWeight: 500, color: t.textSecondary,
          letterSpacing: "-0.3px",
        }}>{label}</span>
        {sublabel && (
          <span style={{
            fontSize: 12, fontWeight: 400, color: t.textMuted,
            letterSpacing: "-0.2px",
          }}>· {sublabel}</span>
        )}
      </div>
      <span style={{
        fontSize: 30, fontWeight: 500,
        color: valueColor || t.text,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.8px",
        whiteSpace: "nowrap",
        lineHeight: 1.1,
      }}>{fmtKRW(value)}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// SubLine — 카드 안쪽 얇은 구분선 + 작은 한 줄 설명
// ──────────────────────────────────────────────────────────
function SubLine({ t, children }) {
  return (
    <>
      <div style={{
        height: 1, background: t.border, opacity: 0.6,
        margin: "14px -20px 12px",
      }}/>
      <div style={{
        fontSize: 12, fontWeight: 400, color: t.textMuted,
        letterSpacing: "-0.2px", lineHeight: 1.6,
        fontVariantNumeric: "tabular-nums",
      }}>{children}</div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// SplitTwo — 2칸 색 박스 (독촉 / 대기)
// ──────────────────────────────────────────────────────────
function SplitTwo({ t, left, right }) {
  return (
    <>
      <div style={{
        height: 1, background: t.border, opacity: 0.6,
        margin: "14px -20px 12px",
      }}/>
      <div style={{ display: "flex", gap: 10 }}>
        <SplitCell t={t} cell={left}/>
        <SplitCell t={t} cell={right}/>
      </div>
    </>
  );
}

function SplitCell({ t, cell }) {
  return (
    <div style={{
      flex: 1,
      background: cell.bg,
      border: `0.5px solid ${cell.border}`,
      borderRadius: 10,
      padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{
          fontSize: 13, fontWeight: 500, color: cell.fg,
          letterSpacing: "-0.2px",
        }}>{cell.title}</span>
        <span style={{
          fontSize: 11, fontWeight: 400, color: t.textMuted,
          letterSpacing: "-0.2px",
        }}>{cell.note}</span>
      </div>
      <span style={{
        fontSize: 20, fontWeight: 500, color: cell.fg,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.5px",
        lineHeight: 1.2,
      }}>{fmtKRW(cell.value)}</span>
    </div>
  );
}
