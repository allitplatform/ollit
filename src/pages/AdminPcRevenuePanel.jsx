// 2026-06-12 — AdminApp PC 매출 패널 (1024px+).
// 2026-06-16 재설계 (사장님 spec):
//   · 도넛 색: 기사 #378ADD / 원청 #EF9F27 / 회사 #D4537E (literal hex)
//   · 우 범례 재배치: 회사 마진(상단·핑크 강조·주표시) → 구분선 → 기사·원청 (보조)
//   · 범례 각 항목에 % 표시
//   · 하단: 세척/냉매/기타 가로 바 (visit_only travel 합 = '기타')
//   · ≥1280px 폭에선 도넛 190px 로 키움
//   · 모바일(<1024)은 옛 RevenueOverviewBlock 그대로 (변경 없음).
//
// 데이터: computeRevenueByYmRange 재사용 (byServiceDetail.{cleaning,refrigerant,other}).
//   other 버킷이 이미 visit_only travel 포함 (isTrackARemittance + pickServiceCode 'visit_fee' → other).

import { useState, useMemo } from "react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";
import { useMinWidth } from "../utils/useIsPc.js";
import {
  computeRevenueByYmRange,
  getPrevMonthSameDay,
  getMonthStart,
  getPrevMonthStart,
  fromServerSummary,
} from "../utils/revenueStats.js";
import { isTrackARemittance } from "../utils/remitFilter.js";

// 도넛/범례 색 — 사장님 spec (2026-06-16).
const COLOR_ENGINEER  = "#378ADD";  // 파랑 — 기사 정산
const COLOR_PRINCIPAL = "#FFB800";  // 노랑 — 원청 수수료
const COLOR_OWNER     = "#D4537E";  // 핑크 — 회사 마진 (주표시)
// 종류별 가로 바 색.
const COLOR_CLEANING    = "#0EA5E9";  // 세척 (옛 ServiceBox 색 유지)
const COLOR_REFRIGERANT = "#FFB800";  // 냉매
const COLOR_OTHER       = "#9CA3AF";  // 기타 (회색 — visit_only 등 기타)

function fmtKRW(n) {
  return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
}

