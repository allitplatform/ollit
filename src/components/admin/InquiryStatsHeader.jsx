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

import { useState, useEffect, useMemo } from "react";
import {
  getInquiryDailyCounts,
  getInquiryFunnel,
  ymdKstNDaysAgo,
  ymdKstToday,
} from "../../lib/inquiryStatsDb.js";
import { listInquiries } from "../../lib/inquiriesDb.js";

const ACCENT       = "#FF1B8D";
const COLOR_TOTAL  = "#3B82F6";   // 접수 — 파랑
const COLOR_SPAM   = "#9CA3AF";   // 스팸 — 회색
const COLOR_CONV   = "#16A34A";   // 성사 — 초록
const COLOR_DONE   = "#FF1B8D";   // 완료 — 핑크 (accent)
const COLOR_INQ_ONLY = "#F59E0B"; // 문의만(미배정) — 주황

// 히어로는 all-time 지표. funnel 을 넉넉한 범위로 조회.
const ALL_TIME_START = "2020-01-01";

const DAILY_PRESETS = [
  { days: 7,  label: "7일" },
  { days: 14, label: "14일" },
  { days: 30, label: "30일" },
];

function fmtNum(n) { return (Number(n) || 0).toLocaleString("ko-KR"); }
function fmtPct(n) {
  if (n == null || isNaN(Number(n))) return "—";
  return `${Number(n).toFixed(1)}%`;
}

