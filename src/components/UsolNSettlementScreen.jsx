// V14 — 유솔N 정산 (사장님 spec v2)
// Hero 카드 = 이번 달 누적 + 전달 받을 돈 (구분선) / 월별 필터 / 일별 그룹

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useIsDark } from "../hooks/useIsDark.js";
import { getWorkTypeColors } from "../utils/workTypeColors.js";

function ymdMonth(ymd) { return ymd ? ymd.slice(0, 7) : ""; }
function monthFromYmd(ymd) { return ymd ? Number(ymd.slice(5, 7)) : 0; }
function ymdMonthLabel(m) {
  if (!m) return "";
  const [y, mo] = m.split("-");
  return `${Number(y)}년 ${Number(mo)}월`;
}
function ymdMonthShort(m) {
  if (!m) return "";
  return `${Number(m.split("-")[1])}월`;
}
function dayLabel(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${m}월 ${d}일 (${days[date.getDay()]})`;
}
function nextMonthLabel(m) {
  if (!m) return "";
  const [y, mo] = m.split("-").map(Number);
  const next = new Date(y, mo, 1); // mo (1-based) → mo+1 means next month start
  return `${next.getFullYear()}년 ${next.getMonth() + 1}월`;
}
function monthFilterLabel(m, currentYm, prevYm) {
  if (m === currentYm) return `${ymdMonthShort(m)} (누적)`;
  if (m === prevYm)    return `${ymdMonthShort(m)} (받을 돈)`;
  return `${ymdMonthShort(m)} (입금 완료)`;
}

export function UsolNSettlementScreen({
  groups = [],
  currentYm,                 // "2026-05" — 사용자가 일하고 있는 달
  prevYm,                    // "2026-04" — 받을 돈 (다음 달 입금 예정)
  thisMonthDepositDate,      // "6월 15일" — currentYm 입금 예정일 라벨
  prevMonthDepositDate,      // "5월 15일" — prevYm 입금 예정일 라벨
  onBack,
  onTaskClick,
}) {
  const isDark = useIsDark();

  // 월별 그룹화
  const groupsByMonth = useMemo(() => {
    const m = {};
    groups.forEach(g => {
      const ym = ymdMonth(g.date);
      if (!m[ym]) m[ym] = [];
      m[ym].push(g);
    });
    return m;
  }, [groups]);

  const thisMonthGroups = groupsByMonth[currentYm] || [];
  const prevMonthGroups = groupsByMonth[prevYm] || [];

  const thisMonthEarning = thisMonthGroups.reduce((s, g) => s + (g.totalAmount || 0), 0);
  const thisMonthCount   = thisMonthGroups.reduce((s, g) => s + (g.works || []).length, 0);
  const prevMonthEarning = prevMonthGroups.reduce((s, g) => s + (g.totalAmount || 0), 0);
  const prevMonthCount   = prevMonthGroups.reduce((s, g) => s + (g.works || []).length, 0);

  // 월별 옵션 (최신순) — 데이터에 있는 모든 월
  const monthOptions = useMemo(() => {
    const set = new Set(Object.keys(groupsByMonth));
    if (currentYm) set.add(currentYm);
    if (prevYm)    set.add(prevYm);
    return Array.from(set).sort().reverse();
  }, [groupsByMonth, currentYm, prevYm]);

  const [selectedMonth, setSelectedMonth] = useState(currentYm || monthOptions[0] || "");
  const [expanded, setExpanded] = useState(new Set());

  function toggleExpand(date) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }

  const monthGroups = useMemo(() => {
    return (groupsByMonth[selectedMonth] || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  }, [groupsByMonth, selectedMonth]);

  // Hero 색 토큰 (라이트/다크)
  const heroBg     = isDark ? "rgba(3,199,90,0.10)" : "#F0FDF4";
  const heroBorder = "#03C75A";
  const heroAmount = isDark ? "#FAF8F5" : "#1A1A1A";
  const subAmount  = isDark ? "#FAF8F5" : "#1A1A1A";
  const labelColor = isDark ? "#5DE099" : "#03C75A";
  const subLabelColor = isDark ? "#5DE099" : "#038147";
  const fineColor  = isDark ? "#9AA3AB" : "#555";

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      paddingBottom: 24,
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: "var(--text-primary)",
          display: "flex", alignItems: "center",
        }}>
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: 6,
            background: "#03C75A", color: "#fff",
            fontSize: 12, fontWeight: 700,
          }}>N</span>
          <span>유솔N 정산</span>
        </div>
        <div style={{ width: 28 }}/>
      </div>

      {/* Hero — 이번 달 누적 + 전달 받을 돈 */}
      <div style={{ padding: 16 }}>
        <div style={{
          background: heroBg,
          border: `1.5px solid ${heroBorder}`,
          borderRadius: 20,
          padding: "22px 22px 18px",
          marginBottom: 14,
        }}>
          {/* 라벨 */}
          <div style={{
            fontSize: 13, color: labelColor, fontWeight: 700,
            marginBottom: 8,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 19, height: 19, borderRadius: 5,
              background: "#03C75A", color: "#fff",
              fontSize: 11, fontWeight: 700,
            }}>N</span>
            <span>이번 달 ({ymdMonthShort(currentYm)}) 누적</span>
          </div>

          {/* Hero 금액 — 이번 달 누적 */}
          <div style={{
            fontSize: 56, fontWeight: 700,
            color: heroAmount,
            letterSpacing: "-2px",
            lineHeight: 1,
            marginBottom: 8,
          }}>
            {thisMonthEarning.toLocaleString("ko-KR")}원
          </div>

          {/* 부속 설명 */}
          <div style={{
            fontSize: 13, color: fineColor,
            marginBottom: 18, fontWeight: 600,
          }}>
            {thisMonthDepositDate || "다음 달 15일"} 입금 예정 · {ymdMonthShort(currentYm)} 작업 {thisMonthCount}건 (계속 누적)
          </div>

          {/* 구분선 */}
          <div style={{
            height: 0.5,
            background: "rgba(3,199,90,0.25)",
            marginBottom: 14,
          }}/>

          {/* 전달 받을 돈 (곧 들어올 돈) */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 0",
            gap: 12,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 12, color: subLabelColor, fontWeight: 700,
                marginBottom: 4,
              }}>
                {ymdMonthShort(prevYm)} 받을 돈
              </div>
              <div style={{
                fontSize: 11, color: fineColor, fontWeight: 600,
              }}>
                {prevMonthDepositDate || "이번 달 15일"} 입금 예정 · {prevMonthCount}건
              </div>
            </div>
            <div style={{
              fontSize: 22, color: subAmount, fontWeight: 700,
              letterSpacing: "-0.4px",
              flexShrink: 0,
            }}>
              {prevMonthEarning.toLocaleString("ko-KR")}원
            </div>
          </div>
        </div>
      </div>

      {/* 월별 필터 */}
      <div style={{ padding: "0 16px 14px" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {monthOptions.map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)} style={{
              padding: "8px 14px",
              background: m === selectedMonth ? "#03C75A" : "transparent",
              border: m === selectedMonth ? "1px solid #03C75A" : "1px solid var(--border)",
              borderRadius: 18,
              color: m === selectedMonth ? "#fff" : "var(--text-secondary)",
              fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {monthFilterLabel(m, currentYm, prevYm)}
            </button>
          ))}
        </div>
      </div>

      {/* 일별 그룹 */}
      <div style={{ padding: "0 16px" }}>
        {monthGroups.length === 0 ? (
          <div style={{
            padding: 28, textAlign: "center",
            color: "var(--text-tertiary)", fontSize: 14,
            background: "var(--bg-secondary)", borderRadius: 14,
          }}>
            이 달은 유솔N 작업이 없습니다.
          </div>
        ) : monthGroups.map(g => (
          <UsolNDailyGroupCard
            key={g.date}
            data={g}
            isExpanded={expanded.has(g.date)}
            onToggle={() => toggleExpand(g.date)}
            onTaskClick={onTaskClick}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  );
}

function UsolNDailyGroupCard({ data, isExpanded, onToggle, onTaskClick, isDark }) {
  const isPending = data.status === "pending";
  const expandedBg = isDark ? "rgba(3,199,90,0.06)" : "#F0FDF4";

  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1.5px solid #03C75A",
      borderRadius: 14,
      overflow: "hidden",
      position: "relative",
      marginBottom: 8,
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4, background: "#03C75A",
      }}/>

      <div onClick={onToggle} style={{
        padding: "14px 14px 14px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        cursor: "pointer",
        gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
              {dayLabel(data.date)}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700,
              padding: "2px 9px",
              borderRadius: 999,
              background: "rgba(3,199,90,0.10)",
              color: "#03C75A",
              whiteSpace: "nowrap",
            }}>
              {isPending ? "받을 돈" : "✓ 입금"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 17, fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.3px",
            }}>
              ₩{(data.totalAmount || 0).toLocaleString("ko-KR")}
            </span>
            <span style={{ fontSize: 12, color: "var(--label-main)", fontWeight: 600 }}>
              · {(data.works || []).length}건
              {data.payDate ? ` · ${data.payDate} 입금 예정` : ""}
            </span>
          </div>
        </div>
        <span style={{
          color: isExpanded ? "var(--text-secondary)" : "var(--text-tertiary)",
          fontSize: 18, fontWeight: 700, flexShrink: 0,
        }}>
          {isExpanded ? "▾" : "▸"}
        </span>
      </div>

      {isExpanded && (
        <div style={{
          borderTop: "0.5px solid var(--border)",
          padding: "8px 14px 14px 22px",
          background: expandedBg,
        }}>
          {(data.works || []).map((w, idx, arr) => {
            const colors = getWorkTypeColors(w.workType);
            return (
              <div key={w.id || idx}
                onClick={() => onTaskClick && w.id && onTaskClick(w.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: idx < arr.length - 1 ? "0.5px solid var(--border)" : "none",
                  cursor: w.id ? "pointer" : "default",
                  gap: 8,
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                  <span style={{
                    fontSize: 12, color: colors.main, fontWeight: 700,
                    flexShrink: 0, whiteSpace: "nowrap",
                  }}>
                    {colors.icon} {colors.name}
                  </span>
                  <span style={{
                    fontSize: 13, color: "var(--text-primary)", fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {w.customerName || w.customer || "—"}
                    {w.workItem ? ` · ${w.workItem}` : ""}
                    {w.quantity ? ` ×${w.quantity}` : ""}
                  </span>
                </div>
                <span style={{
                  fontSize: 13, color: "#03C75A", fontWeight: 700,
                  flexShrink: 0,
                }}>
                  +{(w.feeAmount || 0).toLocaleString("ko-KR")}원
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default UsolNSettlementScreen;
