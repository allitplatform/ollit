// 2026-06-28 — 접수함 통계 헤더 (Mig 151 RPC 연결).
//   AdminInquiriesScreen 상단. 시안(inquiry_funnel_mockup) 패턴.
//   구성:
//     · 카드 4: 오늘 신규 / 이번 달 / 누적(스팸제외) / 전환율%
//     · 일별 막대: 7/14/30 토글 (기본 14)
//     · 현재상태 분포: 신규/통화함/전환됨/완료_in (⚠️ "누적 통과 아님 — 현재 상태" 라벨 명확)
//
//   ⚠️ 퍼널 (현재상태 분포) 와 전환율 카드 의미 구분:
//     · 카드 전환율 = 누적완료/누적접수 (진짜 전환률, 누적 KPI)
//     · 분포 막대  = 지정 기간 접수의 현재 상태 분포 (mutually exclusive, "지금 어디 머무는가")

import { useState, useEffect, useMemo } from "react";
import {
  getInquiryDailyCounts,
  getInquiryFunnel,
  ymdKstNDaysAgo,
  ymdKstToday,
} from "../../lib/inquiryStatsDb.js";

const ACCENT       = "#FF1B8D";
const COLOR_TOTAL  = "#3B82F6";   // 신규/접수 — 파랑
const COLOR_SPAM   = "#9CA3AF";   // 스팸 — 회색
const COLOR_NEW    = "#DC2626";   // 신규 (분포) — 빨강 (inquiriesDb INQUIRY_STATUS 와 일관)
const COLOR_CONT   = "#2563EB";   // 통화함 — 파랑
const COLOR_CONV   = "#16A34A";   // 전환됨 — 초록
const COLOR_DONE   = "#FF1B8D";   // 완료_in — 핑크 (accent)

const FUNNEL_DAYS = 30;
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
  const [tick, setTick]       = useState(0);

  useEffect(() => {
    if (!actorId) return;
    let alive = true;
    setLoading(true);
    setError("");

    const today = ymdKstToday();
    const funnelStart = ymdKstNDaysAgo(FUNNEL_DAYS - 1);
    const dailyStart  = ymdKstNDaysAgo(dailyDays - 1);

    Promise.all([
      getInquiryFunnel({ actorId, startYmd: funnelStart, endYmd: today }),
      getInquiryDailyCounts({ actorId, startYmd: dailyStart, endYmd: today }),
    ]).then(([fRes, dRes]) => {
      if (!alive) return;
      if (!fRes.ok) setError(fRes.error || "통계 불러오기 실패");
      else { setTotals(fRes.totals); setFunnel(fRes.funnel); }
      if (dRes.ok) setDaily(dRes.items);
    }).finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [actorId, dailyDays, tick]);

  const maxDaily = useMemo(() => {
    let m = 0;
    for (const d of daily) {
      const sum = (d.total || 0) + (d.spam || 0);
      if (sum > m) m = sum;
    }
    return Math.max(m, 1);
  }, [daily]);

  // 분포 막대 — 최대값 (4 단계 중 가장 큰 거)
  const funnelTotal = Number(funnel.total_excl_spam || 0);
  const denom = funnelTotal > 0 ? funnelTotal : 1;

  return (
    <div style={{
      background: t.bgElevated || "var(--bg-elevated)",
      border: `1px solid ${t.border || "var(--border)"}`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      {/* 카드 4 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
        gap: 8,
      }}>
        <Card t={t} label="오늘 신규"        value={fmtNum(totals.today)}/>
        <Card t={t} label="이번 달"          value={fmtNum(totals.this_month)}/>
        <Card t={t} label="누적 (스팸제외)"  value={fmtNum(totals.all_time_excl_spam)}/>
        <Card t={t} label={`전환율${totals.all_time_completed != null ? ` (${fmtNum(totals.all_time_completed)}건)` : ""}`}
                    value={fmtPct(totals.conversion_rate_pct)} accent/>
      </div>

      {/* 일별 막대 */}
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

      {/* 현재 상태 분포 */}
      <div>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8,
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.text || "var(--text-primary)" }}>
            현재 상태 분포
          </div>
          <div style={{
            fontSize: 10, color: t.textMuted || "var(--text-tertiary, var(--text-secondary))",
            fontWeight: 600,
          }}>
            (지난 {FUNNEL_DAYS}일 접수 · "누적 통과 아님 — 지금 그 상태인 건수")
          </div>
        </div>
        {funnelTotal === 0 ? (
          <Empty t={t}>지난 {FUNNEL_DAYS}일 접수 없음</Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FunnelBar t={t} label="신규 (new)"        value={funnel.new}          denom={denom} color={COLOR_NEW}/>
            <FunnelBar t={t} label="통화함 (contacted)" value={funnel.contacted}    denom={denom} color={COLOR_CONT}/>
            <FunnelBar t={t} label="전환됨 (converted)" value={funnel.converted}    denom={denom} color={COLOR_CONV}/>
            <FunnelBar t={t} label="완료 (task=완료)"  value={funnel.completed_in} denom={denom} color={COLOR_DONE} subtle/>
            {(funnel.spam || 0) > 0 && (
              <div style={{
                fontSize: 10, color: t.textMuted || "var(--text-tertiary, var(--text-secondary))",
                fontWeight: 600, marginTop: 2,
              }}>
                (스팸 {funnel.spam}건 — 분모 제외)
              </div>
            )}
          </div>
        )}
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

function Card({ t, label, value, accent }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: t.bgInset || t.bgSecondary || "rgba(255,255,255,0.03)",
      border: `1px solid ${t.border || "var(--border)"}`,
      borderRadius: 8,
      display: "flex", flexDirection: "column", gap: 4,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, color: t.textMuted || "var(--text-tertiary, var(--text-secondary))",
        fontWeight: 700, letterSpacing: 0.3,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{label}</div>
      <div className="mono" style={{
        fontSize: 18, fontWeight: 800,
        color: accent ? ACCENT : (t.text || "var(--text-primary)"),
        letterSpacing: "-0.5px",
        fontVariantNumeric: "tabular-nums",
      }}>{value}</div>
    </div>
  );
}

function FunnelBar({ t, label, value, denom, color, subtle }) {
  const v = Number(value || 0);
  const pct = denom > 0 ? (v / denom) * 100 : 0;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(110px, 1.2fr) 1fr auto",
      gap: 10, alignItems: "center",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700,
        color: t.textSecondary || "var(--text-secondary)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{label}</div>
      <div style={{
        position: "relative", height: 14,
        background: t.bgInset || "rgba(255,255,255,0.04)",
        border: `1px solid ${t.border || "var(--border)"}`,
        borderRadius: 4, overflow: "hidden",
      }}>
        <div style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          height: "100%", background: color,
          opacity: subtle ? 0.85 : 1,
        }}/>
      </div>
      <div className="mono" style={{
        fontSize: 11, fontWeight: 800,
        color: t.text || "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
        minWidth: 56, textAlign: "right",
      }}>
        {fmtNum(v)} <span style={{ color: t.textMuted || "var(--text-tertiary, var(--text-secondary))", fontWeight: 600 }}>· {pct.toFixed(0)}%</span>
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