export function InquiryStatsHeader({ t, actorId, apiTasks = [] }) {
  const [dailyDays, setDailyDays] = useState(14);
  const [totals, setTotals]   = useState({});
  const [funnel, setFunnel]   = useState({});
  const [daily, setDaily]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  // 2026-07-10 — 성사/완료 판정: converted inquiries.task_id → apiTasks join.
  const [convertedTaskIds, setConvertedTaskIds] = useState(() => new Set());

  useEffect(() => {
    if (!actorId) return;
    let alive = true;
    setLoading(true);
    setError("");

    const today = ymdKstToday();
    const dailyStart  = ymdKstNDaysAgo(dailyDays - 1);

    Promise.all([
      // 히어로 퍼널: 전 기간 (사장님 spec 성사/완료 중심).
      getInquiryFunnel({ actorId, startYmd: ALL_TIME_START, endYmd: today }),
      getInquiryDailyCounts({ actorId, startYmd: dailyStart, endYmd: today }),
      // 2026-07-10 — converted inquiries.task_id → apiTasks join (성사/완료 판별).
      listInquiries(actorId, "converted"),
    ]).then(([fRes, dRes, cvRows]) => {
      if (!alive) return;
      if (!fRes.ok) setError(fRes.error || "통계 불러오기 실패");
      else { setTotals(fRes.totals); setFunnel(fRes.funnel); }
      if (dRes.ok) setDaily(dRes.items);
      const ids = new Set();
      for (const r of (cvRows || [])) {
        if (r.task_id) ids.add(String(r.task_id));
      }
      setConvertedTaskIds(ids);
    }).finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [actorId, dailyDays]);

  const maxDaily = useMemo(() => {
    let m = 0;
    for (const d of daily) {
      const sum = (d.total || 0) + (d.spam || 0);
      if (sum > m) m = sum;
    }
    return Math.max(m, 1);
  }, [daily]);

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

  // 성사/완료: apiTasks + convertedTaskIds join.
  const { rawSettle, rawDone } = useMemo(() => {
    if (!apiTasks || apiTasks.length === 0 || convertedTaskIds.size === 0) {
      return { rawSettle: 0, rawDone: 0 };
    }
    let settle = 0, done = 0;
    for (const task of apiTasks) {
      if (!task || !task.id) continue;
      if (!convertedTaskIds.has(String(task.id))) continue;
      // 성사 판정 = 기사 배정됨.
      const eid = task.assignedEngineerId || task.assigned_engineer_id
               || task.engineerId         || task.engineer_id;
      const ename = task.assignedEngineer || task.engineer;
      const isAssigned = !!(eid || (ename && String(ename).trim().length > 0));
      if (!isAssigned) continue;
      settle += 1;
      // 완료 판정 = task.status IN ('완료','정산완료').
      const st = task.status || "";
      if (st === "완료" || st === "정산완료") done += 1;
    }
    return { rawSettle: settle, rawDone: done };
  }, [apiTasks, convertedTaskIds]);

  const settleM       = Math.min(rawSettle, validV);
  const doneK         = Math.min(rawDone,   settleM);
  const inquiryOnlyQ  = Math.max(0, validV - settleM);

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
      apiTasksCount:    apiTasks.length,
      clamp: {
        settle: rawSettle !== settleM,
        done:   rawDone   !== doneK,
      },
    }));
  }, [totalT, validV, spamS, settleM, doneK, funnel, inquiryOnlyQ, convertedTaskIds, apiTasks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      background: t.bgElevated || "var(--bg-elevated)",
      border: `1px solid ${t.border || "var(--border)"}`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      {/* 히어로 퍼널 — 전체 → 스팸 → 유효 → 문의만 + 성사 → 완료 */}
      <FunnelHero
        t={t}
        totalT={totalT}
        spamS={spamS}
        validV={validV}
        inquiryOnlyQ={inquiryOnlyQ}
        settleM={settleM}
        doneK={doneK}
        spamRate={spamRate}
        inquiryOnlyRate={inquiryOnlyRate}
        convRate={convRate}
        doneRate={doneRate}
        loading={loading}
      />

      {/* 미니 라인 — 오늘 · 이번달 (히어로 대비 보조) */}
      <div style={{
        display: "flex", gap: 12, flexWrap: "wrap",
        fontSize: 11, fontWeight: 700,
        color: t.textSecondary || "var(--text-secondary)",
        paddingTop: 4, borderTop: `1px dashed ${t.border || "var(--border)"}`,
      }}>
        <span>오늘 <span className="mono" style={{ color: t.text || "var(--text-primary)", fontWeight: 800 }}>{fmtNum(totals.today)}</span> 건</span>
        <span style={{ color: t.textMuted }}>·</span>
        <span>이번 달 <span className="mono" style={{ color: t.text || "var(--text-primary)", fontWeight: 800 }}>{fmtNum(totals.this_month)}</span> 건</span>
      </div>

      {/* 일별 막대 (보조 유지) */}
      <div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.text || "var(--text-primary)" }}>
            일별 접수
          </div>
          <div style={{ flex: 1 }}/>
          <div style={{ display: "flex", gap: 4 }}>
            {DAILY_PRESETS.map(p => {
              const on = dailyDays === p.days;
              return (
                <button key={p.days} type="button"
                  onClick={() => setDailyDays(p.days)}
                  style={{
                    padding: "4px 10px",
                    background: on ? ACCENT : "transparent",
                    border: `1px solid ${on ? ACCENT : (t.border || "var(--border)")}`,
                    borderRadius: 999,
                    color: on ? "#fff" : (t.textSecondary || "var(--text-secondary)"),
                    fontSize: 10, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>{p.label}</button>
              );
            })}
          </div>
        </div>
        {loading && daily.length === 0 ? (
          <Empty t={t}>불러오는 중...</Empty>
        ) : daily.length === 0 ? (
          <Empty t={t}>데이터 없음</Empty>
        ) : (
          <div style={{
            display: "flex", gap: 3, alignItems: "flex-end",
            height: 90,
            padding: "4px 0",
          }}>
            {daily.map(d => {
              const sum = (d.total || 0) + (d.spam || 0);
              const tH = (d.total / maxDaily) * 80;
              const sH = (d.spam  / maxDaily) * 80;
              return (
                <div key={d.ymd} style={{
                  flex: 1, minWidth: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 2,
                  height: "100%", justifyContent: "flex-end",
                }} title={`${d.ymd} · 접수 ${d.total} · 스팸 ${d.spam}`}>
                  {sum > 0 ? (
                    <>
                      {d.spam > 0 && (
                        <div style={{
                          width: "100%", maxWidth: 18,
                          height: `${Math.max(2, sH)}px`,
                          background: COLOR_SPAM, borderRadius: "2px 2px 0 0",
                        }}/>
                      )}
                      {d.total > 0 && (
                        <div style={{
                          width: "100%", maxWidth: 18,
                          height: `${Math.max(2, tH)}px`,
                          background: COLOR_TOTAL,
                          borderRadius: d.spam > 0 ? 0 : "2px 2px 0 0",
                        }}/>
                      )}
                    </>
                  ) : (
                    <div style={{ width: "100%", maxWidth: 18, height: 1, background: t.border || "var(--border)" }}/>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{
          display: "flex", gap: 10, justifyContent: "flex-end",
          fontSize: 10, color: t.textMuted || "var(--text-tertiary, var(--text-secondary))",
          fontWeight: 600, marginTop: 4,
        }}>
          <Legend color={COLOR_TOTAL} label="접수"/>
          <Legend color={COLOR_SPAM}  label="스팸"/>
        </div>
      </div>

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

// 히어로 — 전체 T → 스팸 S → 유효 V → 문의만 Q + 성사 M → 완료 K.
//   ⚠️ 성사 정의: task 존재 AND 기사 배정됨. 미배정 = 문의만.
//   퍼널 폭 시각화 (bar): 전체 (T) 100% 기준.
//   라벨 %: 각 단계별 상위 대비.
function FunnelHero({ t, totalT, spamS, validV, inquiryOnlyQ, settleM, doneK,
                     spamRate, inquiryOnlyRate, convRate, doneRate, loading }) {
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
          value={fmtNum(settleM)}
          suffix="건"
          color={COLOR_CONV}
          rate={validV > 0 ? `${convRate.toFixed(1)}%` : "—"}
          rateLabel="전환율"
          loading={loading}
          emphasize
        />
        <HeroStat t={t}
          label="완료"
          value={fmtNum(doneK)}
          suffix="건"
          color={COLOR_DONE}
          rate={settleM > 0 ? `${doneRate.toFixed(1)}%` : "—"}
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
