// 2026-06-28 — 접수함 통계 헤더 (Mig 151 RPC 연결).
// 2026-07-10 v2 — 사장님 spec: 성사/완료 중심 재구성.
//   ✳️ 히어로 = 퍼널 3단계: 접수 N → 성사 M (전환율%) → 완료 K (완료율%).
//     · 성사(전환) = converted 상태의 inquiries. Mig 152 이후 보존됨.
//                    "지금 어떤 상태" 기준으로 converted + completed_in 합산.
//     · 완료 = task 완료 상태 (all_time_completed / completed_in).
//   ✳️ 일별 접수 차트 = 보조 유지 (7/14/30 토글).
//   ✳️ 카드 4 (오늘/이번달/누적/전환율%) → 하나의 미니 라인으로 축소.
//   ✳️ 현재 상태 분포 (신규/통화함/전환됨/완료_in) → 제거 (히어로가 대체).
//   ✳️ 지역 관련 요소 없음 (지역별 접수 현황 화면으로 일원화).

import React, { useState, useEffect, useMemo } from "react";
import {
  getInquiryFunnel,
  ymdKstToday,
} from "../../lib/inquiryStatsDb.js";
import { listInquiries } from "../../lib/inquiriesDb.js";
import { toKstYmd } from "../../utils/dateLabel.js";
import { isEffectivelyCanceled } from "../../utils/taskCancelState.js";

const ACCENT       = "#FF1B8D";
const COLOR_TOTAL  = "#3B82F6";   // 접수 — 파랑
const COLOR_SPAM   = "#9CA3AF";   // 스팸 — 회색
const COLOR_CONV   = "#16A34A";   // 성사 — 초록
const COLOR_UPCOMING = "#0EA5E9"; // 서비스 예정 — 하늘
const COLOR_DONE   = "#FF1B8D";   // 완료 — 핑크 (accent)
const COLOR_INQ_ONLY = "#F59E0B"; // 문의만(미배정) — 주황

// 2026-07-11 — 기간 프리셋 (사장님 spec). custom 은 date picker.
const PERIOD_OPTS = [
  { id: "today",  label: "오늘" },
  { id: "month",  label: "이번 달" },
  { id: "custom", label: "직접 선택" },
];

function fmtNum(n) { return (Number(n) || 0).toLocaleString("ko-KR"); }
function fmtPct(n) {
  if (n == null || isNaN(Number(n))) return "—";
  return `${Number(n).toFixed(1)}%`;
}

// 2026-07-10 hotfix — ErrorBoundary 로 감싸 크래시 격리.
//   apiTasks/funnel/totals 등 예상외 값이나 render 예외 발생 시 화면 전체가 죽지 않도록.
export function InquiryStatsHeader(props) {
  return (
    <InquiryStatsErrorBoundary t={props.t}>
      <InquiryStatsHeaderInner {...props}/>
    </InquiryStatsErrorBoundary>
  );
}

