// V14 — 유솔N 정산 (사장님 spec)
// Hero 그린 카드 + 월별 필터 + 일별 그룹 (받을 돈 / 입금 완료)

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useIsDark } from "../hooks/useIsDark.js";
import { getWorkTypeColors } from "../utils/workTypeColors.js";

function ymdMonth(ymd) { return ymd ? ymd.slice(0, 7) : ""; }
function ymdMonthLabel(m) {
  if (!m) return "";
  const [y, mo] = m.split("-");
  return `${Number(y)}년 ${Number(mo)}월`;
}
function dayLabel(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${m}월 ${d}일 (${days[date.getDay()]})`;
}

export function UsolNSettlementScreen({
  pendingAmount = 0,
  pendingCount = 0,
  payDate,
  thisYearTotal = 0,
  groups = [],
  onBack,
  onTaskClick,
}) {
  const isDark = useIsDark();

  const monthOptions = useMemo(() => {
    const set = new Set();
    groups.forEach(g => g.date && set.add(ymdMonth(g.date)));
    return Array.from(set).sort().reverse();
  }, [groups]);

  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0] || "");
  const [expanded, setExpanded] = useState(new Set());

  function toggleExpand(date) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }

  const monthGroups = useMemo(() => {
    return groups
      .filter(g => ymdMonth(g.date) === selectedMonth)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [groups, selectedMonth]);

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

      {/* Hero 그린 카드 */}
      <div style={{ padding: 16 }}>
        <div style={{
          background: "#03C75A",
          borderRadius: 22,
          padding: "22px 22px 18px",
          color: "#fff",
        }}>
          <div style={{
            fontSize: 13, color: "#D5F5E3", fontWeight: 700,
            marginBottom: 8,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 19, height: 19, borderRadius: 5,
              background: "#fff", color: "#03C75A",
              fontSize: 11, fontWeight: 700,
            }}>N</span>
            <span>받을 돈</span>
          </div>
          <div style={{
            fontSize: 56, fontWeight: 700, color: "#fff",
            letterSpacing: "-2px", lineHeight: 1,
            marginBottom: 8,
          }}>
            ₩{pendingAmount.toLocaleString("ko-KR")}
          </div>
          <div style={{
            fontSize: 13, color: "#D5F5E3", fontWeight: 600,
            marginBottom: 14,
          }}>
            {pendingCount}건 · {payDate || "—"} 입금 예정
          </div>
          <div style={{
            background: "rgba(255,255,255,0.16)",
            borderRadius: 12,
            padding: "11px 14px",
          }}>
            <div style={{ fontSize: 11, color: "#D5F5E3", fontWeight: 700, marginBottom: 4 }}>
              올해 누적
            </div>
            <div style={{
              fontSize: 19, fontWeight: 700, color: "#fff",
              letterSpacing: "-0.4px", lineHeight: 1.1,
            }}>
              ₩{thisYearTotal.toLocaleString("ko-KR")}
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
              {ymdMonthLabel(m)}
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
