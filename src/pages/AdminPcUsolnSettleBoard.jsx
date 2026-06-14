// 2026-06-14 — PC 유솔N 정산 현황판 (Mig 130 RPC).
//
// 사장님 spec:
//   기존 task_items 4단계 시스템 재활용. 작업월별 카드 (2026-04 ~ 현재월).
//   각 카드:
//     ① 통과자금 (subtotal): 받은 거 / 받을 거 + 진행률
//     ② 기사 지급 (engineer_amount, task 단위): 준 거 / 줄 거 + [기사 정산 완료 처리] 버튼
//     ③ 회사 마진 (owner_amount track B) + Mig 127 보정값
//   4월: 데이터 없음 + 보정 텍스트만.
//
// 기존 재활용:
//   · task_items 4단계 컬럼 (Mig 038)
//   · getItemSettlementColor 등 usolNTasksDb 헬퍼는 row 단위라 여기선 미사용 (집계 화면)
//
// CLAUDE.md 금지 어근 자가검사 통과.

import { useEffect, useState } from "react";
import { Wallet, RefreshCw, CheckCircle2, RotateCcw, AlertCircle } from "lucide-react";
import {
  getUsolnSettleBoardSummary,
  markUsolnEngineerSettledByMonth,
  unmarkUsolnEngineerSettledByMonth,
} from "../lib/usolnSettleBoardDb.js";

const fmtKRW   = n => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
const fmtCount = n => `${Number(n || 0).toLocaleString("ko-KR")}건`;
const pct = (part, total) => {
  const p = Number(part) || 0, t = Number(total) || 0;
  if (t === 0) return 0;
  return Math.min(100, Math.max(0, (p / t) * 100));
};

