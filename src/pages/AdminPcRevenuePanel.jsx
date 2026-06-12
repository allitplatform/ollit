// 2026-06-12 — AdminApp PC 매출 패널 (1024px+).
//   사장님 spec — 도넛(컬러) + 우측 3 항목(회사 마진 ★강조) + 하단 세척/냉매 2단(건수+매출+마진).
//   ⚠️ 전체 금액 표시 (M·K 줄임 금지), 숫자 우측정렬 tabular-nums.
//   ⚠️ 데이터: computeRevenueByYmRange 재사용 (byService + byServiceDetail).
//   ⚠️ 도넛 — conic-gradient. 기사정산 #3B82F6 / 원청수수료 #F59E0B / 회사마진 var(--accent).
//   ⚠️ 모바일(<1024)은 옛 RevenueOverviewBlock 그대로 (변경 없음).

import { useState, useMemo } from "react";
import { todayYmd } from "../utils/dateLabel.js";
import {
  computeRevenueByYmRange,
  getPrevMonthSameDay,
  getMonthStart,
  getPrevMonthStart,
} from "../utils/revenueStats.js";

// 도넛/항목 색 — 기사·원청은 도메인색(파랑·주황) 그대로, 회사 마진만 토큰.
const COLOR_ENGINEER  = "#3B82F6";  // 파랑 — 기사 정산
const COLOR_PRINCIPAL = "#F59E0B";  // 주황 — 원청 수수료
// 회사 마진 = var(--accent) — 다크 #FF1B8D / 라이트 #E91860

function fmtKRW(n) {
  return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
}

export function AdminPcRevenuePanel({ t, apiTasks = [], user, onDetailClick }) {
  const [period, setPeriod] = useState("today"); // 'today' | 'month'

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
    return {
      current:  computeRevenueByYmRange(apiTasks, curStart, curEnd, user),
      previous: computeRevenueByYmRange(apiTasks, prevStart, prevEnd, user),
      periodLabel: label,
    };
  }, [apiTasks, user, period]);

  const total = current.total || 0;
  const denom = total > 0 ? total : 1;
  const engineerPct  = (current.engineer  / denom) * 100;
  const principalPct = (current.principal / denom) * 100;
  // ownerPct는 conic 마지막 stop (100%)이라 별도 변수 불필요.

  const diffPct = previous.total > 0
    ? ((current.total - previous.total) / previous.total) * 100
    : null;

  const sd = current.byServiceDetail || {
    cleaning:    { total: 0, count: 0, owner: 0 },
    refrigerant: { total: 0, count: 0, owner: 0 },
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

      {/* 상단 — 도넛(170 고정) + 항목 블록(1fr 도넛 옆 남은 폭 전체). 라벨 좌 / 금액 우 양쪽 벌림. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 24,
        alignItems: "center",
      }}>
        <Donut
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
          <RevItem
            color={COLOR_ENGINEER}
            label="기사 정산"
            amount={current.engineer}
            muted
          />
          <RevItem
            color={COLOR_PRINCIPAL}
            label="원청 수수료"
            amount={current.principal}
            muted
          />
          <div style={{
            borderTop: "1px solid var(--border)",
            marginTop: 2,
            paddingTop: 12,
          }}>
            <RevItem
              color="var(--accent)"
              label="회사 마진"
              amount={current.owner}
              big
            />
          </div>
        </div>
      </div>

      {/* 하단 — 세척 / 냉매 2단 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        borderTop: "1px solid var(--border)",
        paddingTop: 16,
      }}>
        <ServiceBox icon="❄" label="세척" color="#0EA5E9" detail={sd.cleaning}/>
        <ServiceBox icon="⚡" label="냉매" color="#FFB800" detail={sd.refrigerant}/>
      </div>

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
function Donut({ total, engineerPct, principalPct, diffPct, periodLabel, count }) {
  const s1 = engineerPct;
  const s2 = engineerPct + principalPct;
  const hasData = total > 0;

  return (
    <div style={{
      position: "relative",
      width: 170, height: 170,
      borderRadius: "50%",
      background: hasData
        ? `conic-gradient(
            ${COLOR_ENGINEER}  0% ${s1}%,
            ${COLOR_PRINCIPAL} ${s1}% ${s2}%,
            var(--accent)      ${s2}% 100%
          )`
        : "var(--bg-inset, #f0f0f0)",
      flexShrink: 0,
    }}>
      {/* 가운데 hole — 총 매출 표시 */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 112, height: 112,
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
// 우측 항목 — 회사 마진은 big=true 로 강조 (핑크/굵게/크게).
// ──────────────────────────────────────────────────────────────────
function RevItem({ color, label, amount, muted, big }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto auto minmax(0, 1fr)",
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
        color: big ? "var(--accent)" : "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.3px",
        textAlign: "right",
      }}>{fmtKRW(amount)}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 세척 / 냉매 박스 — 건수 + 매출 + 마진(핑크 강조).
// ──────────────────────────────────────────────────────────────────
function ServiceBox({ icon, label, color, detail }) {
  const { total = 0, count = 0, owner = 0 } = detail || {};
  return (
    <div style={{
      padding: "12px 14px",
      background: "var(--bg-primary)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      fontVariantNumeric: "tabular-nums",
    }}>
      {/* 헤더 — 아이콘 + 라벨 + 건수 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: 7,
          background: `${color}22`,
          color, fontSize: 14, fontWeight: 800,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{label}</span>
        <span style={{
          marginLeft: "auto",
          fontSize: 11, color: "var(--text-secondary)", fontWeight: 700,
        }}>{count}건</span>
      </div>
      {/* 매출 */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6,
      }}>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>매출</span>
        <span className="mono" style={{
          fontSize: 13, fontWeight: 700, color: "var(--text-primary)",
          letterSpacing: "-0.3px", textAlign: "right",
        }}>{fmtKRW(total)}</span>
      </div>
      {/* 마진 — ★ 강조 */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
      }}>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>마진</span>
        <span className="mono" style={{
          fontSize: 15, fontWeight: 800, color: "var(--accent)",
          letterSpacing: "-0.3px", textAlign: "right",
        }}>{fmtKRW(owner)}</span>
      </div>
    </div>
  );
}

export default AdminPcRevenuePanel;
