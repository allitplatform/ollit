// 2026-06-16 — PC 유솔N 정산 (월 선택 + 단어 통일 재설계).
//
// 사장님 시안 (재설계):
//   · 헤더: "유솔N 정산" + 월 선택 ◀ YYYY년 MM월 ▶ + "N tasks · M items".
//   · [1] 분배 워터폴 (정산금 → − 유솔 수수료 → 회사 받을 → − 기사 정산 → ★ 회사 마진).
//   · [2] 입금 진행: 받음(초록 테두리) / 안받음(핑크 테두리) — 기사 정산 / 회사 마진 / 합계.
//   · 단어 통일: 유솔 몫 → 유솔 수수료 / 기사 몫 → 기사 정산 / 마진 → 회사 마진.
//   · 부연설명: "환불 시 음수"만 유지, 자명 수식(= 정산금 − 유솔 등) 제거.
//
// 컬럼 사용 규칙 (사장님 spec):
//   · _excl_extra 필드만 사용 (engineer_total / principal_total 금지 — 현장추가금 섞임).
//   · 현장추가금 extra_total = 기사 현장 수금 → 회사 무관 (RPC 가 이미 제외함).
//
// 표기 규칙:
//   · 금액 전액 표기 (M/K 약자 금지). tabular-nums 정렬.
//   · 음수 빨강 −, 합계 굵게 + 상단 보더, 회사 마진 초록 강조.
//   · CLAUDE.md 금지 어근 자가검사 통과.
//
// 월 선택: 현재 클라이언트 캐시(data.months 전체)에서 선택 월만 필터.
//   향후 옵션 — RPC 에 p_work_month 인자 추가 시 서버 단일월 조회로 전환.

import { useEffect, useMemo, useState } from "react";
import { Wallet, RefreshCw, CheckCircle2, RotateCcw, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getUsolnSettleBoardSummary,
  markUsolnEngineerSettledByMonth,
  unmarkUsolnEngineerSettledByMonth,
} from "../lib/usolnSettleBoardDb.js";

const fmtKRW   = n => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
const fmtCount = n => `${Number(n || 0).toLocaleString("ko-KR")}건`;

