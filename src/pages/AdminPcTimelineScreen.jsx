// 2026-06-12 — AdminApp PC 작업 타임라인 (1024px+ 전용, 🅐 시간축).
//   기사별 행 × 시간 격자 (07~19시, % 균등 분배). 가로 스크롤 없음.
//   ⚠️ 처리 흐름은 별도 화면 (AdminPcFlowScreen) — 사이드바 항목 분리 (렉 해소).
//
// 2026-06-19 — 현재 시각 표시선 (now line) + 드래그&드롭 일정 조정 (1단계).
//   · 1분마다 갱신, 오늘 + 시간축 범위 내일 때만 노출.
//   · 같은 기사 행 내 좌우 드래그 → 30분 단위 스냅 → 확인 모달 → admin_reschedule_task RPC.
//   · 잠금: 진행중 / 완료 / 취소 / visit_only / 정산완료.
//   · 드래그 중 막대 자체 이동 + 새 시각 라벨 미리보기.

import { useState, useMemo, useEffect, useRef } from "react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";
import { getTaskStatusColor } from "../utils/taskStatusColor.js";
import { getServiceKind } from "../utils/workTypeKind.js";
import { AdminPcDateNav, shiftDate } from "./AdminPcDateNav.jsx";
import { adminRescheduleTask } from "../lib/adminTaskRpc.js";

const START_HOUR    = 7;
const END_HOUR      = 24;
const TOTAL_HOURS   = END_HOUR - START_HOUR;  // 17
const LANE_HEIGHT   = 52;
const ENGINEER_COL  = 120;
// 2026-06-19 — 시간당 고정폭 (사장님 spec). 컨테이너 fit X → 가로 스크롤.
//   1시간 = 80px → 7~24시 = 17 × 80 = 1360px.
const HOUR_WIDTH       = 80;
const TIME_AREA_WIDTH  = HOUR_WIDTH * TOTAL_HOURS; // 1360
const SNAP_MINUTES  = 30;
const DRAG_THRESHOLD_PX = 5;

// 일정 변경 잠금 상태 (사장님 spec — Mig 144 RPC 와 동일):
//   진행중 / 완료 / 취소 / visit_only / 정산완료.
const LOCKED_STATUSES = new Set(["진행중", "완료", "취소", "visit_only", "정산완료"]);

const KIND_COLOR = {
  cleaning:    "#0EA5E9",
  refrigerant: "#FFB800",
};
const KIND_COLOR_FALLBACK = "#9CA3AF";

const TEXT_ON_KIND = {
  cleaning:    "#fff",
  refrigerant: "#1A1A1A",
};
const TEXT_ON_KIND_FALLBACK = "#fff";