function InquiryStatsHeaderInner({ t = {}, actorId, apiTasks }) {
  // 2026-07-10 hotfix — apiTasks undefined 방어.
  const safeTasks = Array.isArray(apiTasks) ? apiTasks : [];
  const [totals, setTotals]   = useState({});
  const [funnel, setFunnel]   = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  // 2026-07-11 — 기간 필터 (사장님 spec).
  const [period, setPeriod]   = useState("today");
  const [customStart, setCustomStart] = useState(() => ymdKstToday());
  const [customEnd,   setCustomEnd]   = useState(() => ymdKstToday());
  // 성사/완료 판정: converted inquiries → 기간 필터 후 task_id 만 Set.
  const [convertedRows, setConvertedRows] = useState([]);

  // 선택 기간 계산.
  const { startYmd, endYmd } = useMemo(() => {
    const today = ymdKstToday();
    if (period === "today") return { startYmd: today, endYmd: today };
    if (period === "month") {
      const [y, m] = today.split("-").map(Number);
      return { startYmd: `${y}-${String(m).padStart(2,"0")}-01`, endYmd: today };
    }
    // custom
    let s = customStart || today;
    let e = customEnd   || s;
    if (s > e) { const tmp = s; s = e; e = tmp; }
    return { startYmd: s, endYmd: e };
  }, [period, customStart, customEnd]);

  useEffect(() => {
    if (!actorId) return;
    let alive = true;
    setLoading(true);
    setError("");

    Promise.all([
      getInquiryFunnel({ actorId, startYmd, endYmd }),
      listInquiries(actorId, "converted"),
    ]).then(([fRes, cvRows]) => {
      if (!alive) return;
      if (!fRes.ok) setError(fRes.error || "통계 불러오기 실패");
      else { setTotals(fRes.totals); setFunnel(fRes.funnel); }
      setConvertedRows(cvRows || []);
    }).finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [actorId, startYmd, endYmd]);

  // 2026-07-11 — 성사/완료 계산 시 그 기간 안 접수 (created_at KST) 만 대상.
  const convertedTaskIds = useMemo(() => {
    const ids = new Set();
    for (const r of convertedRows) {
      const created = r.created_at;
      if (!created) continue;
      const k = toKstYmd(created);
      if (!k || k < startYmd || k > endYmd) continue;
      if (r.task_id) ids.add(String(r.task_id));
    }
    return ids;
  }, [convertedRows, startYmd, endYmd]);

  // 2026-07-10 v3 — 사장님 확정 spec:
  //   전체 접수(스팸 포함) → 스팸(회색) → 유효 접수 → 문의만(미성사) + 성사 → 완료.
  //   각 단계 부분집합 보장. clamp 방어.
  //
  //   ✳️ 성사 정의 변경 (핵심): task 존재 AND assigned_engineer 있음.
  //      단순 converted 상태만으로는 성사 아님 (미배정 시 문의만).
  //   ✳️ 완료 정의: task 상태 '완료' or '정산완료'.
  //      수금/정산 조건 (remitStatus 등) 은 추후 세분 검증.
  //
  //   계산:
  //     · 전체 접수 (T) = valid + spam
  //     · 스팸       (S) = funnel.spam
  //     · 유효 접수  (V) = funnel.total_excl_spam
  //     · 성사       (M) = converted inquiries.task_id 중 apiTasks 안 assigned_engineer 있는 것.
  //     · 완료       (K) = 성사 중 task.status IN ('완료','정산완료')
  //     · 문의만     (Q) = V - M
  //   비율:
  //     · 스팸률   = S / T
  //     · 전환율   = M / V (≤100%)
  //     · 완료율   = K / M (≤100%)
  const validV    = Number(funnel.total_excl_spam || 0);
  const spamS     = Number(funnel.spam || 0);
  const totalT    = validV + spamS;

  // 2026-07-11 v2 — 각 단계 직접 카운트 (뺄셈 X). 사장님 spec:
  //   성사 = 배정된 것 (취소 포함) → 완료 + 서비스예정 + 성사후취소 합.
  //   완료 = task.status IN ('완료','정산완료').
  //   서비스 예정 = 배정 이상 AND 완료 아님 AND 취소 아님.
  //   성사 후 취소 = 배정됐다가 isEffectivelyCanceled.
  //   취소 판정: isEffectivelyCanceled (status + workItems + cancelReason 일관).
  const { rawSettle, rawDone, rawUpcoming, rawCanceledAfter } = useMemo(() => {
    if (safeTasks.length === 0 || convertedTaskIds.size === 0) {
      return { rawSettle: 0, rawDone: 0, rawUpcoming: 0, rawCanceledAfter: 0 };
    }
    let settle = 0, done = 0, upcoming = 0, canceledAfter = 0;
    for (const task of safeTasks) {
      if (!task || !task.id) continue;
      if (!convertedTaskIds.has(String(task.id))) continue;
      // 성사 판정 = 기사 배정됨.
      const eid = task.assignedEngineerId || task.assigned_engineer_id
               || task.engineerId         || task.engineer_id;
      const ename = task.assignedEngineer || task.engineer;
      const isAssigned = !!(eid || (ename && String(ename).trim().length > 0));
      if (!isAssigned) continue;
      settle += 1;
      const st = task.status || "";
      const isCanceled = isEffectivelyCanceled(task);
      const isDone = (st === "완료" || st === "정산완료");
      if (isCanceled) {
        canceledAfter += 1;
      } else if (isDone) {
        done += 1;
      } else {
        upcoming += 1;
      }
    }
    return { rawSettle: settle, rawDone: done, rawUpcoming: upcoming, rawCanceledAfter: canceledAfter };
  }, [safeTasks, convertedTaskIds]);

  const settleM         = Math.min(rawSettle, validV);
  const doneK           = Math.min(rawDone, settleM);
  const upcomingP       = Math.min(rawUpcoming, settleM);
  const canceledAfterZ  = Math.min(rawCanceledAfter, settleM);
  const inquiryOnlyQ    = Math.max(0, validV - settleM);

  const spamRate        = totalT  > 0 ? (spamS        / totalT ) * 100 : 0;
  const convRate        = validV  > 0 ? (settleM      / validV ) * 100 : 0;
  const doneRate        = settleM > 0 ? (doneK        / settleM) * 100 : 0;
  const inquiryOnlyRate = validV  > 0 ? (inquiryOnlyQ / validV ) * 100 : 0;

  // 하위 호환 alias.
  const acceptN = validV;

  // 진단 로그 — clamp 발동 or 소스 불일치 확인용.
  useEffect(() => {
    if (!funnel) return;
    if (totalT === 0) return;
    console.log("[InquiryStats] FUNNEL=" + JSON.stringify({
      total:   totalT,   // 전체 접수 (스팸 포함)
      spam:    spamS,
      valid:   validV,   // 유효 접수 = total - spam
      settle:  settleM,
      done:    doneK,
      upcoming: upcomingP,
      canceledAfter: canceledAfterZ,
      identityCheck: (doneK + upcomingP + canceledAfterZ) === settleM,
      spamRate: Number(spamRate.toFixed(2)),
      convRate: Number(convRate.toFixed(2)),
      doneRate: Number(doneRate.toFixed(2)),
      raw: {
        funnel: {
          new:              Number(funnel.new || 0),
          contacted:        Number(funnel.contacted || 0),
          converted:        Number(funnel.converted || 0),
          completed_in:     Number(funnel.completed_in || 0),
          spam:             Number(funnel.spam || 0),
          total_excl_spam:  Number(funnel.total_excl_spam || 0),
        },
      },
      inquiryOnly:     inquiryOnlyQ,
      inquiryOnlyRate: Number(inquiryOnlyRate.toFixed(2)),
      convertedTaskIds: convertedTaskIds.size,
      apiTasksCount:    safeTasks.length,
      clamp: {
        settle: rawSettle !== settleM,
        done:   rawDone   !== doneK,
        upcoming: rawUpcoming !== upcomingP,
        canceledAfter: rawCanceledAfter !== canceledAfterZ,
      },
    }));
  }, [totalT, validV, spamS, settleM, doneK, upcomingP, canceledAfterZ, funnel, inquiryOnlyQ, convertedTaskIds, safeTasks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      background: t.bgElevated || "var(--bg-elevated)",
      border: `1px solid ${t.border || "var(--border)"}`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      {/* 2026-07-11 — 기간 필터 (사장님 spec: 오늘 / 이번 달 / 직접 선택). */}
      <PeriodFilter
        t={t}
        period={period}
        setPeriod={setPeriod}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        startYmd={startYmd}
        endYmd={endYmd}
      />

      {/* 2026-07-10 사장님 확정 — 큰 숫자 카드 (선택 기간 기준으로 재계산). */}
      {/* 2026-07-11 v2 — '서비스 예정' 직접 카운트 + '성사 후 취소' 병기. */}
      <SimpleThreeStats
        t={t}
        totalT={totalT}
        spamS={spamS}
        settleM={settleM}
        upcomingP={upcomingP}
        doneK={doneK}
        canceledAfterZ={canceledAfterZ}
        loading={loading}
        tasksAvailable={safeTasks.length > 0}
      />

      {/* 2026-07-10 — 일별 막대그래프 폐기. 대신 퍼널 바.
            2026-07-11 — 서비스 예정 단계 추가: 전체 → 성사 → 서비스 예정 → 완료. */}
      <FunnelBars
        t={t}
        totalT={totalT}
        settleM={settleM}
        upcomingP={upcomingP}
        doneK={doneK}
        tasksAvailable={safeTasks.length > 0}
      />

      {error && (
        <div style={{
          padding: "8px 10px",
          background: "rgba(255,27,141,0.1)",
          border: `1px solid ${ACCENT}`,
          borderRadius: 8,
          color: ACCENT, fontSize: 11, fontWeight: 700,
        }}>⚠️ {error}</div>
      )}
    </div>
  );
}

// 2026-07-10 v4 — 사장님 확정: 큰 숫자 카드.
// 2026-07-11 — '서비스 예정' 추가 → 4개 카드.
//   1. 전체 접수 T (스팸 포함) — 아래 "스팸 S" 작게 병기.
//   2. 성사 M — task 존재 + 배정 + 취소 아님.
//   3. 서비스 예정 P — 성사 - 완료 (배정·확정됐고 서비스 앞둔 건).
//   4. 완료 K — task 완료 상태.
//   tasksAvailable === false 이면 성사/서비스예정/완료 = "—".
function SimpleThreeStats({ t, totalT, spamS, settleM, upcomingP, doneK, canceledAfterZ, loading, tasksAvailable }) {
  // 2026-07-11 v2 — 성사 = 완료 + 서비스예정 + 성사후취소. 항등식 표시.
  const settleSubLine = tasksAvailable ? (
    <span style={{ color: t.textMuted, fontSize: 10 }}>
      완료 <span className="mono" style={{ color: COLOR_DONE, fontWeight: 800 }}>{fmtNum(doneK)}</span>
      {" · "}
      예정 <span className="mono" style={{ color: COLOR_UPCOMING, fontWeight: 800 }}>{fmtNum(upcomingP)}</span>
      {" · "}
      취소 <span className="mono" style={{ color: COLOR_SPAM, fontWeight: 800 }}>{fmtNum(canceledAfterZ)}</span>
    </span>
  ) : <span style={{ color: t.textMuted }}>데이터 로드 실패</span>;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: 8,
      alignItems: "stretch",
    }}>
      <BigStatCard t={t}
        label="전체 접수"
        value={fmtNum(totalT)}
        subLine={<span>스팸 <span className="mono" style={{ color: COLOR_SPAM, fontWeight: 800 }}>{fmtNum(spamS)}</span></span>}
        color={COLOR_TOTAL}
        loading={loading}
      />
      <BigStatCard t={t}
        label="성사 (전환)"
        value={tasksAvailable ? fmtNum(settleM) : "—"}
        subLine={settleSubLine}
        color={COLOR_CONV}
        loading={loading}
        emphasize
      />
      <BigStatCard t={t}
        label="서비스 예정"
        value={tasksAvailable ? fmtNum(upcomingP) : "—"}
        subLine={<span style={{ color: t.textMuted }}>{tasksAvailable ? "배정 · 미완료 · 미취소" : "데이터 로드 실패"}</span>}
        color={COLOR_UPCOMING}
        loading={loading}
        emphasize
      />
      <BigStatCard t={t}
        label="완료"
        value={tasksAvailable ? fmtNum(doneK) : "—"}
        subLine={<span style={{ color: t.textMuted }}>{tasksAvailable ? "작업 완료 상태" : "데이터 로드 실패"}</span>}
        color={COLOR_DONE}
        loading={loading}
        emphasize
      />
    </div>
  );
}

