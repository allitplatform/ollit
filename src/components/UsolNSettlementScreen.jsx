// V14 — 유솔N 정산 (사장님 spec v2)
// Hero 카드 = 이번 달 누적 + 전달 받을 돈 (구분선) / 월별 필터 / 일별 그룹

import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, Circle } from "lucide-react";
import { useIsDark } from "../hooks/useIsDark.js";
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { getSettleRound } from "../utils/usolNSettleRound.js";

// 2026-06-01 — bucket model 측 측측 측측 측측측측측.
//   받음   = engineer_settled_at 측측 (1차/2차 측 측측측 KST day 측측측측측)
//   예정   = naver_settled_at 측측 AND engineer_settled_at 측측
//   미확정 = naver_settled_at 측측
function getWorkStatus(w) {
  if (w && w.engineerSettledAt) {
    const round = getSettleRound(w.engineerSettledAt);
    return {
      kind:  "received",
      label: round ? `받음 ${round}` : "받음",
      color: "#03C75A",
      bg:    "rgba(3,199,90,0.12)",
    };
  }
  if (w && w.naverSettled) {
    return { kind: "pending", label: "예정", color: "#B45309", bg: "rgba(245,158,11,0.14)" };
  }
  return { kind: "unconfirmed", label: "미확정", color: "#6B7280", bg: "rgba(156,163,175,0.16)" };
}

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
  if (m === prevYm)    return `${ymdMonthShort(m)} (정산예정)`;
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
  // 2026-05-25 — 확정 (naver_settled_at != null) work의 feeAmount 합 + 비율
  const thisMonthConfirmed = thisMonthGroups
    .flatMap(g => g.works || [])
    .filter(w => w.naverSettled)
    .reduce((s, w) => s + (w.feeAmount || 0), 0);
  const confirmedPct = thisMonthEarning > 0
    ? Math.round(thisMonthConfirmed / thisMonthEarning * 100)
    : 0;
  const prevMonthEarning = prevMonthGroups.reduce((s, g) => s + (g.totalAmount || 0), 0);
  const prevMonthCount   = prevMonthGroups.reduce((s, g) => s + (g.works || []).length, 0);

  // 2026-06-01 — bucket model 측측 측측 측측 3구간 측측 (받음/예정/미확정).
  //   받음 측 1차/2차 측측측 (engineer_settled_at KST day 측측).
  const prevMonthBuckets = useMemo(() => {
    const works = prevMonthGroups.flatMap(g => g.works || []);
    let received = 0, received1 = 0, received2 = 0, pending = 0, unconfirmed = 0;
    let receivedCount = 0, received1Count = 0, received2Count = 0;
    let pendingCount = 0, unconfirmedCount = 0;
    for (const w of works) {
      const amt = Number(w.feeAmount) || 0;
      if (w.engineerSettledAt) {
        received += amt; receivedCount += 1;
        const r = getSettleRound(w.engineerSettledAt);
        if (r === "1차") { received1 += amt; received1Count += 1; }
        else             { received2 += amt; received2Count += 1; }
      } else if (w.naverSettled) {
        pending += amt; pendingCount += 1;
      } else {
        unconfirmed += amt; unconfirmedCount += 1;
      }
    }
    return {
      received, received1, received2,
      receivedCount, received1Count, received2Count,
      pending, pendingCount,
      unconfirmed, unconfirmedCount,
    };
  }, [prevMonthGroups]);

  // 월별 옵션 (최신순) — 데이터에 있는 모든 월
  const monthOptions = useMemo(() => {
    const set = new Set(Object.keys(groupsByMonth));
    if (currentYm) set.add(currentYm);
    // 2026-05-24 — prevYm 데이터가 측 catch 측 catch 측 catch (= 측 catch 측 catch 측 catch)
    if (prevYm && (groupsByMonth[prevYm] || []).length > 0) set.add(prevYm);
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
  // 2026-05-25 — day 카드와 동일 배경 (초록 반투명 제거, 측 catch 측 catch)
  const heroBg     = "var(--card-bg)";
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

      {/* Hero — 이번 달 누적 + 전달 받을 돈.
            2026-06-01 (Step 6-2): 좌우 여백 측측 (16 → 10) — 측 화면 측측 측측측 측측 wrapper 측측 X. */}
      <div style={{ padding: "16px 10px" }}>
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
            marginBottom: 10, fontWeight: 600,
          }}>
            {thisMonthDepositDate || "다음 달 15일"} 입금 예정 · {ymdMonthShort(currentYm)} 작업 {thisMonthCount}건 (계속 누적)
          </div>

          {/* 2026-05-25 — 확정 진행률 막대그래프 (= 확정/정산예정 비율) */}
          <div style={{
            width: "100%",
            height: 6,
            background: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
            borderRadius: 3,
            overflow: "hidden",
            marginBottom: 8,
          }}>
            <div style={{
              width: `${Math.min(100, Math.max(0, confirmedPct))}%`,
              height: "100%",
              background: "#03C75A",
              transition: "width 0.3s ease",
            }}/>
          </div>
          <div style={{
            fontSize: 12, color: fineColor,
            marginBottom: 18, fontWeight: 600,
          }}>
            <span style={{ color: "#03C75A", fontWeight: 700 }}>확정 ₩{thisMonthConfirmed.toLocaleString("ko-KR")}</span> ({confirmedPct}%) · 매월 15일 지급
          </div>

        </div>

        {/* 2026-06-01 (Step 5) — "N월 정산" 측측 카드 (Hero 측측 측측).
              border 측측 측측 (초록 X), Hero 측측 측측측.
              Step 6-2: padding 16→13, marginTop 14→10 (시안 측측 측측 측측). */}
        {prevMonthCount > 0 && (
          <div style={{
            background: heroBg,
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 13,
            marginTop: 10,
          }}>
            {/* 헤더 — "N월 정산" + 우측 측측·건수 (시안 측측) */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              marginBottom: 10, gap: 8,
            }}>
              <div style={{
                fontSize: 15, color: subLabelColor, fontWeight: 700,
                letterSpacing: 0.2,
              }}>
                {ymdMonthShort(prevYm)} 정산
              </div>
              <div style={{
                fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600,
                whiteSpace: "nowrap",
              }}>
                총 {(prevMonthBuckets.received + prevMonthBuckets.pending + prevMonthBuckets.unconfirmed).toLocaleString("ko-KR")}원 · {prevMonthCount}건
              </div>
            </div>

            {/* 3색 비율 막대 (받음/예정/미확정) — 시안 측측 측측 */}
            {(() => {
              const total = prevMonthBuckets.received + prevMonthBuckets.pending + prevMonthBuckets.unconfirmed;
              if (total <= 0) return null;
              const pctReceived    = (prevMonthBuckets.received    / total) * 100;
              const pctPending     = (prevMonthBuckets.pending     / total) * 100;
              const pctUnconfirmed = (prevMonthBuckets.unconfirmed / total) * 100;
              return (
                <div style={{
                  display: "flex",
                  width: "100%", height: 8,
                  borderRadius: 4,
                  overflow: "hidden",
                  marginBottom: 12,
                  background: "rgba(255,255,255,0.04)",
                }}>
                  {pctReceived    > 0 && <div style={{ width: `${pctReceived}%`,    background: "#03C75A" }}/>}
                  {pctPending     > 0 && <div style={{ width: `${pctPending}%`,     background: "#EF9F27" }}/>}
                  {pctUnconfirmed > 0 && <div style={{ width: `${pctUnconfirmed}%`, background: "#4a4a4a" }}/>}
                </div>
              );
            })()}

            {/* 3구간 (받음 / 예정 / 미확정) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* 받음 (1차 + 2차 합) */}
              <SettleBucketRow
                color="#03C75A"
                icon={CheckCircle2}
                label="받음"
                count={prevMonthBuckets.receivedCount}
                amount={prevMonthBuckets.received}
                sub={
                  (prevMonthBuckets.received1Count > 0 || prevMonthBuckets.received2Count > 0)
                    ? [
                        prevMonthBuckets.received1Count > 0
                          ? `1차 ${prevMonthBuckets.received1.toLocaleString("ko-KR")}원`
                          : null,
                        prevMonthBuckets.received2Count > 0
                          ? `2차 ${prevMonthBuckets.received2.toLocaleString("ko-KR")}원`
                          : null,
                      ].filter(Boolean).join(" · ")
                    : null
                }
              />
              {/* 예정 — 시안 측측 측측 #EF9F27 */}
              <SettleBucketRow
                color="#EF9F27"
                icon={Clock}
                label="예정"
                count={prevMonthBuckets.pendingCount}
                amount={prevMonthBuckets.pending}
                sub={`${prevMonthDepositDate || "이번 달 15일"} 입금 예정`}
              />
              {/* 미확정 */}
              <SettleBucketRow
                color="#6B7280"
                icon={Circle}
                label="미확정"
                count={prevMonthBuckets.unconfirmedCount}
                amount={prevMonthBuckets.unconfirmed}
                sub="네이버 정산 대기"
              />
            </div>
          </div>
        )}
      </div>

      {/* 월별 필터 */}
      <div style={{ padding: "0 10px 14px" }}>
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
      <div style={{ padding: "0 10px" }}>
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
  // 2026-05-25 — 카드 측 catch 측 catch 측 catch (옅은 초록 측 catch) — 측 catch borderTop만 측 catch 측 catch 측 catch
  const expandedBg = "var(--card-bg)";

  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      overflow: "hidden",
      position: "relative",
      marginBottom: 8,
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 3, background: "var(--text-tertiary)",
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
              background: isPending ? "var(--bg-secondary)" : "rgba(3,199,90,0.10)",
              color: isPending ? "var(--text-secondary)" : "#03C75A",
              whiteSpace: "nowrap",
            }}>
              {isPending ? "정산예정" : "✓ 입금"}
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
            // 2026-05-24 — work = task_item 단위 — key는 itemId(task_item_id)로
            //   (같은 task의 item 측 catch task_id가 동일 → key 측 catch 측 catch React 측 catch)
            return (
              <div key={w.itemId || w.id || idx}
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
                  {/* 2026-06-01 — bucket model 측측 측측 배지 (받음 1차/2차 / 예정 / 미확정) */}
                  {(() => {
                    const status = getWorkStatus(w);
                    return (
                      <span style={{
                        fontSize: 10, fontWeight: 800,
                        color: status.color,
                        background: status.bg,
                        padding: "2px 7px",
                        borderRadius: 999,
                        whiteSpace: "nowrap", flexShrink: 0,
                        letterSpacing: 0.2,
                      }}>{status.label}</span>
                    );
                  })()}
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

// 2026-06-01 — 이전달 정산 박스 측 3구간 측 (받음 / 예정 / 미확정).
//   color: 좌측 dot / label 색 / amount 색
//   label: "받음" / "예정" / "미확정"
//   count: N건 (옆 측측측)
//   amount: 금액
//   sub: 측측측 (예: "1차 X · 2차 Y" / "이번 달 15일 입금 예정")
function SettleBucketRow({ color = "#9CA3AF", icon: Icon = Circle, label, count = 0, amount = 0, sub = null }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 0",
      gap: 10,
      borderTop: "0.5px solid rgba(255,255,255,0.08)",  // 2026-06-01 (Step 7-2): 행 측측 측측 측측
    }}>
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={18} color={color} strokeWidth={2.2} style={{ flexShrink: 0 }}/>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 15, color: color, fontWeight: 700,
            letterSpacing: 0.2,
            display: "flex", alignItems: "baseline", gap: 6,
          }}>
            <span>{label}</span>
            {count > 0 && (
              <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600 }}>
                {count}건
              </span>
            )}
          </div>
          {sub && (
            <div style={{
              fontSize: 10, color: "var(--text-tertiary)",
              fontWeight: 600, marginTop: 2,
            }}>{sub}</div>
          )}
        </div>
      </div>
      <span className="mono" style={{
        fontSize: 19, fontWeight: 700,
        color: color,
        flexShrink: 0,
        letterSpacing: "-0.4px",
      }}>
        ₩{(Number(amount) || 0).toLocaleString("ko-KR")}
      </span>
    </div>
  );
}

export default UsolNSettlementScreen;
