// V14 — 회사 송금 내역 (사장님 spec)
// 월별 필터 + 합계 + 일별 그룹 카드 (접기/펼치기)
// 미입금 = 핫핑크 / 입금 완료 = 그린

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

export function PaymentHistoryScreen({ payments = [], onBack, onTaskClick }) {
  const isDark = useIsDark();

  // 월별 옵션 (데이터에서 추출, 최신순)
  const monthOptions = useMemo(() => {
    const set = new Set();
    payments.forEach(p => p.date && set.add(ymdMonth(p.date)));
    return Array.from(set).sort().reverse();
  }, [payments]);

  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0] || "");
  const [expanded, setExpanded] = useState(() => {
    const today = new Date();
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return new Set([ymd]);
  });

  function toggleExpand(date) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }

  // 선택 월의 payments (날짜 내림차순)
  const monthPayments = useMemo(() => {
    return payments
      .filter(p => ymdMonth(p.date) === selectedMonth)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [payments, selectedMonth]);

  const completedTotal = monthPayments.filter(p => p.status === "completed").reduce((s, p) => s + (p.totalAmount || 0), 0);
  const pendingTotal   = monthPayments.filter(p => p.status === "pending").reduce((s, p) => s + (p.totalAmount || 0), 0);

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
        <div style={{ flex: 1, fontSize: 17, fontWeight: 700 }}>
          📥 회사 송금 내역
        </div>
        <div style={{ width: 28 }}/>
      </div>

      {/* 월별 필터 + 합계 */}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }}>
          {monthOptions.map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)} style={{
              padding: "8px 14px",
              background: m === selectedMonth ? "#FF1B8D" : "transparent",
              border: m === selectedMonth ? "1px solid #FF1B8D" : "1px solid var(--border)",
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

        <div style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 14,
          display: "flex", justifyContent: "space-between", gap: 10,
        }}>
          <SummaryStat label="입금 완료" amount={completedTotal} color="#03C75A"/>
          <SummaryStat label="미입금"    amount={pendingTotal}   color="#FF1B8D"/>
        </div>
      </div>

      {/* 일별 그룹 리스트 */}
      <div style={{ padding: "0 16px" }}>
        {monthPayments.length === 0 ? (
          <div style={{
            padding: 28, textAlign: "center",
            color: "var(--text-tertiary)", fontSize: 14,
            background: "var(--bg-secondary)", borderRadius: 14,
          }}>
            이 달은 송금 내역이 없습니다.
          </div>
        ) : monthPayments.map(p => (
          <DailyGroupCard
            key={p.date}
            data={p}
            isExpanded={expanded.has(p.date)}
            onToggle={() => toggleExpand(p.date)}
            onTaskClick={onTaskClick}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryStat({ label, amount, color }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: "var(--label-main)", marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700,
        color: color, letterSpacing: "-0.5px",
        lineHeight: 1.1,
      }}>
        ₩{amount.toLocaleString("ko-KR")}
      </div>
    </div>
  );
}

function DailyGroupCard({ data, isExpanded, onToggle, onTaskClick, isDark }) {
  const isPending = data.status === "pending";
  const barColor = isPending ? "#FF1B8D" : "#03C75A";
  const amountColor = isPending ? "#FF1B8D" : "var(--text-primary)";
  const expandedBg = isPending
    ? (isDark ? "rgba(255,27,141,0.06)" : "#FFF5FA")
    : (isDark ? "rgba(3,199,90,0.06)"  : "#F0FDF4");

  return (
    <div style={{
      background: "var(--card-bg)",
      border: `1px solid ${isPending ? "rgba(255,27,141,0.25)" : "var(--border)"}`,
      borderRadius: 14,
      overflow: "hidden",
      position: "relative",
      marginBottom: 8,
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4, background: barColor,
      }}/>

      {/* 헤더 (클릭 토글) */}
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
            <StatusPill status={data.status}/>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 17, fontWeight: 700,
              color: amountColor,
              letterSpacing: "-0.3px",
            }}>
              ₩{(data.totalAmount || 0).toLocaleString("ko-KR")}
            </span>
            <span style={{ fontSize: 12, color: "var(--label-main)", fontWeight: 600 }}>
              · {(data.works || []).length}건
              {isPending
                ? ` · ${data.deadline || "22:00"} 마감`
                : data.depositTime
                  ? ` · ${data.depositTime} 입금`
                  : " · 입금"}
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

      {/* 펼침 — 작업 리스트 */}
      {isExpanded && (
        <div style={{
          borderTop: "0.5px solid var(--border)",
          padding: "8px 14px 14px 22px",
          background: expandedBg,
        }}>
          {(data.works || []).map((w, idx, arr) => (
            <div key={w.id || idx}
              onClick={() => onTaskClick && w.id && onTaskClick(w.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: idx < arr.length - 1 ? "0.5px solid var(--border)" : "none",
                cursor: w.id ? "pointer" : "default",
                gap: 10,
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <WorkTypeBadge type={w.workType || "세척"}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 500,
                    color: "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {w.customerName || w.customer || "—"}
                  </div>
                  <div style={{
                    fontSize: 12, color: "var(--text-secondary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {w.workItem || "—"}{w.quantity ? ` ×${w.quantity}` : ""}
                  </div>
                </div>
              </div>
              <div style={{
                fontSize: 14, fontWeight: 500,
                color: "var(--text-primary)",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
                +{(w.feeAmount || 0).toLocaleString("ko-KR")}원
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkTypeBadge({ type }) {
  const isCleaning = type === "세척";
  const bg    = isCleaning ? "#E6F1FB" : "#FAEEDA";
  const color = isCleaning ? "#0C447C" : "#854F0B";
  const icon  = isCleaning ? "❄" : "⚡";
  return (
    <div style={{
      background: bg,
      color: color,
      fontSize: 11,
      padding: "3px 8px",
      borderRadius: 8,
      fontWeight: 500,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: 4,
      whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 10 }}>{icon}</span>
      <span>{type}</span>
    </div>
  );
}

function StatusPill({ status }) {
  const isPending = status === "pending";
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      padding: "2px 9px",
      borderRadius: 999,
      background: isPending ? "rgba(255,27,141,0.10)" : "rgba(3,199,90,0.10)",
      color: isPending ? "#FF1B8D" : "#03C75A",
      whiteSpace: "nowrap",
    }}>
      {isPending ? "미입금" : "✓ 입금"}
    </span>
  );
}

export default PaymentHistoryScreen;