// 2026-07-10 — 퍼널 바 (사장님 spec, 일별 차트 대체).
// 2026-07-11 — 서비스 예정 단계 추가: 전체 → 성사 → 서비스 예정 → 완료.
//   폭 % = 전체 대비. 단계 전환율 별도 표기.
//   tasksAvailable === false 이면 성사/서비스예정/완료 "—".
function FunnelBars({ t, totalT, settleM, upcomingP, doneK, tasksAvailable }) {
  const settlePct   = totalT > 0 ? (settleM   / totalT) * 100 : 0;
  const upcomingPct = totalT > 0 ? (upcomingP / totalT) * 100 : 0;
  const donePct     = totalT > 0 ? (doneK     / totalT) * 100 : 0;
  const s2m         = totalT > 0 ? (settleM   / totalT) * 100 : 0;
  const m2k         = settleM > 0 ? (doneK    / settleM) * 100 : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{
        fontSize: 12, fontWeight: 800, color: t.text || "var(--text-primary)",
      }}>퍼널</div>

      <FunnelRow t={t} label="전체 접수"   color={COLOR_TOTAL}    pct={100}         value={totalT}    showValue/>
      <FunnelRow t={t} label="성사"        color={COLOR_CONV}     pct={settlePct}   value={settleM}   showValue={tasksAvailable} disabled={!tasksAvailable}/>
      <FunnelRow t={t} label="서비스 예정" color={COLOR_UPCOMING} pct={upcomingPct} value={upcomingP} showValue={tasksAvailable} disabled={!tasksAvailable}/>
      <FunnelRow t={t} label="완료"        color={COLOR_DONE}     pct={donePct}     value={doneK}     showValue={tasksAvailable} disabled={!tasksAvailable}/>

      {/* 단계 전환율 */}
      <div style={{
        display: "flex", gap: 12, flexWrap: "wrap",
        fontSize: 11, fontWeight: 700,
        color: t.textSecondary || "var(--text-secondary)",
        paddingTop: 4, borderTop: `1px dashed ${t.border || "var(--border)"}`,
      }}>
        <span>
          접수 → 성사 <span className="mono" style={{ color: COLOR_CONV, fontWeight: 800 }}>
            {tasksAvailable && totalT > 0 ? `${s2m.toFixed(1)}%` : "—"}
          </span>
        </span>
        <span style={{ color: t.textMuted }}>·</span>
        <span>
          성사 → 완료 <span className="mono" style={{ color: COLOR_DONE, fontWeight: 800 }}>
            {tasksAvailable && settleM > 0 ? `${m2k.toFixed(1)}%` : "—"}
          </span>
        </span>
      </div>
    </div>
  );
}