export function AdminPcRevenuePanel({ t, apiTasks = [], user, onDetailClick, onClickEngineerList, serverSummary = null, serverRanges = null }) {
  const [period, setPeriod] = useState("today"); // 'today' | 'month'
  // 2026-06-16 — ≥1280px 에선 도넛을 키워서 보기 좋게 (사장님 spec).
  const isWide = useMinWidth(1280);
  const donutSize = isWide ? 190 : 170;

  const { current, previous, periodLabel } = useMemo(() => {
    const today = todayYmd();
    let curStart, curEnd, prevStart, prevEnd, label;
    if (period === "today") {
      curStart = today; curEnd = today;
      prevStart = getPrevMonthSameDay(today); prevEnd = prevStart;
      label = "오늘";
    } else {
      curStart = getMonthStart(today); curEnd = today;
      prevStart = getPrevMonthStart(today); prevEnd = getPrevMonthSameDay(today);
      label = "이번 달";
    }
    // 2026-07-14 — Stage 2c/3: 서버 집계 우선 (오늘=Mig 175 / 이번달·전월비=Mig 176). 없으면 클라 fallback.
    const _sv = (o) => (o && o.revenue) ? fromServerSummary(o) : null;
    const curFromServer = (period === "today")
      ? _sv(serverSummary)
      : _sv(serverRanges?.month);
    const prevFromServer = (period === "today")
      ? _sv(serverRanges?.prevSameDay)
      : _sv(serverRanges?.prevMonthToDate);
    return {
      current:  curFromServer  || computeRevenueByYmRange(apiTasks, curStart, curEnd, user),
      previous: prevFromServer || computeRevenueByYmRange(apiTasks, prevStart, prevEnd, user),
      periodLabel: label,
    };
  }, [apiTasks, user, period, serverSummary, serverRanges]);

  const total = current.total || 0;
  const denom = total > 0 ? total : 1;
  const engineerPct  = (current.engineer  / denom) * 100;
  const principalPct = (current.principal / denom) * 100;
  const ownerPct     = (current.owner     / denom) * 100;

  const diffPct = previous.total > 0
    ? ((current.total - previous.total) / previous.total) * 100
    : null;

  // 2026-06-28 — install/leak 버킷 분리 (Mig 122/124/125).
  const sd = current.byServiceDetail || {
    cleaning:    { total: 0, count: 0, owner: 0 },
    refrigerant: { total: 0, count: 0, owner: 0 },
    install:     { total: 0, count: 0, owner: 0 },
    leak:        { total: 0, count: 0, owner: 0 },
    other:       { total: 0, count: 0, owner: 0 },
  };

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      {/* 헤더 + 토글 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
          📊 매출 현황
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "today", label: "오늘" },
            { id: "month", label: "이번 달" },
          ].map(opt => {
            const active = period === opt.id;
            return (
              <button key={opt.id} type="button"
                onClick={() => setPeriod(opt.id)}
                style={{
                  padding: "5px 12px",
                  background: active ? "var(--accent)" : "transparent",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 999,
                  color: active ? "#fff" : "var(--text-secondary)",
                  fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
            );
          })}
        </div>
      </div>

      {/* 상단 — 도넛(170/190 반응형) + 범례 블록(1fr). 회사 마진 주표시 → 구분선 → 기사·원청(보조). */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 24,
        alignItems: "center",
      }}>
        <Donut
          size={donutSize}
          total={total}
          engineerPct={engineerPct}
          principalPct={principalPct}
          diffPct={diffPct}
          periodLabel={periodLabel}
          count={current.count}
        />
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontVariantNumeric: "tabular-nums",
        }}>
          {/* 회사 마진 (주표시) — 상단·핑크·굵게. */}
          <RevItem
            color={COLOR_OWNER}
            label="회사 마진"
            amount={current.owner}
            pct={ownerPct}
            big
          />
          {/* 구분선 — 회사 마진(주표시)와 보조 항목(기사·원청) 분리. */}
          <div style={{
            borderTop: "1px solid var(--border)",
            marginTop: 2,
            paddingTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>
            <RevItem
              color={COLOR_ENGINEER}
              label="기사 정산"
              amount={current.engineer}
              pct={engineerPct}
              muted
            />
            <RevItem
              color={COLOR_PRINCIPAL}
              label="원청 수수료"
              amount={current.principal}
              pct={principalPct}
              muted
            />
          </div>
        </div>
      </div>

      {/* 하단 — 종류별 가로 바 (세척 / 냉매 / 기타). 기타 = visit_only travel 등. */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        borderTop: "1px solid var(--border)",
        paddingTop: 16,
      }}>
        <ServiceBar
          icon="❄"
          label="세척"
          color={COLOR_CLEANING}
          detail={sd.cleaning}
          total={total}
        />
        <ServiceBar
          icon="⚡"
          label="냉매"
          color={COLOR_REFRIGERANT}
          detail={sd.refrigerant}
          total={total}
        />
        {/* 2026-06-28 — install/leak 행 추가. 0 이면 숨김 (other 패턴 일관). */}
        {(sd.install?.total || 0) > 0 && (
          <ServiceBar
            icon="🔧"
            label="설치"
            color="#8B5CF6"
            detail={sd.install}
            total={total}
          />
        )}
        {(sd.leak?.total || 0) > 0 && (
          <ServiceBar
            icon="💧"
            label="누설"
            color="#DC2626"
            detail={sd.leak}
            total={total}
          />
        )}
        {(sd.other?.total || 0) > 0 && (
          <ServiceBar
            icon="🚗"
            label="기타"
            color={COLOR_OTHER}
            detail={sd.other}
            total={total}
          />
        )}
      </div>

      {/* 2026-06-19 — 오늘/이번달 기사별 정산 (period 토글 연동, KST 기준) */}
      <EngineerSettlementSection
        apiTasks={apiTasks}
        period={period}
        periodLabel={periodLabel}
        onClickAll={onClickEngineerList}
      />

      {/* 자세히 링크 (선택) */}
      {typeof onDetailClick === "function" && (
        <button type="button" onClick={onDetailClick}
          style={{
            padding: "10px 14px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-secondary)",
            fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>원청별·기사별 자세히 →</button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 도넛 — conic-gradient. 중심 hole 에 총 매출 (전체 금액).
// ──────────────────────────────────────────────────────────────────
function Donut({ size = 170, total, engineerPct, principalPct, diffPct, periodLabel, count }) {
  const s1 = engineerPct;
  const s2 = engineerPct + principalPct;
  const hasData = total > 0;
  // 가운데 hole 은 도넛 크기에 비례 (170→112 = 66%).
  const holeSize = Math.round(size * 0.66);

  return (
    <div style={{
      position: "relative",
      width: size, height: size,
      borderRadius: "50%",
      background: hasData
        ? `conic-gradient(
            ${COLOR_ENGINEER}  0% ${s1}%,
            ${COLOR_PRINCIPAL} ${s1}% ${s2}%,
            ${COLOR_OWNER}     ${s2}% 100%
          )`
        : "var(--bg-inset, #f0f0f0)",
      flexShrink: 0,
    }}>
      {/* 가운데 hole — 총 매출 표시 */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: holeSize, height: holeSize,
        borderRadius: "50%",
        background: "var(--bg-elevated)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        padding: 6,
        boxSizing: "border-box",
        textAlign: "center",
      }}>
        <span style={{
          fontSize: 9, color: "var(--text-secondary)",
          fontWeight: 700, letterSpacing: 0.3,
        }}>총 매출 · {periodLabel}</span>
        <span className="mono" style={{
          fontSize: 13, fontWeight: 800,
          color: "var(--text-primary)",
          letterSpacing: "-0.4px",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
          wordBreak: "keep-all",
        }}>{fmtKRW(total)}</span>
        <span style={{
          fontSize: 9, color: "var(--text-secondary)", fontWeight: 600,
        }}>{count}건</span>
        {diffPct !== null && (
          <span style={{
            fontSize: 9, fontWeight: 700,
            color: diffPct >= 0 ? "#10B981" : "#EF4444",
            marginTop: 1,
          }}>
            {diffPct >= 0 ? "▲" : "▼"} {Math.abs(diffPct).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 우측 항목 — 색점 + 라벨 + 금액 + % (사장님 spec 2026-06-16).
//   big=true → 회사 마진 주표시 (핑크·굵게·크게).
//   pct = 0~100 (총 매출 대비 비중). 표시 소수점 1자리.
// ──────────────────────────────────────────────────────────────────
function RevItem({ color, label, amount, pct, muted, big }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto auto minmax(0, 1fr) auto",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
    }}>
      <span style={{
        width: 10, height: 10, background: color, borderRadius: 3, flexShrink: 0,
      }}/>
      <span style={{
        fontSize: big ? 13 : 12,
        fontWeight: big ? 800 : 600,
        color: muted ? "var(--text-secondary)" : "var(--text-primary)",
        whiteSpace: "nowrap",
      }}>{label}</span>
      <span className="mono" style={{
        fontSize: big ? 16 : 13,
        fontWeight: big ? 800 : 700,
        color: big ? color : "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.3px",
        textAlign: "right",
      }}>{fmtKRW(amount)}</span>
      <span className="mono" style={{
        fontSize: big ? 11 : 10,
        fontWeight: 700,
        color: muted ? "var(--text-tertiary, var(--text-secondary))" : "var(--text-secondary)",
        fontVariantNumeric: "tabular-nums",
        minWidth: 38,
        textAlign: "right",
      }}>{(Number(pct) || 0).toFixed(1)}%</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 종류별 가로 바 — 아이콘 + 라벨 + 금액 + 건수 + 비중 바 (사장님 spec 2026-06-16).
//   바 width = (detail.total / total) × 100%. total=0 인 경우 0 폭.
//   세척/냉매/기타 동일 컴포넌트로 통일.
// ──────────────────────────────────────────────────────────────────
function ServiceBar({ icon, label, color, detail, total }) {
  const { total: amount = 0, count = 0 } = detail || {};
  const pct = total > 0 ? Math.min(100, (amount / total) * 100) : 0;
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 6,
      fontVariantNumeric: "tabular-nums",
    }}>
      {/* 헤더 줄 — 아이콘 + 라벨 + 금액(우) + 건수 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 6,
          background: `${color}22`,
          color, fontSize: 13, fontWeight: 800,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>{icon}</span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: "var(--text-primary)",
          whiteSpace: "nowrap",
        }}>{label}</span>
        <span className="mono" style={{
          marginLeft: "auto",
          fontSize: 13, fontWeight: 800, color: "var(--text-primary)",
          letterSpacing: "-0.3px",
          fontVariantNumeric: "tabular-nums",
        }}>{fmtKRW(amount)}</span>
        <span style={{
          fontSize: 11, color: "var(--text-secondary)", fontWeight: 700,
          minWidth: 36, textAlign: "right",
        }}>{count}건</span>
      </div>
      {/* 비중 바 — 회색 트랙 위 색 fill. */}
      <div style={{
        height: 6, borderRadius: 3,
        background: "var(--bg-inset, rgba(255,255,255,0.06))",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: color,
          transition: "width 0.2s ease",
        }}/>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 2026-06-19 — 오늘/이번달 기사별 회사 마진 섹션.
//   · period 토글(today/month) 연동 — 매출 현황 카드와 같은 기간.
//   · 데이터: isTrackARemittance + 완료 + KST(toKstYmd) 필터 → assignedEngineer
//     이름 groupBy → owner_amount(회사 마진) 합산 → 금액 내림차순.
//   · 표시: 상위 5명 + 가로 막대(top 1 owner 기준 비율) + 금액. 5명 초과 시
//     "전체 N명 →" 링크 (onClickEngineerList 전달 시).
//   · 2026-06-19 (사장님 spec): 집계값을 engineer_amount → owner_amount 로
//     전환. 회사 입장에서 본 작업당 마진 = 회사가 가진 몫.
// ──────────────────────────────────────────────────────────────────
function EngineerSettlementSection({ apiTasks = [], period, periodLabel, onClickAll }) {
  const list = useMemo(() => {
    const today = todayYmd();
    let curStart, curEnd;
    if (period === "today") {
      curStart = today;
      curEnd   = today;
    } else {
      curStart = getMonthStart(today);
      curEnd   = today;
    }
    const groups = new Map();
    for (const task of apiTasks || []) {
      if (!isTrackARemittance(task)) continue;
      if (task.status === "취소") continue;          // 취소건 제외 (사장님 spec)
      const completed = task.completedAt || task.completed_at;
      if (!completed) continue;
      const ymd = toKstYmd(completed);                // UTC slice 금지 — KST 자정 경계 정확
      if (!ymd || ymd < curStart || ymd > curEnd) continue;
      const name = task.assignedEngineer || task.engineer || "(미배정)";
      // 2026-06-19 — owner_amount(회사 마진) 합산 (이전 engineer_amount 폐기)
      const amt  = Number(task.owner_amount || task.ownerAmount || 0);
      if (amt <= 0) continue;
      if (!groups.has(name)) groups.set(name, { name, amount: 0, count: 0 });
      const g = groups.get(name);
      g.amount += amt;
      g.count  += 1;
    }
    return [...groups.values()].sort((a, b) => b.amount - a.amount);
  }, [apiTasks, period]);

  if (list.length === 0) return null;

  const top5     = list.slice(0, 5);
  const maxAmt   = top5[0]?.amount || 1;
  const moreCount = Math.max(0, list.length - 5);

  return (
    <div style={{
      borderTop: "1px solid var(--border)",
      paddingTop: 16,
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 4,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 800,
          color: "var(--text-primary)",
        }}>
          👷 {periodLabel} 기사별 회사 마진
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: "var(--text-secondary)",
        }}>
          {list.length}명 · 총 {fmtKRW(list.reduce((s, g) => s + g.amount, 0))}
        </div>
      </div>

      {top5.map(({ name, amount, count }) => {
        const pct = (amount / maxAmt) * 100;
        return (
          <div key={name} style={{ marginBottom: 2 }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              marginBottom: 4, fontSize: 11,
              fontVariantNumeric: "tabular-nums",
            }}>
              <span style={{
                color: "var(--text-primary)", fontWeight: 700,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                maxWidth: "60%",
              }}>{name}</span>
              <span className="mono" style={{
                color: "var(--text-primary)", fontWeight: 700,
                letterSpacing: "-0.2px",
              }}>
                {fmtKRW(amount)}
                <span style={{
                  marginLeft: 6, color: "var(--text-secondary)",
                  fontWeight: 600, fontSize: 10,
                }}>· {count}건</span>
              </span>
            </div>
            <div style={{
              height: 5, background: "var(--bg-inset, rgba(255,255,255,0.06))",
              borderRadius: 3, overflow: "hidden",
            }}>
              <div style={{
                width: `${Math.max(0, Math.min(100, pct))}%`,
                height: "100%",
                background: COLOR_OWNER, // 회사 마진 색 — 매출 패널 도넛/RevItem 과 일관
                transition: "width 0.2s ease",
              }}/>
            </div>
          </div>
        );
      })}

      {moreCount > 0 && typeof onClickAll === "function" && (
        <button
          type="button"
          onClick={onClickAll}
          style={{
            marginTop: 4,
            padding: "7px 10px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 7,
            color: "var(--text-secondary)",
            fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          전체 {list.length}명 →
        </button>
      )}
    </div>
  );
}

export default AdminPcRevenuePanel;