export function AdminPcTimelineScreen({ apiTasks = [], apiEngineers = [], onTaskClick, onRefresh }) {
  const [selectedDate, setSelectedDate] = useState(() => todayYmd());

  const today    = todayYmd();
  const isToday  = selectedDate === today;

  // 2026-06-19 — 현재 시각 표시선 (KST). 1분마다 갱신, 오늘 + 범위 내일 때만 노출.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const nowH = now.getHours();
  const nowM = now.getMinutes();
  const showNowLine = isToday && nowH >= START_HOUR && nowH < END_HOUR;
  const nowPct = showNowLine
    ? (((nowH - START_HOUR) + nowM / 60) / TOTAL_HOURS) * 100
    : 0;
  const nowLabel = `${pad(nowH)}:${pad(nowM)}`;

  const todayTasks = useMemo(() => {
    return (apiTasks || []).filter(t => {
      if (!t || t.status === "취소") return false;
      const scheduled = t.scheduledAt || t.scheduled_at;
      if (!scheduled) return false;
      return toKstYmd(scheduled) === selectedDate;
    });
  }, [apiTasks, selectedDate]);

  const lanes = useMemo(() => {
    const byEng = new Map();
    for (const t of todayTasks) {
      const eid   = t.assignedEngineerId || t.assigned_engineer_id || null;
      const ename = t.assignedEngineer || t.engineer || "";
      const key = eid || ename || "(미배정)";
      if (!byEng.has(key)) byEng.set(key, { key, eid, ename, tasks: [] });
      byEng.get(key).tasks.push(t);
    }
    const list = Array.from(byEng.values()).map(lane => {
      const eng = lane.eid ? (apiEngineers || []).find(e => e.id === lane.eid) : null;
      return {
        ...lane,
        name: eng?.name || lane.ename || "(미배정)",
      };
    });
    list.sort((a, b) => b.tasks.length - a.tasks.length || a.name.localeCompare(b.name));
    return list;
  }, [todayTasks, apiEngineers]);

  // 드래그 드롭 → 확인 모달.
  //   confirmInfo = { task, oldTime, newTime, newIso, onAccept, onCancel } | null
  const [confirmInfo, setConfirmInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  // 토스트 — { type: 'success' | 'error', message }
  const [toast, setToast] = useState(null);
  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  // TaskBar 가 드래그 종료 시 호출.
  //   onAcceptUI / onCancelUI 는 TaskBar 내부 drag state 해제 콜백.
  function handleTaskDragCommit({ task, oldIso, newIso, oldTime, newTime, onAcceptUI, onCancelUI }) {
    setConfirmInfo({
      task,
      oldIso,
      newIso,
      oldTime,
      newTime,
      onAcceptUI,
      onCancelUI,
    });
  }

  async function handleConfirmYes() {
    if (!confirmInfo || busy) return;
    setBusy(true);
    const { task, newIso, newTime, onAcceptUI, onCancelUI } = confirmInfo;
    try {
      const res = await adminRescheduleTask(task.id, newIso);
      if (!res || res.ok === false) {
        showToast("error", `변경 실패 — ${res?.error || "알 수 없는 오류"}`);
        onCancelUI && onCancelUI();
        setConfirmInfo(null);
        return;
      }
      showToast("success", `${task.customer || "작업"} 일정 변경 완료 (${newTime})`);
      onAcceptUI && onAcceptUI();
      setConfirmInfo(null);
      // 부모에 새 데이터 fetch 요청 — 콜백 없으면 다음 자연 fetch 시 정합.
      if (typeof onRefresh === "function") onRefresh();
    } catch (err) {
      console.error("[adminRescheduleTask]", err);
      showToast("error", "변경 실패 — 네트워크 오류");
      onCancelUI && onCancelUI();
      setConfirmInfo(null);
    } finally {
      setBusy(false);
    }
  }

  function handleConfirmNo() {
    if (busy) return;
    if (confirmInfo && typeof confirmInfo.onCancelUI === "function") {
      confirmInfo.onCancelUI();
    }
    setConfirmInfo(null);
  }

  return (
    <div style={{
      padding: "20px 24px 24px",
      display: "flex", flexDirection: "column",
      gap: 14,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{
            fontSize: 18, fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.4px",
          }}>타임라인 (시간축)</div>
          <AdminPcDateNav
            selectedDate={selectedDate}
            onPrev={() => setSelectedDate(d => shiftDate(d, -1))}
            onNext={() => setSelectedDate(d => shiftDate(d, 1))}
            onToday={() => setSelectedDate(today)}
            isToday={isToday}
          />
          <span style={{
            fontSize: 12, color: "var(--text-secondary)", fontWeight: 600,
          }}>{lanes.length}명 · {todayTasks.length}건</span>
        </div>
      </div>

      <TimeAxisView
        lanes={lanes}
        onTaskClick={onTaskClick}
        onTaskDragCommit={handleTaskDragCommit}
        showNowLine={showNowLine}
        nowPct={nowPct}
        nowLabel={nowLabel}
      />

      {confirmInfo && (
        <ConfirmDialog
          info={confirmInfo}
          busy={busy}
          onYes={handleConfirmYes}
          onNo={handleConfirmNo}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          padding: "12px 16px",
          background: toast.type === "success" ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)",
          color: "#fff",
          borderRadius: 10,
          fontSize: 13, fontWeight: 700,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          zIndex: 1000,
          fontFamily: "inherit",
        }}>{toast.message}</div>
      )}
    </div>
  );
}