function FunnelRow({ t, label, color, pct, value, showValue, disabled }) {
  const bp = Math.min(100, Math.max(0, Number(pct) || 0));
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "78px minmax(0, 1fr) auto",
      gap: 10, alignItems: "center",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: color,
        letterSpacing: 0.3,
        opacity: disabled ? 0.4 : 1,
      }}>{label}</div>
      <div style={{
        position: "relative", height: 14,
        background: t.bgInset || "rgba(148,163,184,0.10)",
        border: `1px solid ${t.border || "var(--border)"}`,
        borderRadius: 4, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: 0,
          width: `${bp}%`,
          background: color,
          opacity: disabled ? 0.3 : 1,
          transition: "width 0.3s ease",
        }}/>
      </div>
      <div className="mono" style={{
        fontSize: 12, fontWeight: 800,
        color: t.text || "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.2px",
        minWidth: 84, textAlign: "right",
      }}>
        {showValue ? (
          <>
            {Number(value || 0).toLocaleString("ko-KR")}
            <span style={{
              marginLeft: 4, fontSize: 10, fontWeight: 700,
              color: t.textMuted || "var(--text-tertiary, var(--text-secondary))",
            }}>({bp.toFixed(0)}%)</span>
          </>
        ) : (
          <span style={{ color: t.textMuted }}>—</span>
        )}
      </div>
    </div>
  );
}

