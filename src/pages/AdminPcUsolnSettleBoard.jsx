// 2026-06-15 — PC 유솔N 정산 현황판 (세로 1단 재빌드).
//
// 사장님 시안 (확정):
//   가로 3패널 폐기 → 세로 1단 흐름. 위에서 아래로 자금 분해:
//     유솔 정산금 → − 유솔 15% → 회사 받을 돈 85% → − 기사 줄 거 → ★ 회사 마진 → 보정 → 최종
//   그 아래 "입금 진행" 두 카드 (받은 금액 / 받을 금액), 각 카드 = 기사 줄 돈 + 회사 마진 + 합계.
//   맨 아래 footnote 2줄.
//
// 컬럼 사용 규칙 (사장님 spec):
//   · _excl_extra 필드만 사용 (engineer_total / principal_total 금지 — 현장추가금 섞임).
//   · 현장추가금 extra_total = 기사 현장 수금 → 회사 무관 (RPC 가 이미 제외함).
//
// 표기 규칙:
//   · 금액 전액 표기 (M/K 약자 금지). tabular-nums 정렬.
//   · 음수 빨강 −, 합계 굵게 + 상단 보더, 마진 초록.
//   · CLAUDE.md 금지 어근 자가검사 통과.

import { useEffect, useState } from "react";
import { Wallet, RefreshCw, CheckCircle2, RotateCcw, AlertCircle } from "lucide-react";
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
        setData({
          months:       res.months || [],
          start_month:  res.start_month || "2026-04",
        });
      }
      setLoading(false);
    })().catch(e => { if (alive) { setErr(e?.message || "에러"); setLoading(false); } });
    return () => { alive = false; };
  }, [actor, reloadTick]);

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1200, margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Wallet size={22} style={{ color: t.accent }}/>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>유솔N 정산 현황판</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            작업월별 자금 분해 + 입금 진행 (시작 {data.start_month})
          </div>
        </div>
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
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {data.months.map(m => (
            <MonthCard key={m.wm} t={t} m={m}
              onStampClick={() => setDialog({ mode: "stamp", wm: m.wm })}
              onUnstampClick={() => setDialog({ mode: "unstamp", wm: m.wm })}
            />
          ))}
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
// MonthCard — 세로 1단 (자금 분해 → 입금 진행 → footnote)
// ──────────────────────────────────────────────────────────
function MonthCard({ t, m, onStampClick, onUnstampClick }) {
  const itemCnt    = Number(m.item_count) || 0;
  const taskCnt    = Number(m.task_count) || 0;
  const recvCnt    = Number(m.received_count) || 0;
  const pendCnt    = Number(m.pending_count) || 0;

  // ⚠️ _excl_extra 필드 강제 (현장추가금 제외분).
  const passTotal  = Number(m.passthrough_total)      || 0;
  const prinExcl   = Number(m.principal_excl_extra)   || 0;
  const engExcl    = Number(m.engineer_excl_extra)    || 0;
  const margin     = Number(m.margin)                 || 0;
  const adjAmount  = Number(m.adjustment_amount)      || 0;
  const adjMemo    = m.adjustment_memo || "";

  const recvEngExcl = Number(m.received_engineer_excl_extra) || 0;
  const recvOwn     = Number(m.received_owner)               || 0;
  const pendEngExcl = Number(m.pending_engineer_excl_extra)  || 0;
  const pendOwn     = Number(m.pending_owner)                || 0;

  // 기사 정산 진행 상태 (engineer_settled_at) — stamp 버튼 활성화 판단용
  const engPaid     = Number(m.engineer_paid)    || 0;
  const engPending  = Number(m.engineer_pending) || 0;

  // 계산
  const compShare85 = passTotal - prinExcl;             // 회사 받을 돈 85% = 정산금 − 유솔 15%
  const marginFinal = margin + adjAmount;               // 마진 최종 = 마진 + 보정
  const recvTotal   = recvEngExcl + recvOwn;
  const pendTotal   = pendEngExcl + pendOwn;

  const noData = itemCnt === 0;

  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14,
      overflow: "hidden",
    }}>
      {/* 카드 헤더 */}
      <div style={{
        display: "flex", alignItems: "baseline", gap: 14,
        padding: "16px 22px",
        borderBottom: `1px solid ${t.border}`,
      }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: t.text }}>
          📅 {m.wm} 작업분
        </div>
        {noData ? (
          <div style={{ fontSize: 12, color: t.textMuted }}>데이터 없음 (앱 가동 전)</div>
        ) : (
          <div style={{ fontSize: 12, color: t.textMuted }}>
            {fmtCount(taskCnt)} tasks · {fmtCount(itemCnt)} items
          </div>
        )}
      </div>

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
          {/* 1단 — 자금 분해 흐름 (위→아래) */}
          <div style={{
            padding: "22px 24px",
            display: "flex", flexDirection: "column", gap: 2,
          }}>
            <FlowRow t={t} label="유솔 정산금"        amount={passTotal}/>
            <FlowRow t={t} label="− 유솔 몫 15%"      amount={prinExcl} negative
              hint="유솔이 먼저 떼고 회사로 입금"/>
            <FlowRow t={t} label="회사가 받을 돈 85%" amount={compShare85} bold sumBorder
              hint="= 유솔 정산금 − 유솔 15%"/>
            <FlowRow t={t} label="− 기사 줄 거"       amount={engExcl} negative
              hint="회사가 기사에게 송금할 돈 (현장추가금 제외)"/>
            <FlowRow t={t} label="★ 회사 마진"        amount={margin} green bold large sumBorder
              hint="= 회사 받을 돈 85% − 기사 줄 거"/>

            {/* 보정 */}
            {adjAmount !== 0 && (
              <>
                <div style={{ height: 10 }}/>
                <FlowRow t={t}
                  label={`+ 보정${adjMemo ? ` (${adjMemo})` : ""}`}
                  amount={adjAmount}
                  signed muted
                  hint="Mig 127 수동 보정 (4월 작업분 등)"/>
                <FlowRow t={t} label="회사 마진 최종"  amount={marginFinal} green bold large sumBorder/>
              </>
            )}
          </div>

          {/* 2단 — 입금 진행 (받은 금액 / 받을 금액 카드) */}
          <div style={{
            padding: "0 24px 22px",
          }}>
            <div style={{
              fontSize: 13, fontWeight: 800, color: t.text,
              marginTop: 6, marginBottom: 10,
              borderTop: `1px solid ${t.border}`,
              paddingTop: 16,
            }}>
              입금 진행
            </div>

            <ReceiveBox t={t}
              kind="received"
              title="받은 금액 (입금 완료)"
              count={recvCnt}
              engineer={recvEngExcl}
              owner={recvOwn}
              total={recvTotal}
            />
            <div style={{ height: 10 }}/>
            <ReceiveBox t={t}
              kind="pending"
              title="받을 금액 (대기)"
              count={pendCnt}
              engineer={pendEngExcl}
              owner={pendOwn}
              total={pendTotal}
            />
          </div>

          {/* 3단 — 기사 정산 액션 (옵션, stamp 버튼) */}
          {(engPending > 0 || engPaid > 0) && (
            <div style={{
              padding: "0 24px 18px",
              display: "flex", gap: 8, alignItems: "center",
            }}>
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
                기사 정산 (engineer_settled_at):
                {" "}<span style={{ color: t.success, fontWeight: 800 }}>{fmtKRW(engPaid)}</span>
                {" "}/ 대기 <span style={{ color: t.warning || "#F59E0B", fontWeight: 800 }}>{fmtKRW(engPending)}</span>
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

          {/* 4단 — footnote */}
          <div style={{
            padding: "12px 24px 18px",
            borderTop: `1px solid ${t.border}`,
            background: t.bgInset,
            fontSize: 11, color: t.textMuted, lineHeight: 1.7,
          }}>
            <div>· 현장추가금(extra_total)은 기사 현장 수금·유솔 직접 입금 → 회사 무관, 위 숫자에서 제외 (RPC 가 이미 빼줌).</div>
            <div>· 받은/받을은 주간 입금 confirm 반영 후 확정.</div>
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

  const amtColor = negative ? t.danger
                  : green ? t.success
                  : bold ? t.text
                  : t.text;

  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 14,
      padding: large ? "12px 14px" : "8px 14px",
      borderTop: sumBorder ? `1.5px solid ${t.border}` : "none",
      marginTop: sumBorder ? 2 : 0,
      background: large && green ? "rgba(29,158,117,0.08)" : "transparent",
      borderRadius: large ? 8 : 0,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: large ? 14 : (bold ? 13 : 12.5),
          fontWeight: large ? 900 : (bold ? 800 : 600),
          color: muted ? t.textMuted : (green && large ? t.success : t.text),
          letterSpacing: "-0.2px",
        }}>{label}</span>
        {hint && (
          <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{hint}</span>
        )}
      </div>
      <span className="mono" style={{
        fontSize: large ? 22 : (bold ? 17 : 15),
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
// ReceiveBox — 입금 진행 한 카드 (받은 또는 받을)
//   3줄: ㄴ 기사 줄 돈 / ㄴ 회사 마진 / 합계 (굵게 + 상단 보더)
// ──────────────────────────────────────────────────────────
function ReceiveBox({ t, kind, title, count, engineer, owner, total }) {
  const isReceived = kind === "received";
  const accent = isReceived ? t.success : (t.warning || "#F59E0B");
  const bg = isReceived
    ? (t.successBg || "rgba(29,158,117,0.06)")
    : (t.warningBg || "rgba(245,158,11,0.06)");
  const ownerColor = isReceived ? t.success : (t.warning || "#F59E0B");

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
          fontSize: 13, fontWeight: 900, color: accent,
        }}>{isReceived ? "✓" : "⏳"} {title}</span>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
          · {fmtCount(count)}
        </span>
      </div>

      <ReceiveLine t={t} label="ㄴ 기사 줄 돈" amount={engineer} color={t.text}/>
      <ReceiveLine t={t} label="ㄴ 회사 마진"  amount={owner}    color={ownerColor} bold/>

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
      <span className="mono" style={{
        fontSize: large ? 17 : 14,
        fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        letterSpacing: "-0.3px",
      }}>{fmtKRW(amount)}</span>
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
