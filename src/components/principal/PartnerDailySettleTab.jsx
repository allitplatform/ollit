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
// 2026-06-09 — visit_only 측 "출장비만" 배지 (공용, 작업 화면과 동일).
import { VisitBadge } from "../common/VisitBadge.jsx";

// 색 토큰 — 사장님 시안값.
const C_BANNER_PINK    = "#FF1B8D";              // 핑크 배너 background
const C_BANNER_LABEL   = "rgba(255,255,255,0.9)"; // 배너 라벨/카운트 — 거의 흰색 (위계는 크기 12/30 으로)
const C_BANNER_BADGE_T = "#B5651D";              // 배너 대기 배지 글자 (흰 배경 위 brown)
const C_MAGENTA        = "#FF4DA6";              // 일별 카드 금액 핑크
const C_GREEN_DONE     = "#34D399";              // 다크 카드 완료 배지
const C_AMBER          = "#FBBF24";              // 다크 카드 대기 배지 글자
const C_AMBER_BG       = "rgba(251,191,36,0.14)";// 다크 카드 대기 배지 배경 (반투명)
const C_GRAY           = "#9CA3AF";

// adminMode=true 측 운영자 토글 버튼 노출 (mark/undo RPC). actorUserId 측 currentUser.user_id (UUID).
// 2026-06-09 — onTaskClick 추가: 목록 클릭 측 상세 진입 흐름 (유솔H 측 SettleDetailBoxSimple 측).
//   미지정 측 옛 동작 (TaskRow 측 클릭 X). KA/crikrin 측 옛 호출 측 무손상.
export function PartnerDailySettleTab({ t, user, principalCodes, adminMode = false, actorUserId, onTaskClick = null }) {
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
                {d.tasks.map(task => <TaskRow key={task.task_id} task={task} onTaskClick={onTaskClick}/>)}
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
  // 2026-06-06 시안값:
  //   배너 bg #FF1B8D, radius 14, padding 16, 가운데 정렬
  //   라벨 12px #FFD7E9 / 금액 30px weight 500 #fff (margin 4 0 8)
  //   배지+카운트 한 줄, inline-flex gap 8
  //     · 대기 배지(흰 배경) bg #fff color #B5651D 11px padding 2/9 radius 7 시계 아이콘 gap 4
  //     · "완료N·취소N" 11px #FFD7E9
  const dateLabel = formatTodayDate(date);
  return (
    <div style={{
      background: C_BANNER_PINK,
      borderRadius: 14,
      padding: 16,
      color: "#fff",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 12, color: C_BANNER_LABEL }}>
        오늘 받을 수수료 · {dateLabel}
      </div>
      <div className="mono" style={{
        fontSize: 30, fontWeight: 500,
        color: "#fff",
        margin: "4px 0 8px",
        letterSpacing: "-0.5px",
        textDecoration: done ? "line-through" : "none",
        opacity: done ? 0.85 : 1,
        lineHeight: 1.1,
      }}>{formatKrw(total)}</div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          background: "#fff",
          color: C_BANNER_BADGE_T,
          fontSize: 11, fontWeight: 700,
          padding: "2px 9px",
          borderRadius: 7,
        }}>
          {done ? <CheckCircle2 size={11}/> : <Clock size={11}/>}
          {done ? "입금완료" : "대기"}
        </span>
        <span style={{ fontSize: 11, color: C_BANNER_LABEL, fontWeight: 600 }}>
          완료 {completedCount} · 취소 {cancelCount}
        </span>
      </div>
    </div>
  );
}

function StateBadge({ done }) {
  // 다크 카드 안 배지 — 배너 흰 배지와 구분 (배경 다크).
  //   입금완료 : 솔리드 #34D399 (시안)
  //   대기      : 반투명 노랑 #FBBF24 + bg rgba(...0.14) (시안)
  if (done) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 9, fontWeight: 800, color: "#fff",
        background: C_GREEN_DONE,
        padding: "2px 6px", borderRadius: 4,
      }}>
        <CheckCircle2 size={9}/>완료
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 9, fontWeight: 800, color: C_AMBER,
      background: C_AMBER_BG,
      padding: "2px 6px", borderRadius: 4,
    }}>
      <Clock size={9}/>대기
    </span>
  );
}

function TaskRow({ task, onTaskClick = null }) {
  const isCanceled  = task.isCanceled;
  const isVisitOnly = task.isVisitOnly;
  const clickable = typeof onTaskClick === "function";
  // 2026-06-09 — onTaskClick 측 task payload 측 전달 — TaskDetail 측 진입.
  //   shape: TaskRow 측 task object (task_id / task_no / customer / status / principal_amount 등).
  //   부모 PrincipalApp 측 setSelectedTask 측 id 필드 측 매핑.
  const handleClick = clickable ? () => onTaskClick({
    id:           task.task_id,
    taskId:       task.task_id,
    taskCode:     task.task_no,
    taskNo:       task.task_no,
    customer:     task.customer,
    status:       task.status,
  }) : undefined;
  return (
    <div
      onClick={handleClick}
      className={clickable ? "clickable" : undefined}
      style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 4px",
      fontSize: 12,
      opacity: isCanceled ? 0.55 : 1,
      cursor: clickable ? "pointer" : "default",
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
      {/* 2026-06-09 — 표시 우선순위: 취소 > 출장비만 > 금액. visit_only 측 "출장비만" 배지 (작업 화면과 정합). */}
      {isCanceled ? (
        <span style={{ fontSize: 11, fontWeight: 700, color: C_GRAY, flexShrink: 0 }}>취소</span>
      ) : isVisitOnly ? (
        <VisitBadge size={10}/>
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
          background: C_GREEN_DONE,
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
