// V14 — 회사 송금 내역 (사장님 spec)
// 월별 필터 + 합계 + 일별 그룹 카드 (접기/펼치기)
// 미입금 = 핫핑크 / 입금 완료 = 그린

import { useMemo, useState } from "react";
import { ArrowLeft, Clock, Check, AlertCircle } from "lucide-react";
import { useIsDark } from "../hooks/useIsDark.js";
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { getServiceKindMeta } from "../utils/workTypeKind.js";
import { reportEngineerRemit } from "../lib/paymentsDb.js";

async function handleReport(taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) return;
  if (!confirm("이 날짜의 입금을 완료 보고할까요?")) return;
  const res = await reportEngineerRemit(taskIds);
  if (res.ok) {
    alert("입금 완료 보고가 등록됐어요. 운영자 확인 대기 중입니다.");
    window.location.reload();
  } else {
    alert("등록 실패: " + res.error);
  }
}

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
  const isPending   = data.status === "pending";
  const isOverdue   = data.status === "overdue";
  const isReported  = data.status === "reported";
  const isConfirmed = data.status === "confirmed";
  const isUnpaid    = isPending || isOverdue;  // 보고 박을 spec 측

  const barColor =
    isConfirmed ? "#04342C" :
    isReported  ? "#0C447C" :
    isOverdue   ? "#501313" :
                  "#FF1B8D";
  const amountColor = isUnpaid ? "#FF1B8D" : "var(--text-primary)";
  const expandedBg =
    isOverdue   ? (isDark ? "rgba(252,235,235,0.06)" : "#FCEBEB") :
    isReported  ? (isDark ? "rgba(230,241,251,0.06)" : "#E6F1FB") :
    isConfirmed ? (isDark ? "rgba(225,245,238,0.06)" : "#E1F5EE") :
                  (isDark ? "rgba(255,27,141,0.06)"  : "#FFF5FA");
  const cardBorder = isOverdue
    ? "0.5px solid #F09595"
    : `1px solid ${isUnpaid ? "rgba(255,27,141,0.25)" : "var(--border)"}`;

  return (
    <div style={{
      background: "var(--card-bg)",
      border: cardBorder,
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
        padding: "10px 12px",
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
          padding: "4px 8px 8px 8px",
          background: expandedBg,
        }}>
          {(data.works || []).map((w, idx, arr) => (
            <div key={w.id || idx}
              onClick={() => onTaskClick && w.id && onTaskClick(w.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 8px",
                borderBottom: idx < arr.length - 1 ? "0.5px solid var(--border)" : "none",
                cursor: w.id ? "pointer" : "default",
                gap: 6,
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
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
          {/* 입금 완료 보고 버튼 — 미입금/연체만 박힘 */}
          {isUnpaid && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "0.5px solid var(--border)" }}>
              <button
                onClick={() => handleReport((data.works || []).map(w => w.id).filter(Boolean))}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#FF1B8D",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}>
                💸 입금 완료 보고
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 2026-07-20 — 5종 통일. 옛 이분법 (세척 vs 냉매) → getServiceKindMeta 5종.
//   type 은 workType 문자열 (예: "세척_벽걸이" / "냉매점검(...)" / "누설_벽걸이" / "신규설치").
//   ServiceKindMeta 가 5종 (cleaning/refrigerant/install/leak/other) 색·라벨 통일 반환.
function WorkTypeBadge({ type }) {
  const meta = getServiceKindMeta(type);
  return (
    <div style={{
      background: `${meta.color}22`,
      color: meta.color,
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
      <span style={{ fontSize: 10 }}>{meta.icon}</span>
      <span>{meta.label}</span>
    </div>
  );
}

function StatusPill({ status }) {
  // 사장님 spec: 4상태 (pending / reported / confirmed / overdue)
  const config = {
    pending:   { bg: "#F1EFE8", color: "#444441", Icon: null,        text: "미입금" },
    reported:  { bg: "#E6F1FB", color: "#0C447C", Icon: Clock,       text: "확인대기" },
    confirmed: { bg: "#E1F5EE", color: "#04342C", Icon: Check,       text: "입금완료" },
    overdue:   { bg: "#FCEBEB", color: "#501313", Icon: AlertCircle, text: "연체" },
  };
  const c = config[status] || config.pending;
  const Icon = c.Icon;
  return (
    <span style={{
      background: c.bg,
      color: c.color,
      fontSize: 11,
      padding: "3px 8px",
      borderRadius: 6,
      fontWeight: 500,
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      whiteSpace: "nowrap",
    }}>
      {Icon && <Icon size={11} aria-hidden="true"/>}
      {c.text}
    </span>
  );
}

export default PaymentHistoryScreen;