// 2026-07-11 — 기간 필터 세그먼트 + custom date picker.
//   [오늘] [이번 달] [직접 선택]. 선택 기간 라벨 표시.
function PeriodFilter({ t, period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd, startYmd, endYmd }) {
  const isCustom = period === "custom";
  const rangeLabel = startYmd === endYmd ? `${startYmd} (하루)` : `${startYmd} ~ ${endYmd}`;
  const periodLabel = period === "today" ? "오늘"
                    : period === "month" ? "이번 달"
                    : "직접 선택";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* 프리셋 세그먼트 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {PERIOD_OPTS.map(opt => {
          const on = period === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              style={{
                padding: "6px 14px",
                background: on ? "#FF1B8D" : "transparent",
                border: `1px solid ${on ? "#FF1B8D" : (t.border || "var(--border)")}`,
                borderRadius: 999,
                color: on ? "#fff" : (t.textSecondary || "var(--text-secondary)"),
                fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}>{opt.label}</button>
          );
        })}
      </div>

      {/* custom 시 시작~종료 date picker */}
      {isCustom && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="date"
            value={customStart}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setCustomStart(v);
              if (v > customEnd) setCustomEnd(v);
            }}
            style={{
              padding: "5px 10px",
              background: t.bgElevated || "#fff",
              border: `1px solid ${t.border || "var(--border)"}`,
              borderRadius: 8,
              color: t.text || "var(--text-primary)",
              fontSize: 12, fontWeight: 700,
              fontFamily: "inherit", outline: "none",
            }}
            aria-label="시작일"
          />
          <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 700 }}>~</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setCustomEnd(v);
              if (v < customStart) setCustomStart(v);
            }}
            style={{
              padding: "5px 10px",
              background: t.bgElevated || "#fff",
              border: `1px solid ${t.border || "var(--border)"}`,
              borderRadius: 8,
              color: t.text || "var(--text-primary)",
              fontSize: 12, fontWeight: 700,
              fontFamily: "inherit", outline: "none",
            }}
            aria-label="종료일"
          />
        </div>
      )}

      {/* 선택 기간 라벨 */}
      <div style={{
        fontSize: 11, color: t.textMuted || "var(--text-tertiary, var(--text-secondary))",
        fontWeight: 600,
      }}>
        {periodLabel} · {rangeLabel} · KST
      </div>
    </div>
  );
}