function ConfirmDialog({ info, busy, onYes, onNo }) {
  const customer = info.task.customer || info.task.고객명 || "작업";
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: 20,
    }}>
      <div style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "20px 24px",
        maxWidth: 420,
        width: "100%",
        fontFamily: "inherit",
        boxShadow: "0 12px 48px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: "var(--text-secondary)",
          marginBottom: 6,
        }}>📅 일정 변경 확인</div>
        <div style={{
          fontSize: 16, fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: 14,
          letterSpacing: "-0.2px",
        }}>{customer}</div>
        <div style={{
          fontSize: 14,
          color: "var(--text-primary)",
          marginBottom: 18,
          fontVariantNumeric: "tabular-nums",
        }}>
          <span style={{ color: "var(--text-secondary)" }}>{info.oldTime}</span>
          <span style={{ margin: "0 8px", color: "var(--text-secondary)" }}>→</span>
          <span style={{ color: "#FF1B8D", fontWeight: 800 }}>{info.newTime}</span>
          <span style={{ marginLeft: 8, color: "var(--text-secondary)" }}>으로 변경할까요?</span>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onNo}
            disabled={busy}
            style={{
              minHeight: 40,
              padding: "8px 16px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              borderRadius: 8,
              fontSize: 13, fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: busy ? 0.6 : 1,
            }}
          >취소</button>
          <button
            type="button"
            onClick={onYes}
            disabled={busy}
            style={{
              minHeight: 40,
              padding: "8px 18px",
              background: "#FF1B8D",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              fontSize: 13, fontWeight: 800,
              cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: busy ? 0.7 : 1,
            }}
          >{busy ? "변경 중…" : "변경"}</button>
        </div>
      </div>
    </div>
  );
}

function TimeAxisView({ lanes, onTaskClick, onTaskDragCommit, showNowLine, nowPct, nowLabel }) {
  if (lanes.length === 0) {
    return (
      <div style={{
        padding: "60px 20px",
        textAlign: "center",
        color: "var(--text-secondary)",
        fontSize: 13, fontWeight: 600,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 14,
      }}>예정 작업 없음</div>
    );
  }

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      overflowX: "auto",         // 2026-06-19 — 가로 스크롤 (사장님 spec)
      overflowY: "hidden",
      position: "relative",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `${ENGINEER_COL}px ${TIME_AREA_WIDTH}px`,
        width: ENGINEER_COL + TIME_AREA_WIDTH,
      }}>
        <div style={{
          padding: "10px 14px",
          background: "var(--bg-elevated)",
          borderRight: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          fontSize: 11, fontWeight: 700,
          color: "var(--text-secondary)",
          letterSpacing: 0.5,
          textTransform: "uppercase",
          // 가로 스크롤 시 기사 컬럼 헤더 고정.
          position: "sticky",
          left: 0,
          zIndex: 3,
        }}>기사</div>

        <div style={{
          borderBottom: "1px solid var(--border)",
          display: "flex",
          height: 34,
        }}>
          {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
            const hour = START_HOUR + i;
            return (
              <div key={hour} style={{
                flex: 1,
                borderRight: i < TOTAL_HOURS - 1 ? "1px solid var(--border)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                color: "var(--text-secondary)",
                boxSizing: "border-box",
              }}>{hour}시</div>
            );
          })}
        </div>

        {lanes.map(lane => (
          <Lane
            key={lane.key}
            lane={lane}
            onTaskClick={onTaskClick}
            onTaskDragCommit={onTaskDragCommit}
          />
        ))}
      </div>

      {showNowLine && (
        <div style={{
          position: "absolute",
          top: 0, bottom: 0,
          // 2026-06-19 — 고정 px 폭 기반 (nowPct 폐기, ENGINEER_COL + 시각 비율 × TIME_AREA_WIDTH).
          left: `${ENGINEER_COL + (nowPct / 100) * TIME_AREA_WIDTH}px`,
          width: 0,
          pointerEvents: "none",
          zIndex: 5,
        }}>
          <div style={{
            position: "absolute",
            top: 34,
            bottom: 0,
            left: -1,
            width: 2,
            background: "#FF1B8D",
            boxShadow: "0 0 6px rgba(255, 27, 141, 0.45)",
          }}/>
          <div style={{
            position: "absolute",
            top: 6,
            left: -22,
            padding: "2px 6px",
            background: "#FF1B8D",
            color: "#fff",
            fontSize: 10, fontWeight: 800,
            borderRadius: 4,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            letterSpacing: "-0.2px",
          }}>{nowLabel}</div>
        </div>
      )}
    </div>
  );
}