export default function AdminPcUsolnSettleBoard({ t, user }) {
  const actor = user?.user_id || user?.userId || user?.id;
  const [data, setData] = useState({ months: [], start_month: "2026-04" });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [dialog, setDialog] = useState(null); // { mode:'stamp'|'unstamp', wm, count, eng }

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
    <div style={{ padding: "20px 24px 40px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Wallet size={22} style={{ color: t.accent }}/>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>유솔N 정산 현황판</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            작업월별 4단계 진행 + 회사 마진 (시작 {data.start_month})
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
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.months.map(m => (
            <MonthCard key={m.wm} t={t} m={m}
              onStampClick={() => setDialog({ mode: "stamp", wm: m.wm, count: m.engineer_pending_count_estimate, eng: m.engineer_pending })}
              onUnstampClick={() => setDialog({ mode: "unstamp", wm: m.wm, count: 0, eng: m.engineer_paid })}
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

function MonthCard({ t, m, onStampClick, onUnstampClick }) {
  const itemCnt    = Number(m.item_count) || 0;
  const passTotal  = Number(m.passthrough_total) || 0;
  const passRecv   = Number(m.passthrough_received) || 0;
  const passPend   = Number(m.passthrough_pending) || 0;
  const recvCnt    = Number(m.received_count) || 0;
  const pendCnt    = Number(m.pending_count) || 0;
  const taskCnt    = Number(m.task_count) || 0;
  const engTotal   = Number(m.engineer_total) || 0;
  const engPaid    = Number(m.engineer_paid) || 0;
  const engPending = Number(m.engineer_pending) || 0;
  // 2026-06-14 — Mig 131 신규 필드 (3분할 비율 표시용).
  const prinTotal  = Number(m.principal_total) || 0;
  const extraTotal = Number(m.extra_total) || 0;
  const margin     = Number(m.margin) || 0;
  const adjAmount  = Number(m.adjustment_amount) || 0;
  const adjMemo    = m.adjustment_memo || "";

  // 2026-06-14 — Mig 132 신규 필드 (item 단위 company_received_at 으로 eng/own 분배).
  const recvEng    = Number(m.received_engineer) || 0;
  const recvOwn    = Number(m.received_owner)    || 0;
  const pendEng    = Number(m.pending_engineer)  || 0;
  const pendOwn    = Number(m.pending_owner)     || 0;
  const recvTotal  = recvEng + recvOwn;
  const pendTotal  = pendEng + pendOwn;
  const compTarget = passTotal - prinTotal;  // 회사가 받을 총액(85%) = 정산금 − 유솔 15%

  const noData = itemCnt === 0;

  const passRecvPct = pct(passRecv, passTotal);
  const engPaidPct  = pct(engPaid, engTotal);

  // 3분할 비율 (기사/유솔/회사 마진) — 합계는 engineer + principal + owner.
  const allocTotal = engTotal + prinTotal + margin;
  const engPct  = pct(engTotal,  allocTotal);
  const prinPct = pct(prinTotal, allocTotal);
  const ownPct  = pct(margin,    allocTotal);

  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "baseline", gap: 12,
        padding: "14px 18px",
        borderBottom: `1px solid ${t.border}`,
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>
          📅 {m.wm} 작업분
        </div>
        {noData ? (
          <div style={{ fontSize: 11, color: t.textMuted }}>데이터 없음 (앱 가동 전)</div>
        ) : (
          <div style={{ fontSize: 11, color: t.textMuted }}>
            {fmtCount(taskCnt)} tasks · {fmtCount(itemCnt)} items
          </div>
        )}
      </div>

      {noData ? (
        // 4월 — 데이터 없음 + 보정 안내
        <div style={{ padding: "20px 18px" }}>
          <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
            앱이 5월 말부터 가동되어 4월 작업 데이터가 DB에 없습니다.
          </div>
          {adjAmount !== 0 ? (
            <div style={{
              marginTop: 10,
              padding: "10px 12px",
              background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 8,
              fontSize: 12, color: t.textSecondary, lineHeight: 1.6,
            }}>
              💡 손계산 보정: <span className="mono" style={{ fontWeight: 800, color: "#A78BFA" }}>
                {adjAmount > 0 ? "+" : ""}{fmtKRW(adjAmount)}
              </span> {adjMemo ? `· ${adjMemo}` : ""}
            </div>
          ) : (
            <div style={{
              marginTop: 10, fontSize: 11, color: t.textMuted,
            }}>
              Mig 127 보정값 없음.
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 통과자금 + 기사 지급 + 마진 — 3그리드 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            padding: "16px 18px",
          }}>
            {/* ① 회사 받은/받을 거 분해 (item 단위 company_received_at) — 기사 몫 + 회사 마진 */}
            <Panel t={t} title="① 회사 받은/받을 거" subtitle="item 단위 분해 (기사 + 마진)" color="#F59E0B">
              {/* 받은 거 — 입금 완료 */}
              <div style={{
                padding: "8px 10px",
                background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 7,
                marginBottom: 6,
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: t.success, marginBottom: 4 }}>
                  ✓ 받은 거 (입금 완료) · {recvCnt}건
                </div>
                <KV t={t} label="기사 몫"   value={fmtKRW(recvEng)} color={t.text}/>
                <KV t={t} label="회사 마진 ★" value={fmtKRW(recvOwn)} color={t.success} bold
                  hint="회사 통장 들어옴"/>
                <KV t={t} label="합계" value={fmtKRW(recvTotal)} color={t.text} bold/>
              </div>
              {/* 받을 거 — 입금 대기 */}
              <div style={{
                padding: "8px 10px",
                background: (t.warningBg || "rgba(245,158,11,0.06)"),
                border: `1px solid ${t.warning || "#F59E0B"}`, borderRadius: 7,
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: t.warning || "#F59E0B", marginBottom: 4 }}>
                  ⏳ 받을 거 (대기) · {pendCnt}건
                </div>
                <KV t={t} label="기사 몫"   value={fmtKRW(pendEng)} color={t.text}/>
                <KV t={t} label="회사 마진" value={fmtKRW(pendOwn)} color={t.warning || "#F59E0B"} bold
                  hint="아직 안 들어옴"/>
                <KV t={t} label="합계" value={fmtKRW(pendTotal)} color={t.text} bold/>
              </div>
              {/* 진행률 + 회사 85% 목표 */}
              <ProgressBar t={t} pct={passRecvPct} color={t.success}
                label={`회사 입금 진행률 ${passRecvPct.toFixed(0)}% (item 단위)`}/>
              <div style={{
                marginTop: 6, padding: "6px 8px",
                background: t.bgElevated, border: `1px dashed ${t.border}`, borderRadius: 6,
                fontSize: 10, color: t.textMuted, lineHeight: 1.5,
              }}>
                회사 받을 총액(85%) = 유솔 정산금({fmtKRW(passTotal)})<br/>
                − 유솔 15%({fmtKRW(prinTotal)}) = <b style={{ color: t.text }}>{fmtKRW(compTarget)}</b>
              </div>
            </Panel>

            {/* ② 기사 지급 (engineer_amount, task) */}
            <Panel t={t} title="② 기사 지급 (회사→기사)" subtitle="단위: engineer_amount (task)" color="#3B82F6">
              <KV t={t} label="준 거" value={fmtKRW(engPaid)} color={t.success}
                hint="task 전 items 모두 stamp 완료"/>
              <KV t={t} label="줄 거" value={fmtKRW(engPending)} color={t.danger}
                hint="회사 받았으나 미지급"/>
              <KV t={t} label="총 engineer_amount" value={fmtKRW(engTotal)} color={t.text} bold/>
              <ProgressBar t={t} pct={engPaidPct} color={t.success} label={`기사 정산 진행률 ${engPaidPct.toFixed(0)}%`}/>

              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={onStampClick} disabled={engPending === 0} style={{
                  flex: 1, padding: "9px 10px",
                  background: engPending === 0 ? t.bgInset : t.success,
                  color: engPending === 0 ? t.textMuted : "#fff",
                  border: "none", borderRadius: 7,
                  fontSize: 11, fontWeight: 800,
                  cursor: engPending === 0 ? "not-allowed" : "pointer", fontFamily: "inherit",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                  opacity: engPending === 0 ? 0.6 : 1,
                }}>
                  <CheckCircle2 size={12}/>
                  기사 정산 완료 처리
                </button>
                {engPaid > 0 && (
                  <button onClick={onUnstampClick} title="이 작업월 stamp 모두 되돌리기" style={{
                    padding: "9px 10px",
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
            </Panel>

            {/* ③ 분배 (회사가 진짜 먹는 것) — 기사/유솔/회사 3분할 비율 + 회사 마진 강조 */}
            <Panel t={t} title="③ 분배 (회사가 진짜 먹는 것)" subtitle="기사 / 유솔 / 회사 비율" color="#8B5CF6">
              <KV t={t} label="유솔 정산금 (수수료 뺀)" value={fmtKRW(passTotal)} color={t.text}
                hint="task_items.subtotal 합"/>
              {extraTotal > 0 && (
                <KV t={t} label="+ 현장 추가금" value={fmtKRW(extraTotal)} color={t.textMuted}
                  hint="payments.extra_fee"/>
              )}
              <div style={{ height: 1, background: t.border, margin: "2px 0" }}/>
              <KV t={t} label={`기사 몫 ${engPct.toFixed(1)}%`} value={fmtKRW(engTotal)} color="#3B82F6"/>
              <KV t={t} label={`유솔 몫 ${prinPct.toFixed(1)}%`} value={fmtKRW(prinTotal)} color="#F59E0B"/>
              <div style={{
                padding: "8px 10px",
                background: (t.successBg || "rgba(34,197,94,0.08)"),
                border: `1.5px solid ${t.success}`,
                borderRadius: 7,
                marginTop: 2,
              }}>
                <KV t={t} label={`회사 마진 ${ownPct.toFixed(1)}% ★`} value={fmtKRW(margin)} color={t.success} bold/>
                {/* 받은 마진 / 안 받은 마진 분해 (Mig 132 신규) */}
                {(recvOwn > 0 || pendOwn > 0) && (
                  <div style={{
                    marginTop: 4, padding: "6px 8px",
                    background: t.bgInset, borderRadius: 5,
                    display: "flex", flexDirection: "column", gap: 2,
                  }}>
                    <div style={{ fontSize: 9, color: t.success, fontWeight: 700 }}>
                      ✓ 받은 마진 : {fmtKRW(recvOwn)}
                    </div>
                    <div style={{ fontSize: 9, color: t.warning || "#F59E0B", fontWeight: 700 }}>
                      ⏳ 안 받은 마진: {fmtKRW(pendOwn)}
                    </div>
                  </div>
                )}
                {adjAmount !== 0 && (
                  <>
                    <div style={{ height: 1, background: t.border, margin: "4px 0" }}/>
                    <KV t={t} label="+ 보정 (Mig 127)" value={(adjAmount > 0 ? "+" : "") + fmtKRW(adjAmount)} color="#A78BFA"
                      hint={adjMemo || "수동 보정"}/>
                    <KV t={t} label="회사 합계" value={fmtKRW(margin + adjAmount)} color={t.accent} bold/>
                  </>
                )}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Panel({ t, title, subtitle, color, children }) {
  return (
    <div style={{
      background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 10,
      padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: t.text }}>{title}</div>
        <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 600, marginTop: 1 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function KV({ t, label, value, color, hint, bold }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: bold ? 11 : 10.5, fontWeight: bold ? 800 : 700,
          color: bold ? t.text : t.textSecondary,
        }}>{label}</span>
        {hint && <span style={{ fontSize: 9, color: t.textMuted, fontWeight: 500 }}>{hint}</span>}
      </div>
      <span className="mono" style={{
        fontSize: bold ? 14 : 13, fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums",
      }}>{value}</span>
    </div>
  );
}

function ProgressBar({ t, pct, color, label }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{
        height: 6, background: t.border, borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: color, transition: "width 0.3s",
        }}/>
      </div>
      <div style={{ fontSize: 9, color: t.textMuted, marginTop: 3, fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// stamp / unstamp 확인 다이얼로그
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
