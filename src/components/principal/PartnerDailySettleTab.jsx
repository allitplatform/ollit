// 2026-06-06 — KA/crikrin 원청 일정산 화면.
//   layout: 핑크 배너(오늘 받을 수수료) + M월 누적 + 일별 카드 (DateGroup 재사용).
//   상태: principal_daily_remittances 조회로 입금완료/대기 결정.
//   디자인 통일: DateGroup/SummaryCard/formatKrw — UsolRemitHistoryScreen 측 export 재사용.

import { useState, useEffect, useMemo, useCallback } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import {
  fetchPartnerDailySettle, ymdKstToday,
  markPartnerDailyRemit, undoPartnerDailyRemit, describeDailyRemitError,
} from "../../lib/partnerDailySettleDb.js";
import { DateGroup, formatKrw } from "./UsolRemitHistoryScreen.jsx";

// 색 토큰 (PrincipalSettleTab 측 동일)
const C_MAGENTA = "#FF4D9E";
const C_GREEN   = "#1D9E75";
const C_AMBER   = "#FACC15";
const C_GRAY    = "#9CA3AF";

// adminMode=true 측 운영자 토글 버튼 노출 (mark/undo RPC). actorUserId 측 currentUser.user_id (UUID).
export function PartnerDailySettleTab({ t, user, principalCodes, adminMode = false, actorUserId }) {
  const [loading, setLoading] = useState(true);
  const [days, setDays]       = useState([]);
  const [remits, setRemits]   = useState([]);
  const [error, setError]     = useState("");
  const [reloadTick, setReloadTick] = useState(0);    // 운영자 mark/undo 후 refetch 트리거
  const [busyYmd, setBusyYmd] = useState(null);       // 토글 처리 중 row (UX 중복 클릭 방지)
  const [toggleError, setToggleError] = useState("");

  const today = ymdKstToday();
  const yearMonth = today.slice(0, 7);   // 'YYYY-MM' (다음 라운드 측 월 전환 UI 가능)

  useEffect(() => {
    if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchPartnerDailySettle({ principalCodes, monthsBack: 3 })
      .then(res => {
        if (!alive) return;
        if (!res.ok) setError(res.error || "조회 실패");
        setDays(res.days || []);
        setRemits(res.remits || []);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(principalCodes), reloadTick]);

  // 운영자 토글 핸들러 (adminMode=true 측만 호출)
  const handleMark = useCallback(async (principalId, ymd, amount) => {
    if (!adminMode || !actorUserId) return;
    setBusyYmd(ymd); setToggleError("");
    const res = await markPartnerDailyRemit({ principalId, settleDate: ymd, amount, actor: actorUserId });
    setBusyYmd(null);
    if (!res?.ok) { setToggleError(describeDailyRemitError(res?.error)); return; }
    setReloadTick(n => n + 1);
  }, [adminMode, actorUserId]);

  const handleUndo = useCallback(async (principalId, ymd) => {
    if (!adminMode || !actorUserId) return;
    setBusyYmd(ymd); setToggleError("");
    const res = await undoPartnerDailyRemit({ principalId, settleDate: ymd, actor: actorUserId });
    setBusyYmd(null);
    if (!res?.ok) { setToggleError(describeDailyRemitError(res?.error)); return; }
    setReloadTick(n => n + 1);
  }, [adminMode, actorUserId]);

  // 일별 입금완료 map: '{principal_id}|{ymd}' → remit row
  const remitMap = useMemo(() => {
    const m = new Map();
    for (const r of remits) m.set(`${r.principal_id}|${r.settle_date}`, r);
    return m;
  }, [remits]);

  // 오늘 받을 수수료
  const todayDays = days.filter(d => d.ymd === today);
  const todayTotal = todayDays.reduce((s, d) => s + d.total, 0);
  const todayCompletedCount = todayDays.reduce((s, d) => s + d.completedCount, 0);
  const todayCancelCount    = todayDays.reduce((s, d) => s + d.cancelCount, 0);
  // 오늘 입금완료 — 모든 principal 의 오늘 row 가 다 있으면 done
  const todayDone = todayDays.length > 0 && todayDays.every(d => remitMap.has(`${d.principal_id}|${today}`));

  // 월 누적
  const monthDays = days.filter(d => d.ymd.startsWith(yearMonth));
  const monthTotal = monthDays.reduce((s, d) => s + d.total, 0);

  // 일별 토글 (기본 오늘만 펼침)
  const [openYmds, setOpenYmds] = useState({});
  useEffect(() => {
    if (days.length === 0) return;
    setOpenYmds(prev => Object.keys(prev).length > 0 ? prev : { [today]: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length]);

  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      {/* (1) 핑크 배너 — 오늘 받을 수수료 + 상태 + 완료N·취소N */}
      <TodayBanner
        date={today}
        total={todayTotal}
        done={todayDone}
        completedCount={todayCompletedCount}
        cancelCount={todayCancelCount}
      />

      {/* (2) M월 누적 */}
      <div style={{ margin: "14px 4px 10px", display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 11, color: C_GRAY, fontWeight: 700 }}>
          {Number(yearMonth.slice(5, 7))}월 누적
        </span>
        <span className="mono" style={{
          fontSize: 13, fontWeight: 800,
          color: "var(--text-primary, #FAF8F5)",
          letterSpacing: "-0.2px",
        }}>{formatKrw(monthTotal)}</span>
      </div>

      {/* (3) 일별 카드 */}
      {loading && <Box>불러오는 중...</Box>}
      {!loading && error && <Box color="#FF3B5C">⚠️ {error}</Box>}
      {!loading && !error && monthDays.length === 0 && (
        <Box>이번 달 정산 내역이 없습니다</Box>
      )}
      {adminMode && toggleError && (
        <div style={{
          marginBottom: 10, padding: "8px 12px",
          background: "rgba(255,59,92,0.10)", border: "1px solid rgba(255,59,92,0.30)",
          borderRadius: 8, fontSize: 11, color: "#FF3B5C", fontWeight: 600,
        }}>⚠️ {toggleError}</div>
      )}
      {!loading && monthDays.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {monthDays.map(d => {
            const remit = remitMap.get(`${d.principal_id}|${d.ymd}`);
            const done = !!remit;
            const busy = busyYmd === d.ymd;
            return (
              <DateGroup
                key={d.key}
                ymd={d.ymd}
                isToday={d.ymd === today}
                isOpen={!!openYmds[d.ymd]}
                onToggle={() => setOpenYmds(o => ({ ...o, [d.ymd]: !o[d.ymd] }))}
                count={d.count}
                total={d.total}
                totalStrike={done}
                totalColor={C_MAGENTA}
                leftBadge={<StateBadge done={done}/>}
              >
                {d.tasks.map(task => <TaskRow key={task.task_id} task={task}/>)}
                {adminMode && (
                  <AdminToggle
                    done={done} busy={busy}
                    onMark={() => handleMark(d.principal_id, d.ymd, d.total)}
                    onUndo={() => handleUndo(d.principal_id, d.ymd)}
                  />
                )}
              </DateGroup>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── sub-components ────────────────────────────────────────────

function TodayBanner({ date, total, done, completedCount, cancelCount }) {
  const dateLabel = formatTodayDate(date);
  const badge = done
    ? { label: "입금완료", color: C_GREEN, bg: "rgba(29,158,117,0.18)", icon: <CheckCircle2 size={11}/> }
    : { label: "대기",    color: C_AMBER, bg: "rgba(250,204,21,0.20)",  icon: <Clock size={11}/> };
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C_MAGENTA} 0%, #FF1B8D 100%)`,
      borderRadius: 14,
      padding: "16px 18px",
      color: "#fff",
      boxShadow: "0 4px 12px rgba(255, 27, 141, 0.18)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, marginBottom: 6 }}>
        오늘 받을 수수료 · {dateLabel}
      </div>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 8,
      }}>
        <span className="mono" style={{
          fontSize: 28, fontWeight: 800,
          letterSpacing: "-0.5px",
          textDecoration: done ? "line-through" : "none",
          opacity: done ? 0.75 : 1,
        }}>{formatKrw(total)}</span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 11, fontWeight: 700,
          color: "#fff",
          background: badge.bg,
          padding: "5px 12px",
          borderRadius: 999,
        }}>{badge.icon}{badge.label}</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>
        완료 {completedCount} · 취소 {cancelCount}
      </div>
    </div>
  );
}

function StateBadge({ done }) {
  if (done) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 9, fontWeight: 800, color: "#fff",
        background: C_GREEN,
        padding: "2px 6px", borderRadius: 4,
      }}>
        <CheckCircle2 size={9}/>완료
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 9, fontWeight: 800, color: "#1a1a1a",
      background: C_AMBER,
      padding: "2px 6px", borderRadius: 4,
    }}>
      <Clock size={9}/>대기
    </span>
  );
}