function BigStatCard({ t, label, value, subLine, color, loading, emphasize }) {
  return (
    <div style={{
      padding: emphasize ? "14px 16px" : "12px 14px",
      background: emphasize ? `${color}10` : (t.bgInset || "rgba(255,255,255,0.03)"),
      border: `1px solid ${emphasize ? `${color}55` : (t.border || "var(--border)")}`,
      borderRadius: 10,
      display: "flex", flexDirection: "column", gap: 6,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
        color: color,
        textTransform: "uppercase",
      }}>{label}</div>
      <div className="mono" style={{
        fontSize: 32, fontWeight: 900,
        color: t.text || "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-1px",
        lineHeight: 1.02,
      }}>
        {loading ? "—" : value}
      </div>
      {subLine && (
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: t.textSecondary || "var(--text-secondary)",
        }}>
          {subLine}
        </div>
      )}
    </div>
  );
}

// 옛 FunnelHero 는 사장님 spec (v4) 로 SimpleThreeStats 로 대체됨. 남은 함수 signature 는 dead code.
function _UnusedFunnelHero({ t, totalT, spamS, validV, inquiryOnlyQ, settleM, doneK,
                     spamRate, inquiryOnlyRate, convRate, doneRate, loading,
                     tasksAvailable = true }) {
  const spamPct        = totalT > 0 ? (spamS        / totalT) * 100 : 0;
  const validPct       = totalT > 0 ? (validV       / totalT) * 100 : 0;
  const inquiryOnlyPct = totalT > 0 ? (inquiryOnlyQ / totalT) * 100 : 0;
  const settlePct      = totalT > 0 ? (settleM      / totalT) * 100 : 0;
  const donePct        = totalT > 0 ? (doneK        / totalT) * 100 : 0;
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* 상단 요약 — 전체 접수 T (스팸 S 제외 → 유효 V) */}
      <div style={{
        display: "flex", alignItems: "baseline", gap: 8,
        padding: "2px 4px",
        fontSize: 11, fontWeight: 700,
        color: t.textSecondary || "var(--text-secondary)",
      }}>
        <span>전체 접수 <span className="mono" style={{ color: t.text || "var(--text-primary)", fontWeight: 800 }}>{fmtNum(totalT)}</span> 건</span>
        <span style={{ color: t.textMuted }}>·</span>
        <span>스팸 <span className="mono" style={{ color: COLOR_SPAM, fontWeight: 800 }}>{fmtNum(spamS)}</span> ({spamRate.toFixed(1)}%) 제외</span>
        <span style={{ color: t.textMuted }}>=</span>
        <span>유효 <span className="mono" style={{ color: COLOR_TOTAL, fontWeight: 800 }}>{fmtNum(validV)}</span> 건</span>
      </div>

      {/* 3개 큰 숫자 (라벨/값/비율) — 유효 접수 기준 성사/완료 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 8,
        alignItems: "stretch",
      }}>
        <HeroStat t={t}
          label="유효 접수"
          value={fmtNum(validV)}
          suffix="건"
          color={COLOR_TOTAL}
          rate={null}
          loading={loading}
        />
        <HeroStat t={t}
          label="성사 (전환)"
          value={tasksAvailable ? fmtNum(settleM) : "—"}
          suffix={tasksAvailable ? "건" : ""}
          color={COLOR_CONV}
          rate={tasksAvailable && validV > 0 ? `${convRate.toFixed(1)}%` : "—"}
          rateLabel="전환율"
          loading={loading}
          emphasize
        />
        <HeroStat t={t}
          label="완료"
          value={tasksAvailable ? fmtNum(doneK) : "—"}
          suffix={tasksAvailable ? "건" : ""}
          color={COLOR_DONE}
          rate={tasksAvailable && settleM > 0 ? `${doneRate.toFixed(1)}%` : "—"}
          rateLabel="성사 대비 완료"
          loading={loading}
          emphasize
        />
      </div>

      {/* 퍼널 폭 시각화 (bar = 전체 접수 100% 기준) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <FunnelWidthBar t={t} label="전체"    barPct={100}            labelPct={100}            color={COLOR_TOTAL} align="left"/>
        <FunnelWidthBar t={t} label="스팸"    barPct={spamPct}        labelPct={spamRate}       labelSuffix=" (전체 대비)" color={COLOR_SPAM}    align="center"/>
        <FunnelWidthBar t={t} label="유효"    barPct={validPct}       labelPct={100 - spamRate} labelSuffix=" (전체 대비)" color={COLOR_TOTAL}   align="center"/>
        <FunnelWidthBar t={t} label="문의만"  barPct={inquiryOnlyPct} labelPct={inquiryOnlyRate} labelSuffix=" (유효 대비, 미배정)" color={COLOR_INQ_ONLY} align="center"/>
        <FunnelWidthBar t={t} label="성사"    barPct={settlePct}      labelPct={convRate}       labelSuffix=" (유효 대비)" color={COLOR_CONV}    align="center"/>
        <FunnelWidthBar t={t} label="완료"    barPct={donePct}        labelPct={doneRate}       labelSuffix=" (성사 대비)" color={COLOR_DONE}    align="center"/>
      </div>
    </div>
  );
}

function HeroStat({ t, label, value, suffix, color, rate, rateLabel, loading, emphasize }) {
  return (
    <div style={{
      gridColumn: "span 1",
      padding: emphasize ? "12px 14px" : "10px 12px",
      background: emphasize ? `${color}10` : (t.bgInset || "rgba(255,255,255,0.03)"),
      border: `1px solid ${emphasize ? `${color}55` : (t.border || "var(--border)")}`,
      borderRadius: 10,
      display: "flex", flexDirection: "column", gap: 4,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
        color: color,
        textTransform: "uppercase",
      }}>{label}</div>
      <div className="mono" style={{
        fontSize: emphasize ? 26 : 22, fontWeight: 900,
        color: t.text || "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.7px",
        lineHeight: 1.05,
        display: "flex", alignItems: "baseline", gap: 4,
      }}>
        {loading ? "—" : value}
        <span style={{ fontSize: 12, fontWeight: 700, color: t.textMuted || "#94a3b8" }}>{suffix}</span>
      </div>
      {rate && (
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: t.textSecondary || "var(--text-secondary)",
        }}>
          <span style={{ color: t.textMuted, marginRight: 3 }}>{rateLabel || "비율"}</span>
          <span className="mono" style={{ color: color, fontWeight: 800 }}>{rate}</span>
        </div>
      )}
    </div>
  );
}

function HeroArrow({ color }) {
  return (
    <div style={{
      display: "none", // grid 안에서 별도 화살표 아이콘 생략 (grid 3열 유지, 화살표 시각 미포함).
      // hidden — 향후 활성 원하면 display: "flex" 로 전환.
      alignItems: "center", justifyContent: "center",
      fontSize: 22, color,
    }}>→</div>
  );
}

function FunnelWidthBar({ t, label, barPct, labelPct, labelSuffix, color, align }) {
  const bp = Math.min(100, Math.max(0, Number(barPct) || 0));
  const lp = Number(labelPct) || 0;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "60px minmax(0, 1fr) auto",
      gap: 10, alignItems: "center",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: color,
        textTransform: "uppercase", letterSpacing: 0.3,
      }}>{label}</div>
      <div style={{
        position: "relative", height: 10,
        background: t.bgInset || "rgba(255,255,255,0.04)",
        border: `1px solid ${t.border || "var(--border)"}`,
        borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute",
          top: 0, bottom: 0,
          left: align === "center" ? `${(100 - bp) / 2}%` : 0,
          width: `${bp}%`,
          background: color,
        }}/>
      </div>
      <div className="mono" style={{
        fontSize: 10, fontWeight: 700, minWidth: 92, textAlign: "right",
        color: t.textMuted || "var(--text-tertiary, var(--text-secondary))",
        fontVariantNumeric: "tabular-nums",
      }}>
        {lp.toFixed(0)}%{labelSuffix || ""}
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 8, height: 8, background: color, borderRadius: 2 }}/>
      {label}
    </span>
  );
}

// 2026-07-10 hotfix — 크래시 격리용 ErrorBoundary.
//   render / effect 예외로 화면 전체 죽는 사고 방지.
class InquiryStatsErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    console.warn("[InquiryStatsHeader] render crash — 격리됨", err, info);
  }
  render() {
    if (this.state.err) {
      const t = this.props.t || {};
      return (
        <div style={{
          padding: "14px", marginBottom: 14,
          background: t.bgElevated || "#fff",
          border: `1px solid ${t.border || "#e5e7eb"}`,
          borderRadius: 12,
          color: t.textMuted || "#94a3b8",
          fontSize: 12, fontWeight: 600, textAlign: "center",
        }}>
          통계 헤더 표시 실패 (접수 목록은 정상 동작) ·{" "}
          <button type="button"
            onClick={() => this.setState({ err: null })}
            style={{
              background: "transparent", border: "none",
              color: "#FF1B8D",
              fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              textDecoration: "underline",
            }}>다시 시도</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Empty({ t, children }) {
  return (
    <div style={{
      padding: "18px 12px", textAlign: "center",
      color: t.textMuted || "var(--text-tertiary, var(--text-secondary))",
      fontSize: 11, fontWeight: 600,
      background: t.bgInset || "rgba(255,255,255,0.03)",
      border: `1px dashed ${t.border || "var(--border)"}`,
      borderRadius: 8,
    }}>{children}</div>
  );
}

export default InquiryStatsHeader;