export default function AdminPcUsolnSettleBoard({ t, user }) {
  const actor = user?.user_id || user?.userId || user?.id;
  const [data, setData] = useState({ months: [], start_month: "2026-04" });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [dialog, setDialog] = useState(null); // { mode:'stamp'|'unstamp', wm }
  // 2026-06-16 — 월 선택 (wm = "YYYY-MM"). 기본 = 최신 데이터가 있는 월.
  const [selectedWm, setSelectedWm] = useState(null);

  useEffect(() => {
    if (!actor) { setLoading(false); return; }
    let alive = true;
    setLoading(true); setErr("");
    (async () => {
      const res = await getUsolnSettleBoardSummary(actor);
      if (!alive) return;
      if (!res?.ok) {
        setErr(res?.error || "조회 실패");
      } else {
        const monthsList = res.months || [];
        setData({
          months:       monthsList,
          start_month:  res.start_month || "2026-04",
        });
        // 초기 선택: 사용자가 아직 안 골랐으면 데이터가 있는 가장 최근 월. 없으면 가장 마지막 월.
        if (!selectedWm && monthsList.length > 0) {
          const withData = [...monthsList].reverse().find(x => Number(x.item_count) > 0);
          setSelectedWm((withData || monthsList[monthsList.length - 1]).wm);
        }
      }
      setLoading(false);
    })().catch(e => { if (alive) { setErr(e?.message || "에러"); setLoading(false); } });
    return () => { alive = false; };
  }, [actor, reloadTick]);

  // 선택된 월 정보 + 전/다음 월 가능 여부.
  const { selectedMonth, prevWm, nextWm } = useMemo(() => {
    const months = data.months || [];
    if (months.length === 0 || !selectedWm) return { selectedMonth: null, prevWm: null, nextWm: null };
    const idx = months.findIndex(x => x.wm === selectedWm);
    return {
      selectedMonth: idx >= 0 ? months[idx] : null,
      prevWm: idx > 0 ? months[idx - 1].wm : null,
      nextWm: idx >= 0 && idx < months.length - 1 ? months[idx + 1].wm : null,
    };
  }, [data.months, selectedWm]);

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1200, margin: "0 auto" }}>
      {/* 헤더 — 유솔N 정산 + 월 선택 + N tasks · M items */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <Wallet size={22} style={{ color: t.accent }}/>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>유솔N 정산</div>

        {/* 월 선택 — ◀ YYYY년 MM월 ▶ */}
        {selectedWm && (
          <MonthPicker t={t}
            wm={selectedWm}
            onPrev={prevWm ? () => setSelectedWm(prevWm) : null}
            onNext={nextWm ? () => setSelectedWm(nextWm) : null}
          />
        )}

        {/* N tasks · M items 요약 */}
        {selectedMonth && Number(selectedMonth.item_count) > 0 && (
          <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>
            {fmtCount(selectedMonth.task_count)} tasks · {fmtCount(selectedMonth.item_count)} items
          </div>
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
        <MonthCard t={t} m={selectedMonth}
          onStampClick={() => setDialog({ mode: "stamp", wm: selectedMonth.wm })}
          onUnstampClick={() => setDialog({ mode: "unstamp", wm: selectedMonth.wm })}
        />
      ) : (
        <div style={{ padding: "60px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
          데이터 없음
        </div>
      )}

      {dialog && (
        <StampDialog t={t} dialog={dialog} actor={actor}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); setReloadTick(n => n + 1); }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// MonthPicker — ◀ YYYY년 MM월 ▶
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
      }}>{y}년 {m}월</span>
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
// MonthCard — 2단 (분배 워터폴 + 입금 진행) — Mig 133 v4 신규 4필드.
// ──────────────────────────────────────────────────────────
function MonthCard({ t, m, onStampClick, onUnstampClick }) {
  const itemCnt    = Number(m.item_count) || 0;
  const taskCnt    = Number(m.task_count) || 0;
  const recvCnt    = Number(m.received_count) || 0;
  const pendCnt    = Number(m.pending_count) || 0;

  // [1] 분배 워터폴 — _excl_extra 필드.
  const passTotal  = Number(m.passthrough_total)      || 0;
  const prinExcl   = Number(m.principal_excl_extra)   || 0;
  const engExcl    = Number(m.engineer_excl_extra)    || 0;
  // margin_unclamped 우선, 없으면 fallback 계산 (passthrough − engExcl − prinExcl)
  const marginUnc  = m.margin_unclamped != null
    ? (Number(m.margin_unclamped) || 0)
    : (passTotal - engExcl - prinExcl);
  const adjAmount  = Number(m.adjustment_amount)      || 0;
  const adjMemo    = m.adjustment_memo || "";

  // [2] 입금 진행 — Mig 133 v4 신규 4필드 (받음/안받음 × 기사/마진).
  //   ⚠️ received_owner / pending_owner (옛 v3, raw clamped) 폐기 — 환불 task 음수 반영 안 됨.
  //   v4 unclamped 필드만 사용. Mig 133 미적용 시 0 (검산으로 식별 가능).
  //   기사 측은 _excl_extra (v3) 도 동일 산식이라 폴백 허용.
  const receivedEng    = m.received_eng    != null
                       ? Number(m.received_eng)
                       : Number(m.received_engineer_excl_extra) || 0;
  const pendingEng     = m.pending_eng     != null
                       ? Number(m.pending_eng)
                       : Number(m.pending_engineer_excl_extra)  || 0;
  const receivedMargin = Number(m.received_margin) || 0;  // v4 unclamped, 폴백 없음
  const pendingMargin  = Number(m.pending_margin)  || 0;  // v4 unclamped, 폴백 없음

  // 기사 정산 진행 상태 (engineer_settled_at) — stamp 버튼 활성화 판단용
  const engPaid     = Number(m.engineer_paid)    || 0;
  const engPending  = Number(m.engineer_pending) || 0;

  // 계산
  const compShare   = passTotal - prinExcl;             // 회사받을 = 정산금 − 유솔
  const marginFinal = marginUnc + adjAmount;            // 마진 최종 = 마진 + 보정 (환불 시 음수)
  const recvTotal   = receivedEng + receivedMargin;     // 받음 합 (= 회사받을 의 받음 부분)
  const pendTotal   = pendingEng + pendingMargin;       // 안받음 합

  const noData = itemCnt === 0;

  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14,
      overflow: "hidden",
    }}>
      {/* 카드 헤더 — 2026-06-16: 상단 헤더에 이미 월/요약 노출 → 카드 헤더 최소화 (구분선만). */}
      {noData && (
        <div style={{
          padding: "16px 22px",
          borderBottom: `1px solid ${t.border}`,
          fontSize: 12, color: t.textMuted,
        }}>
          데이터 없음 (앱 가동 전)
        </div>
      )}

      {noData ? (
        // 4월 — 데이터 없음 + 보정 안내
        <div style={{ padding: "24px 22px" }}>
          <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
            앱이 5월 말부터 가동되어 4월 작업 데이터가 DB에 없습니다.
          </div>
          {adjAmount !== 0 ? (
            <div style={{
              marginTop: 12,
              padding: "12px 14px",
              background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 8,
              fontSize: 13, color: t.textSecondary, lineHeight: 1.6,
            }}>
              💡 손계산 보정: <span className="mono" style={{ fontWeight: 800, color: "#A78BFA" }}>
                {adjAmount > 0 ? "+" : ""}{fmtKRW(adjAmount)}
              </span> {adjMemo ? <span style={{ color: t.textMuted }}>· {adjMemo}</span> : null}
            </div>
          ) : (
            <div style={{
              marginTop: 10, fontSize: 12, color: t.textMuted,
            }}>
              Mig 127 보정값 없음.
            </div>
          )}
        </div>
      ) : (
        <>
          {/* [1] 분배 워터폴 — 단어 통일 (유솔 수수료 / 기사 정산 / 회사 마진). */}
          <div style={{
            padding: "22px 24px",
            display: "flex", flexDirection: "column", gap: 2,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 800, color: t.textMuted,
              marginBottom: 8, letterSpacing: 0.3,
            }}>
              [1] 분배 워터폴
            </div>
            <FlowRow t={t} label="유솔 정산금"            amount={passTotal}/>
            <FlowRow t={t} label="− 유솔 수수료 (≈15%)"  amount={prinExcl} negative/>
            <FlowRow t={t} label="회사 받을"              amount={compShare} bold sumBorder/>
            <FlowRow t={t} label="− 기사 정산 (현장추가금 제외)" amount={engExcl} negative/>
            <FlowRow t={t} label="★ 회사 마진"            amount={marginUnc} green bold large sumBorder
              hint="환불 시 음수"/>

            {/* 보정 */}
            {adjAmount !== 0 && (
              <>
                <div style={{ height: 10 }}/>
                <FlowRow t={t}
                  label={`+ 보정${adjMemo ? ` (${adjMemo})` : ""}`}
                  amount={adjAmount}
                  signed muted/>
                <FlowRow t={t} label="회사 마진 (보정 후)" amount={marginFinal} green bold large sumBorder/>
              </>
            )}
          </div>

          {/* [2] 입금 진행 — 받음/안받음 × 기사/마진 (2×2) */}
          <div style={{
            padding: "0 24px 22px",
          }}>
            <div style={{
              fontSize: 12, fontWeight: 800, color: t.textMuted,
              marginTop: 6, marginBottom: 8, letterSpacing: 0.3,
              borderTop: `1px solid ${t.border}`,
              paddingTop: 16,
            }}>
              [2] 입금 진행 (유솔 → 회사, company_received_at 기준)
            </div>

            <ReceiveBox t={t}
              kind="received"
              title="받음 (입금 완료)"
              count={recvCnt}
              engineer={receivedEng}
              owner={receivedMargin}
              total={recvTotal}
            />
            <div style={{ height: 10 }}/>
            <ReceiveBox t={t}
              kind="pending"
              title="안받음 (대기)"
              count={pendCnt}
              engineer={pendingEng}
              owner={pendingMargin}
              total={pendTotal}
            />

            {/* 검산 — 받음 + 안받음 = 회사 받을 */}
            <div style={{
              marginTop: 10, padding: "8px 12px",
              background: t.bgInset, border: `1px dashed ${t.border}`, borderRadius: 7,
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              fontSize: 11, color: t.textMuted,
            }}>
              <span>받음 + 안받음 = 회사 받을</span>
              <span style={{
                fontWeight: 800,
                color: (recvTotal + pendTotal) === compShare ? t.success : (t.warning || "#F59E0B"),
                fontVariantNumeric: "tabular-nums",
              }}>
                {fmtKRW(recvTotal + pendTotal)} {(recvTotal + pendTotal) === compShare ? "✓" : `≠ ${fmtKRW(compShare)}`}
              </span>
            </div>
          </div>

          {/* 3단 — 기사 정산 액션 (옵션, stamp 버튼) */}
          {(engPending > 0 || engPaid > 0) && (
            <div style={{
              padding: "0 24px 18px",
              display: "flex", gap: 8, alignItems: "center",
            }}>
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
                기사 정산 — 완료
                {" "}<span style={{ color: t.success, fontWeight: 800 }}>{fmtKRW(engPaid)}</span>
                {" "}/ 대기 <span style={{ color: t.accent, fontWeight: 800 }}>{fmtKRW(engPending)}</span>
              </span>
              <div style={{ flex: 1 }}/>
              <button onClick={onStampClick} disabled={engPending === 0} style={{
                padding: "8px 14px",
                background: engPending === 0 ? t.bgInset : t.success,
                color: engPending === 0 ? t.textMuted : "#fff",
                border: "none", borderRadius: 7,
                fontSize: 11, fontWeight: 800,
                cursor: engPending === 0 ? "not-allowed" : "pointer", fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", gap: 5,
                opacity: engPending === 0 ? 0.6 : 1,
              }}>
                <CheckCircle2 size={12}/>
                기사 정산 완료 처리
              </button>
              {engPaid > 0 && (
                <button onClick={onUnstampClick} title="이 작업월 stamp 모두 되돌리기" style={{
                  padding: "8px 12px",
                  background: "transparent", border: `1px solid ${t.border}`,
                  color: t.textMuted, borderRadius: 7,
                  fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  <RotateCcw size={11}/>
                  되돌리기
                </button>
              )}
            </div>
          )}

          {/* 4단 — footnote (단어 통일) */}
          <div style={{
            padding: "12px 24px 18px",
            borderTop: `1px solid ${t.border}`,
            background: t.bgInset,
            fontSize: 11, color: t.textMuted, lineHeight: 1.7,
          }}>
            <div>· 현장추가금은 기사 현장 수금 + 유솔 직접 입금 → 회사 무관, 위 숫자에서 제외.</div>
            <div>· 받음/안받음은 주간 입금 확인 반영 후 확정.</div>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// FlowRow — 세로 1단 자금 흐름 한 줄
//   label 좌 / amount 우 (tabular-nums)
//   props: negative(빨강 + −) / green(초록) / bold / large / sumBorder(상단 보더)
//        / muted(라벨 흐림) / signed(±) / hint(라벨 아래 작은 글)
// ──────────────────────────────────────────────────────────
function FlowRow({ t, label, amount, negative, green, bold, large, sumBorder, muted, signed, hint }) {
  const v = Number(amount) || 0;
  let display;
  if (signed) {
    display = v === 0 ? "₩0" : (v < 0 ? "−" : "+") + fmtKRW(Math.abs(v)).replace("₩", "₩");
  } else if (negative && v > 0) {
    display = "−" + fmtKRW(v).replace("₩", "₩");
  } else {
    display = fmtKRW(v);
  }

  // 2026-06-15 — 색 규칙 (사장님 spec):
  //   · 마진 (green) → success
  //   · 차감 (negative) → danger
  //   · 그 외 → t.text
  //   · 음수(환불) → danger 자동
  const amtColor = v < 0 ? t.danger
                  : negative ? t.danger
                  : green ? t.success
                  : t.text;

  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 14,
      padding: large ? "12px 14px" : "8px 14px",
      borderTop: sumBorder ? `1.5px solid ${t.border}` : "none",
      marginTop: sumBorder ? 2 : 0,
      background: large && green ? (v < 0 ? "rgba(255,68,68,0.08)" : "rgba(29,158,117,0.08)") : "transparent",
      borderRadius: large ? 8 : 0,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: large ? 14 : (bold ? 13 : 12.5),
          fontWeight: large ? 900 : (bold ? 800 : 600),
          color: muted ? t.textMuted
                : (large && green) ? (v < 0 ? t.danger : t.success)
                : t.text,
          letterSpacing: "-0.2px",
        }}>{label}</span>
        {hint && (
          <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{hint}</span>
        )}
      </div>
      {/* mono 폐기 — sans + tabular-nums 유지 (사장님 spec) */}
      <span style={{
        fontSize: large ? 24 : (bold ? 19 : 17),
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
// ReceiveBox — 입금 진행 한 카드 (받음 또는 안받음).
//   2026-06-16 사장님 spec: 받음=초록 테두리, 안받음=핑크 테두리(t.accent).
//   3줄: 기사 정산 / 회사 마진 (초록 강조, 환불 시 음수 빨강) / 합계.
// ──────────────────────────────────────────────────────────
function ReceiveBox({ t, kind, title, count, engineer, owner, total }) {
  const isReceived = kind === "received";
  const accent = isReceived ? t.success : t.accent;
  const bg = isReceived
    ? (t.successBg || "rgba(29,158,117,0.06)")
    : (t.accentBg  || "rgba(255,27,141,0.06)");
  // 회사 마진은 항상 success 색. 음수(환불)면 danger.
  const ownerColor = owner < 0 ? t.danger : t.success;

  return (
    <div style={{
      background: bg,
      border: `1.5px solid ${accent}`,
      borderRadius: 10,
      padding: "12px 16px",
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 8,
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 14, fontWeight: 900, color: accent, letterSpacing: "-0.2px",
        }}>{isReceived ? "✓" : "⏳"} {title}</span>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
          · {fmtCount(count)}
        </span>
      </div>

      <ReceiveLine t={t} label="기사 정산" amount={engineer} color={t.text}/>
      <ReceiveLine t={t} label="회사 마진" amount={owner}    color={ownerColor} bold/>

      <div style={{
        marginTop: 4,
        paddingTop: 6,
        borderTop: `1.5px solid ${accent}`,
      }}>
        <ReceiveLine t={t} label="합계" amount={total} color={t.text} bold large/>
      </div>
    </div>
  );
}

function ReceiveLine({ t, label, amount, color, bold, large }) {
  const v = Number(amount) || 0;
  const display = v < 0 ? `−${fmtKRW(Math.abs(v))}` : fmtKRW(v);
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 10,
      padding: "4px 0",
    }}>
      <span style={{
        flex: 1,
        fontSize: large ? 13 : 12,
        fontWeight: bold ? 800 : 600,
        color: bold ? t.text : t.textSecondary,
        letterSpacing: "-0.2px",
      }}>{label}</span>
      <span style={{
        fontSize: large ? 18 : 16,
        fontWeight: bold ? 800 : 700,
        color,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        letterSpacing: "-0.3px",
      }}>{display}</span>
    </div>
  );
}

// ──────────────────────────────────────────────
// stamp / unstamp 확인 다이얼로그 (기존 그대로)
// ──────────────────────────────────────────────
function StampDialog({ t, dialog, actor, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [result, setResult] = useState(null);

  const isStamp = dialog.mode === "stamp";

  async function handleConfirm() {
    if (!actor) { setActionErr("관리자 사용자 ID 없음"); return; }
    setBusy(true); setActionErr("");
    try {
      const res = isStamp
        ? await markUsolnEngineerSettledByMonth(dialog.wm, actor)
        : await unmarkUsolnEngineerSettledByMonth(dialog.wm, actor);
      if (!res?.ok) {
        setActionErr(res?.error || "실패");
      } else {
        setResult(res);
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
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200,
      }}/>
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(460px, 92vw)",
        background: t.bgElevated, borderRadius: 14,
        border: `2px solid ${isStamp ? t.success : t.warning || "#F59E0B"}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        zIndex: 201, padding: "20px 22px",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: isStamp ? t.success : (t.warning || "#F59E0B") }}>
          {isStamp ? "🟢 기사 정산 완료 처리" : "↩️ stamp 되돌리기"}
        </div>
        <div style={{ fontSize: 12, color: t.text, lineHeight: 1.6 }}>
          <strong>{dialog.wm} 작업분</strong>의 task_items 중<br/>
          {isStamp
            ? "회사 입금 완료이면서 아직 기사 정산 안 된 것을 전부 engineer_settled_at = now() 로 stamp 합니다."
            : "이미 stamp 된 engineer_settled_at 을 전부 NULL 로 되돌립니다 (실수 정정용)."}
        </div>

        {!isStamp && (
          <div style={{
            padding: "10px 12px",
            background: t.warningBg || "rgba(245,158,11,0.08)",
            border: `1px solid ${t.warning || "#F59E0B"}`,
            borderRadius: 8, fontSize: 11, color: t.warning || "#F59E0B", fontWeight: 600,
            display: "flex", alignItems: "flex-start", gap: 6,
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
            <div>그 작업월 모든 engineer_settled_at 이 NULL 로 돌아갑니다. 통장 cashflow 거래는 영향 없음.</div>
          </div>
        )}

        {result && (
          <div style={{
            padding: "10px 12px",
            background: t.successBg || "rgba(34,197,94,0.08)",
            border: `1px solid ${t.success}`,
            borderRadius: 8, fontSize: 12, color: t.success, fontWeight: 700,
          }}>
            ✓ 완료. {isStamp ? "stamp" : "unstamp"} {(result.stamped_count ?? result.unstamped_count ?? 0)}건.
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

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {result ? (
            <button onClick={onDone} style={primaryBtn(t, t.accent)}>
              닫기
            </button>
          ) : (
            <>
              <button onClick={onClose} disabled={busy} style={ghostBtn(t)}>
                취소
              </button>
              <button onClick={handleConfirm} disabled={busy} style={primaryBtn(t, isStamp ? t.success : (t.warning || "#F59E0B"))}>
                {busy ? "처리 중..." : (isStamp ? "확인 (stamp)" : "확인 (unstamp)")}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ghostBtn(t) {
  return {
    padding: "10px 14px",
    background: "transparent", border: `1px solid ${t.border}`,
    color: t.text, borderRadius: 8,
    fontSize: 12, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  };
}
function primaryBtn(t, color) {
  return {
    padding: "10px 18px",
    background: color, color: "#fff",
    border: "none", borderRadius: 8,
    fontSize: 13, fontWeight: 800,
    cursor: "pointer", fontFamily: "inherit",
  };
}