function TaskRow({ task }) {
  const isCanceled = task.isCanceled;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 4px",
      fontSize: 12,
      opacity: isCanceled ? 0.55 : 1,
    }}>
      <span style={{ fontSize: 13, color: "#FFA94D", flexShrink: 0 }}>⚡</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: "var(--text-primary, #FAF8F5)",
          textDecoration: isCanceled ? "line-through" : "none",
        }}>{task.customer || "—"}</span>
        {task.summary && (
          <span style={{ fontSize: 11, color: C_GRAY, marginLeft: 6 }}>
            ({task.summary})
          </span>
        )}
      </div>
      {isCanceled ? (
        <span style={{ fontSize: 11, fontWeight: 700, color: C_GRAY, flexShrink: 0 }}>취소</span>
      ) : (
        <span className="mono" style={{
          fontSize: 13, fontWeight: 800, color: C_MAGENTA, flexShrink: 0,
          letterSpacing: "-0.2px",
        }}>{formatKrw(task.principal_amount)}</span>
      )}
    </div>
  );
}

function AdminToggle({ done, busy, onMark, onUndo }) {
  // 운영자 토글 — 일별 카드 펼침 안. 대기→지급완료(mark) / 입금완료→취소(undo).
  return (
    <div style={{
      marginTop: 8, paddingTop: 10,
      borderTop: "1px dashed var(--border, #2A2A2A)",
      display: "flex", justifyContent: "flex-end",
    }}>
      {done ? (
        <button onClick={onUndo} disabled={busy} style={{
          padding: "6px 14px",
          background: "transparent",
          border: `1px solid ${C_GRAY}`,
          borderRadius: 8,
          color: C_GRAY,
          fontSize: 11, fontWeight: 700,
          cursor: busy ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          opacity: busy ? 0.5 : 1,
        }}>{busy ? "처리 중..." : "지급 취소"}</button>
      ) : (
        <button onClick={onMark} disabled={busy} style={{
          padding: "6px 14px",
          background: C_GREEN,
          border: "none",
          borderRadius: 8,
          color: "#fff",
          fontSize: 11, fontWeight: 800,
          cursor: busy ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          opacity: busy ? 0.5 : 1,
        }}>{busy ? "처리 중..." : "✓ 지급완료 표시"}</button>
      )}
    </div>
  );
}

function Box({ children, color }) {
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

function formatTodayDate(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${m}/${d}(${weekdays[date.getDay()]})`;
}

export default PartnerDailySettleTab;