function Lane({ lane, onTaskClick, onTaskDragCommit }) {
  // 시간 영역 폭 측정용 ref — 드래그 거리(px → 분) 환산에 사용.
  const laneRef = useRef(null);
  return (
    <>
      <div style={{
        padding: "8px 14px",
        borderRight: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        fontSize: 12, fontWeight: 700, color: "var(--text-primary)",
        display: "flex", alignItems: "center", gap: 6,
        minHeight: LANE_HEIGHT,
        // 가로 스크롤 시 각 행의 기사 셀도 고정 (헤더와 동일).
        position: "sticky",
        left: 0,
        zIndex: 2,
      }}>
        <span style={{
          flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{lane.name}</span>
        <span className="mono" style={{
          fontSize: 10, color: "var(--text-secondary)", fontWeight: 700,
          flexShrink: 0,
        }}>{lane.tasks.length}</span>
      </div>

      <div
        ref={laneRef}
        style={{
          position: "relative",
          borderBottom: "1px solid var(--border)",
          minHeight: LANE_HEIGHT,
          background: "var(--bg-elevated)",
        }}>
        {Array.from({ length: TOTAL_HOURS - 1 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${((i + 1) / TOTAL_HOURS) * 100}%`,
            top: 0, bottom: 0,
            width: 1,
            background: "var(--border)",
            opacity: 0.5,
          }}/>
        ))}
        {lane.tasks.map(task => (
          <TaskBar
            key={task.id || task.taskCode}
            task={task}
            laneRef={laneRef}
            onClick={() => onTaskClick?.(task)}
            onDragCommit={onTaskDragCommit}
          />
        ))}
      </div>
    </>
  );
}

function TaskBar({ task, laneRef, onClick, onDragCommit }) {
  const scheduled = task.scheduledAt || task.scheduled_at;
  // 좌측에 위치한 hooks (조건부 return 위) — Rules of Hooks.
  const [drag, setDrag] = useState(null);

  if (!scheduled) return null;
  const d = new Date(scheduled);
  if (isNaN(d.getTime())) return null;

  // base = 원래 일정 시각 (분 단위)
  const baseHours   = d.getHours();
  const baseMinutes = d.getMinutes();
  const baseTotalMin = baseHours * 60 + baseMinutes;

  // 잠금
  const isLocked = LOCKED_STATUSES.has(task.status);

  // 표시 시각 (드래그 중이면 currentMinutes, 아니면 base)
  const shownTotalMin = drag ? drag.currentMinutes : baseTotalMin;
  const shownH = Math.floor(shownTotalMin / 60);
  const shownM = shownTotalMin % 60;

  // px 위치
  const hoursOffset = (shownTotalMin / 60) - START_HOUR;
  let leftPct  = (hoursOffset / TOTAL_HOURS) * 100;
  let widthPct = (1 / TOTAL_HOURS) * 100;

  if (leftPct < 0) {
    widthPct += leftPct;
    leftPct = 0;
  }
  if (leftPct + widthPct > 100) widthPct = 100 - leftPct;
  if (widthPct <= 0) return null;

  const kind = getServiceKind(task);
  const kindColor = KIND_COLOR[kind] || KIND_COLOR_FALLBACK;
  const textCol   = TEXT_ON_KIND[kind] || TEXT_ON_KIND_FALLBACK;

  const isDone = task.status === "완료" || task.status === "정산완료" || task.status === "visit_only";
  const baseOpacity = isDone ? 0.5 : 1;
  const opacity = drag && drag.dragging ? 0.85 : baseOpacity;

  const customer = task.customer || task.고객명 || "—";
  const region   = task.region || task.district || task.지역 || "";
  const statusStyle = getTaskStatusColor(task.status);
  const baseTimeStr  = `${pad(baseHours)}:${pad(baseMinutes)}`;
  const shownTimeStr = `${pad(shownH)}:${pad(shownM)}`;
  const showPreview  = drag && drag.dragging && shownTotalMin !== baseTotalMin;
  const titleParts = [
    baseTimeStr,
    customer,
    region,
    kind === "refrigerant" ? "냉매" : kind === "cleaning" ? "세척" : "",
    task.status || "",
  ].filter(Boolean);
  const title = titleParts.join(" · ");

  function handlePointerDown(e) {
    if (isLocked) return;
    // 좌클릭만
    if (e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    setDrag({
      pointerId:  e.pointerId,
      startX:     e.clientX,
      baseMinutes: baseTotalMin,
      currentMinutes: baseTotalMin,
      dragging:   false,
    });
  }

  function handlePointerMove(e) {
    if (!drag) return;
    const laneEl = laneRef?.current;
    if (!laneEl) return;
    const rect = laneEl.getBoundingClientRect();
    if (rect.width <= 0) return;
    const deltaX = e.clientX - drag.startX;
    const dragging = drag.dragging || Math.abs(deltaX) > DRAG_THRESHOLD_PX;
    // px → 분
    const minutesDelta = (deltaX / rect.width) * TOTAL_HOURS * 60;
    let newMin = drag.baseMinutes + minutesDelta;
    // 30분 스냅
    newMin = Math.round(newMin / SNAP_MINUTES) * SNAP_MINUTES;
    // 클램프: 시작 시각이 7:00 ~ 19:30 (작업 1시간 가정 — 끝이 20시 이내)
    const minStart = START_HOUR * 60;
    const maxStart = (END_HOUR - 1) * 60 + 30; // 19:30
    newMin = Math.max(minStart, Math.min(maxStart, newMin));
    setDrag(prev => prev ? { ...prev, currentMinutes: newMin, dragging } : null);
  }

  function handlePointerUp(e) {
    if (!drag) return;
    try { e.currentTarget.releasePointerCapture(drag.pointerId); } catch (_) {}
    const wasDragging = drag.dragging;
    const moved = drag.currentMinutes !== drag.baseMinutes;
    if (wasDragging && moved) {
      const newH = Math.floor(drag.currentMinutes / 60);
      const newM = drag.currentMinutes % 60;
      const newDate = new Date(d);
      newDate.setHours(newH, newM, 0, 0);
      const newIso = newDate.toISOString();
      onDragCommit && onDragCommit({
        task,
        oldIso: scheduled,
        newIso,
        oldTime: baseTimeStr,
        newTime: `${pad(newH)}:${pad(newM)}`,
        // 부모가 commit 결과를 알려줌 → drag 해제
        onAcceptUI: () => setDrag(null),
        onCancelUI: () => setDrag(null),
      });
      // drag state 는 부모 콜백 시점까지 유지 — 막대가 새 위치 유지(미리보기 효과).
    } else {
      // 클릭으로 처리
      setDrag(null);
      onClick && onClick();
    }
  }

  function handlePointerCancel() {
    if (!drag) return;
    setDrag(null);
  }

  return (
    <button
      onClick={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      title={title}
      style={{
        position: "absolute",
        left:  `calc(${leftPct}% + 1px)`,
        top: 4,
        height: LANE_HEIGHT - 8,
        width: `calc(${widthPct}% - 2px)`,
        background: kindColor,
        border: `1px solid ${kindColor}`,
        borderLeft: `4px solid ${kindColor}`,
        borderRadius: 5,
        color: textCol,
        fontFamily: "inherit",
        cursor: isLocked ? "default" : (drag && drag.dragging ? "grabbing" : "grab"),
        padding: "4px 8px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflow: "hidden",
        textAlign: "left",
        boxSizing: "border-box",
        opacity,
        zIndex: drag && drag.dragging ? 10 : 1,
        boxShadow: drag && drag.dragging ? "0 4px 12px rgba(0,0,0,0.35)" : "none",
        transition: drag ? "none" : "left 0.15s ease",
        touchAction: "none", // 모바일 스크롤과 충돌 방지
      }}>
      <div style={{
        flex: 1, minWidth: 0,
        display: "flex", flexDirection: "column", justifyContent: "center",
        gap: 1,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 800,
          color: textCol,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.1,
        }}>{customer}</span>
        {showPreview ? (
          <span style={{
            fontSize: 9, fontWeight: 800,
            color: textCol,
            letterSpacing: "-0.1px",
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
          }}>{baseTimeStr} → {shownTimeStr}</span>
        ) : region ? (
          <span style={{
            fontSize: 9, fontWeight: 600,
            color: textCol,
            opacity: 0.8,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            lineHeight: 1.1,
          }}>{region}</span>
        ) : null}
      </div>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: statusStyle.color,
        flexShrink: 0,
      }}/>
    </button>
  );
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export default AdminPcTimelineScreen;
