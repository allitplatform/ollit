// 유솔앱 — 기사 입금 내역 화면 (보기 전용)
// 2026-05-26
//
// 진입: PrincipalSettleTab 측 진입 카드 클릭 → 본 화면.
// 흐름: fetchUsolRemitHistory(usol_n, 이번 달) → 상단 요약 + 기사별 그룹 카드.
// 상태 판정: 기사의 모든 작업이 usol_remitted_at 채워졌으면 '입금 완료', 아니면 '입금 대기'.
// 보기 전용 — 액션 X.

import { useEffect, useState, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import {
  fetchUsolRemitHistory,
  groupByDateThenEngineer,
  summarize,
  toKstYmd,
} from "../../lib/usolRemitHistoryDb.js";

const C_PENDING = "#FF3B5C";
const C_DONE    = "#1D9E75";
const C_GRAY    = "#9CA3AF";

function formatKrw(n) {
  return `₩${Number(n || 0).toLocaleString("ko-KR")}`;
}

function formatMd(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  // KST 변환
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()}`;
}

export function UsolRemitHistoryScreen({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems]     = useState([]);
  const [error, setError]     = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchUsolRemitHistory({ principalCode: "usol_n", monthOffset: 0 })
      .then(res => {
        if (!alive) return;
        if (!res.ok) setError(res.error || "조회 실패");
        setItems(res.items || []);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const summary = useMemo(() => summarize(items), [items]);
  // 2026-05-26 — 1차 그룹 = 작업 완료일 (KST), 2차 = 기사별.
  const dateGroups = useMemo(() => groupByDateThenEngineer(items), [items]);

  // 이번 달 라벨 (KST)
  const monthLabel = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  }, []);

  // KST 오늘 ymd
  const todayYmd = useMemo(() => {
    const k = new Date(Date.now() + 9 * 3600 * 1000);
    return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, "0")}-${String(k.getUTCDate()).padStart(2, "0")}`;
  }, []);

  // 펼침 상태 — 날짜 그룹별. 기본: 오늘 ymd 만 true.
  //   items fetch 완료 후 첫 렌더에서 오늘 그룹만 true 로 초기화.
  const [openDates, setOpenDates] = useState({});
  useEffect(() => {
    if (dateGroups.length === 0) return;
    setOpenDates(prev => {
      // 이미 사용자가 토글한 게 있으면 보존, 없으면 오늘만 펼침.
      if (Object.keys(prev).length > 0) return prev;
      const next = {};
      for (const g of dateGroups) {
        next[g.ymd] = (g.ymd === todayYmd);
      }
      return next;
    });
  }, [dateGroups, todayYmd]);

  function toggleDate(ymd) {
    setOpenDates(prev => ({ ...prev, [ymd]: !prev[ymd] }));
  }

  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button onClick={onBack} style={{
          background: "var(--bg-secondary, #1A1A1A)",
          border: "1px solid var(--border, #2A2A2A)",
          borderRadius: 8, padding: "6px 8px",
          color: "var(--text-primary, #FAF8F5)",
          cursor: "pointer", display: "flex", alignItems: "center",
          fontFamily: "inherit",
        }}><ArrowLeft size={14}/></button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary, #FAF8F5)" }}>
            기사 입금 내역
          </div>
          <div style={{ fontSize: 11, color: C_GRAY, marginTop: 2 }}>
            {monthLabel} · 세척 현장추가금 15%
          </div>
        </div>
      </div>

      {/* 상단 요약 2칸 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <SummaryCard label="입금 대기" amount={summary.pending} color={C_PENDING}/>
        <SummaryCard label="입금 완료" amount={summary.done}    color={C_DONE}/>
      </div>

      {/* 로딩 / 에러 / 빈 상태 */}
      {loading && <EmptyBox>불러오는 중...</EmptyBox>}
      {!loading && error && <EmptyBox color="#FF3B5C">⚠️ {error}</EmptyBox>}
      {!loading && !error && dateGroups.length === 0 && (
        <EmptyBox>이번 달 기사 입금 내역이 없습니다</EmptyBox>
      )}

      {/* 날짜별 그룹 (1차) → 기사별 카드 (2차, 펼침 시) */}
      {!loading && dateGroups.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {dateGroups.map(dg => (
            <DateGroup
              key={dg.ymd}
              dateGroup={dg}
              isToday={dg.ymd === todayYmd}
              isOpen={!!openDates[dg.ymd]}
              onToggle={() => toggleDate(dg.ymd)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 날짜 라벨 — "5/26 (수)" 또는 "오늘" 측 자연 표시
function formatDateHeader(ymd, isToday) {
  const [y, m, d] = ymd.split("-").map(n => parseInt(n, 10));
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const label = `${m}/${d} (${weekdays[date.getDay()]})`;
  return isToday ? `오늘 · ${label}` : label;
}

function DateGroup({ dateGroup, isToday, isOpen, onToggle }) {
  const { ymd, count, total15Pct, engineerGroups } = dateGroup;
  return (
    <div style={{
      background: "var(--bg-elevated, #1F1F1F)",
      border: `1px solid ${isToday ? "rgba(255, 27, 141, 0.35)" : "var(--border, #2A2A2A)"}`,
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* 날짜 헤더 — 토글 */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "12px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 10,
          textAlign: "left",
        }}
      >
        <span style={{
          fontSize: 13, fontWeight: 800,
          color: isToday ? "#FF4D9E" : "var(--text-primary, #FAF8F5)",
        }}>
          {formatDateHeader(ymd, isToday)}
        </span>
        <span style={{ color: C_GRAY, fontSize: 11 }}>·</span>
        <span style={{ fontSize: 11, color: C_GRAY, fontWeight: 600 }}>
          {count}건
        </span>
        <span className="mono" style={{
          marginLeft: "auto",
          fontSize: 13, fontWeight: 800,
          color: "var(--text-primary, #FAF8F5)",
          letterSpacing: "-0.2px",
        }}>
          {formatKrw(total15Pct)}
        </span>
        <span style={{
          fontSize: 13, color: C_GRAY,
          transition: "transform 0.15s",
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          display: "inline-block",
        }}>▾</span>
      </button>

      {/* 펼침 — 기사별 그룹 카드 */}
      {isOpen && (
        <div style={{
          padding: "0 12px 12px",
          display: "flex", flexDirection: "column", gap: 10,
          borderTop: "1px solid var(--border, #2A2A2A)",
          paddingTop: 12,
        }}>
          {engineerGroups.map(g => (
            <EngineerGroupCard
              key={g.engineerId || g.engineerCode || g.engineerName}
              group={g}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, amount, color }) {
  return (
    <div style={{
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 12,
      padding: "14px 14px",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: C_GRAY, marginBottom: 6,
      }}>{label}</div>
      <div className="mono" style={{
        fontSize: 20, fontWeight: 800, color,
        letterSpacing: "-0.3px", lineHeight: 1.1,
      }}>{formatKrw(amount)}</div>
    </div>
  );
}

function EngineerGroupCard({ group }) {
  const isDone = !!group.allRemitted;
  const badgeColor = isDone ? C_DONE : C_PENDING;
  const badgeBg    = isDone ? "rgba(29,158,117,0.12)" : "rgba(255,59,92,0.12)";
  const badgeLabel = isDone ? "입금 완료" : "입금 대기";

  return (
    <div style={{
      background: "var(--bg-elevated, #1F1F1F)",
      border: `1px solid ${isDone ? "var(--border, #2A2A2A)" : "rgba(255,59,92,0.30)"}`,
      borderRadius: 12,
      padding: "14px 14px",
      opacity: isDone ? 0.75 : 1,
    }}>
      {/* 헤더 — 기사 이름 + 배지 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 14, fontWeight: 800,
          color: "var(--text-primary, #FAF8F5)",
        }}>
          {group.engineerCode ? `${group.engineerCode} ${group.engineerName}` : group.engineerName}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: badgeColor, background: badgeBg,
          padding: "3px 9px",
          borderRadius: 999,
        }}>{badgeLabel}</span>
      </div>

      {/* 작업별 줄 */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 6,
        marginBottom: 10,
      }}>
        {group.items.map(it => (
          <div key={it.taskId} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{
                fontSize: 10, color: C_GRAY, fontWeight: 700,
                flexShrink: 0,
              }}>{formatMd(it.completedAt)}</span>
              <span className="mono" style={{
                color: "var(--text-secondary, #B5B0A8)",
                fontWeight: 600,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                maxWidth: 130,
              }}>{it.taskNo}</span>
              <span style={{ color: C_GRAY }}>·</span>
              <span style={{
                color: C_GRAY, fontWeight: 600,
              }}>추가금 {formatKrw(it.extraFee)}</span>
            </div>
            <span className="mono" style={{
              color: it.usolRemittedAt ? C_DONE : "var(--text-primary, #FAF8F5)",
              fontWeight: 800,
              flexShrink: 0,
            }}>
              {it.usolRemittedAt ? "✓ " : ""}{formatKrw(it.fifteenPct)}
            </span>
          </div>
        ))}
      </div>

      {/* 기사별 합계 */}
      <div style={{
        paddingTop: 10,
        borderTop: "1px solid var(--border, #2A2A2A)",
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
      }}>
        <span style={{
          fontSize: 11, color: C_GRAY, fontWeight: 700,
        }}>합계 ({group.items.length}건)</span>
        <span className="mono" style={{
          fontSize: 16, fontWeight: 800,
          color: badgeColor,
          letterSpacing: "-0.3px",
        }}>{formatKrw(group.total15Pct)}</span>
      </div>
    </div>
  );
}

function EmptyBox({ children, color }) {
  return (
    <div style={{
      padding: "32px 16px", textAlign: "center",
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 12,
      color: color || C_GRAY,
      fontSize: 12, fontWeight: 600,
    }}>{children}</div>
  );
}

export default UsolRemitHistoryScreen;
