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

const ACCENT       = "#FF1B8D";
const COLOR_TOTAL  = "#3B82F6";   // 접수 — 파랑
const COLOR_SPAM   = "#9CA3AF";   // 스팸 — 회색
const COLOR_CONV   = "#16A34A";   // 성사 — 초록
const COLOR_DONE   = "#FF1B8D";   // 완료 — 핑크 (accent)

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

export function InquiryStatsHeader({ t, actorId }) {
  const [dailyDays, setDailyDays] = useState(14);
  const [totals, setTotals]   = useState({});
  const [funnel, setFunnel]   = useState({});
  const [daily, setDaily]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

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
    ]).then(([fRes, dRes]) => {
      if (!alive) return;
      if (!fRes.ok) setError(fRes.error || "통계 불러오기 실패");
      else { setTotals(fRes.totals); setFunnel(fRes.funnel); }
      if (dRes.ok) setDaily(dRes.items);
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

  // 퍼널 3단계 지표.
  //   접수  = 전 기간 스팸 제외 총합. totals.all_time_excl_spam 우선. 없으면 funnel.total_excl_spam.
  //   성사  = converted + completed_in (Mig 152 이후 converted 상태 유지, 완료는 completed_in 상태로 이동).
  //   완료  = totals.all_time_completed 우선. 없으면 funnel.completed_in.
  const acceptN  = Number(totals.all_time_excl_spam ?? funnel.total_excl_spam ?? 0);
  const doneK    = Number(totals.all_time_completed ?? funnel.completed_in ?? 0);
  const settleM  = Number(funnel.converted || 0) + Number(funnel.completed_in || 0);
  const convRate = acceptN > 0 ? (settleM / acceptN) * 100 : 0;
  const doneRate = acceptN > 0 ? (doneK   / acceptN) * 100 : 0;

  return (
    <div style={{
      background: t.bgElevated || "var(--bg-elevated)",
      border: `1px solid ${t.border || "var(--border)"}`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      {/* 히어로 퍼널 — 접수 → 성사 → 완료 */}
      <FunnelHero
        t={t}
        acceptN={acceptN}
        settleM={settleM}
        doneK={doneK}
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

// 히어로 — 접수 N → 성사 M (전환율%) → 완료 K (완료율%).
//   퍼널 시각화: 왼쪽 값 (접수) 최대, 성사·완료 는 접수 대비 폭으로 시각화.
function FunnelHero({ t, acceptN, settleM, doneK, convRate, doneRate, loading }) {
  const settlePct = acceptN > 0 ? Math.min(100, (settleM / acceptN) * 100) : 0;
  const donePct   = acceptN > 0 ? Math.min(100, (doneK   / acceptN) * 100) : 0;
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* 3개 큰 숫자 (라벨/값/비율) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 8,
        alignItems: "stretch",
      }}>
        <HeroStat t={t}
          label="접수"
          value={fmtNum(acceptN)}
          suffix="건"
          color={COLOR_TOTAL}
          rate={null}
          loading={loading}
        />
        <HeroArrow color={t.textMuted || "#94a3b8"}/>
        <HeroStat t={t}
          label="성사 (전환)"
          value={fmtNum(settleM)}
          suffix="건"
          color={COLOR_CONV}
          rate={acceptN > 0 ? `${convRate.toFixed(1)}%` : "—"}
          rateLabel="전환율"
          loading={loading}
          emphasize
        />
        <HeroArrow color={t.textMuted || "#94a3b8"}/>
        <HeroStat t={t}
          label="완료"
          value={fmtNum(doneK)}
          suffix="건"
          color={COLOR_DONE}
          rate={acceptN > 0 ? `${doneRate.toFixed(1)}%` : "—"}
          rateLabel="완료율"
          loading={loading}
          emphasize
        />
      </div>

      {/* 퍼널 폭 시각화 (접수=100% 기준) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <FunnelWidthBar t={t} label="접수" value={acceptN} pct={100}      color={COLOR_TOTAL} align="left"/>
        <FunnelWidthBar t={t} label="성사" value={settleM} pct={settlePct} color={COLOR_CONV}  align="center"/>
        <FunnelWidthBar t={t} label="완료" value={doneK}   pct={donePct}   color={COLOR_DONE}  align="center"/>
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

function FunnelWidthBar({ t, label, value, pct, color, align }) {
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
          left: align === "center" ? `${(100 - pct) / 2}%` : 0,
          width: `${Math.min(100, Math.max(0, pct))}%`,
          background: color,
        }}/>
      </div>
      <div className="mono" style={{
        fontSize: 10, fontWeight: 700, minWidth: 44, textAlign: "right",
        color: t.textMuted || "var(--text-tertiary, var(--text-secondary))",
        fontVariantNumeric: "tabular-nums",
      }}>
        {pct.toFixed(0)}%
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
