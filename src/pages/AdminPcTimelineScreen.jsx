// 2026-06-12 — AdminApp PC 작업 타임라인 (1024px+ 전용, 🅐 시간축).
//   기사별 행 × 시간 격자 (07~19시, % 균등 분배). 가로 스크롤 없음.
//   ⚠️ 처리 흐름은 별도 화면 (AdminPcFlowScreen) — 사이드바 항목 분리 (렉 해소).
//
// 2026-06-19 — 현재 시각 표시선 (now line) + 드래그&드롭 일정 조정 (1단계).
//   · 1분마다 갱신, 오늘 + 시간축 범위 내일 때만 노출.
//   · 같은 기사 행 내 좌우 드래그 → 30분 단위 스냅 → 확인 모달 → admin_reschedule_task RPC.
//   · 잠금: 진행중 / 완료 / 취소 / visit_only / 정산완료.
//   · 드래그 중 막대 자체 이동 + 새 시각 라벨 미리보기.

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";

// 2026-06-20 trace — 모듈 로드 자체 확인 (HMR 미반영 진단).
console.log('[AdminPcTimelineScreen MODULE LOADED v2026-06-20-trace5]');
import { getTaskStatusColor } from "../utils/taskStatusColor.js";
import { getServiceKind } from "../utils/workTypeKind.js";
import { AdminPcDateNav, shiftDate } from "./AdminPcDateNav.jsx";
import { adminRescheduleTask, adminReassignTask } from "../lib/adminTaskRpc.js";
import { supabase } from "../lib/supabase.js";

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
  // 2026-06-20 trace — 메인 컴포넌트 렌더 확인.
  console.log('[AdminPcTimelineScreen RENDER] apiTasks=', apiTasks.length, 'hasOnTaskClick=', !!onTaskClick);
  const [selectedDate, setSelectedDate] = useState(() => todayYmd());

  const today    = todayYmd();
  const isToday  = selectedDate === today;

  // 2026-06-19 — 검색 + 점프 + 강조 (사장님 spec).
  //   매칭: 고객명 / 주소 / 연락처 / 작업번호 — 날짜 무관, 완료/취소 포함.
  //   디바운스 300ms. 결과 클릭 → 해당 날짜로 점프 + 막대 핑크 강조 + 다른 막대
  //   흐림(opacity 0.3) + 가로 스크롤 가운데로.
  //   강조 해제: 검색창을 사용자가 비우거나 날짜를 수동(prev/next/today)으로 바꿀 때.
  const [searchQuery, setSearchQuery]     = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showResults, setShowResults]     = useState(false);
  const [highlightTaskId, setHighlightTaskId] = useState(null);
  const scrollWrapperRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const searchResults = useMemo(() => {
    if (!debouncedQuery) return [];
    const q = debouncedQuery.toLowerCase();
    const matched = [];
    for (const t of (apiTasks || [])) {
      if (!t) continue;
      const scheduled = t.scheduledAt || t.scheduled_at;
      if (!scheduled) continue;                  // 일정 없는 작업은 점프 대상 X
      const fields = [
        t.customer, t.customerName, t.고객명,
        t.address, t.fullAddress, t.region,
        t.phone, t.전화번호,
        t.task_no, t.taskNo, t.taskCode,
      ].filter(Boolean).join(" ").toLowerCase();
      if (fields.includes(q)) matched.push(t);
    }
    matched.sort((a, b) => {
      const aT = new Date(a.scheduledAt || a.scheduled_at).getTime();
      const bT = new Date(b.scheduledAt || b.scheduled_at).getTime();
      return aT - bT;
    });
    return matched.slice(0, 10);
  }, [apiTasks, debouncedQuery]);

  // 검색창을 사용자가 직접 비웠을 때(빈 입력으로 onChange) 강조 해제.
  //   결과 클릭은 검색창 그대로 유지 → 이 effect 안 발화.
  useEffect(() => {
    if (searchQuery === "" && highlightTaskId) {
      setHighlightTaskId(null);
    }
  }, [searchQuery, highlightTaskId]);

  // 날짜 nav (prev/next/today) — 강조 해제 + 검색 드롭다운 닫기.
  const handleManualDate = useCallback((updater) => {
    setSelectedDate(prev => typeof updater === "function" ? updater(prev) : updater);
    setHighlightTaskId(null);
    setShowResults(false);
  }, []);

  // 검색 결과 클릭 → 그 작업 날짜로 점프 + 강조 + 가로 스크롤.
  function handleSelectResult(task) {
    const scheduled = task.scheduledAt || task.scheduled_at;
    if (!scheduled) return;
    const ymd = toKstYmd(scheduled);
    setSelectedDate(ymd);
    setHighlightTaskId(task.id || task.taskCode);
    setShowResults(false);
    // 가로 스크롤 — state 반영 후
    setTimeout(() => {
      const dt = new Date(scheduled);
      const h = dt.getHours();
      const m = dt.getMinutes();
      const taskCenterPx = ENGINEER_COL + (h - START_HOUR + m / 60) * HOUR_WIDTH + (HOUR_WIDTH / 2);
      const wrap = scrollWrapperRef.current;
      if (wrap) {
        const target = taskCenterPx - wrap.clientWidth / 2;
        wrap.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
      }
    }, 80);
  }

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
      // 2026-06-19 — eid 추출 강화 (4 키 fallback). 정규화 경로마다 키 이름이 달라
      //   한 두 곳만 보면 일부 task 의 lane.eid 가 null 로 떨어져 cross-lane drop 시
      //   target.eid 없음 → 거부 분기 진입 (사장님 보고 사고 원인).
      const eid   = t.assignedEngineerId || t.assigned_engineer_id
                 || t.engineerId         || t.engineer_id || null;
      const ename = t.assignedEngineer || t.engineer || "";
      const key = eid || ename || "(미배정)";
      if (!byEng.has(key)) byEng.set(key, { key, eid, ename, tasks: [] });
      // 첫 task 가 eid 없이 들어왔어도 이후 task 에 eid 있으면 lane.eid 보강.
      const laneRef = byEng.get(key);
      if (!laneRef.eid && eid) laneRef.eid = eid;
      laneRef.tasks.push(t);
    }
    // 2026-06-19 — engineerUserId(UUID) 필드 분리 (사장님 진단 사고 정정).
    //   apiEngineers 의 e.id 는 시트 code(E001 등) 일 수 있어 lane.eid 에 code 가
    //   섞임 → RPC p_engineer_id(uuid) 에 그대로 전달되면
    //   "invalid input syntax for type uuid: 'E002'" 에러.
    //   해결: engineerUserId 별도 필드에 UUID 만 담음. lane.eid 는 표시/매칭용
    //   그대로(code 가능). RPC 호출 시 engineerUserId 사용.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    function pickUuid(...candidates) {
      for (const v of candidates) {
        if (typeof v === "string" && UUID_RE.test(v)) return v;
      }
      return null;
    }
    const list = Array.from(byEng.values()).map(lane => {
      let eng = null;
      if (lane.eid) {
        eng = (apiEngineers || []).find(e => e.id === lane.eid);
      }
      if (!eng && lane.ename) {
        eng = (apiEngineers || []).find(e => e.name === lane.ename);
      }
      // task 첫 행의 모든 가능한 UUID 키 + apiEngineers 매칭 결과의 user_id/uuid 등.
      const firstTask = lane.tasks[0] || {};
      const engineerUserId = pickUuid(
        firstTask.assignedEngineerUserId,
        firstTask.engineerUserId,
        firstTask.assigned_engineer_user_id,
        firstTask.assignedEngineerId,
        firstTask.assigned_engineer_id,
        firstTask.engineer_id,
        eng?.user_id,
        eng?.userId,
        eng?.uuid,
        eng?.userUuid,
        eng?.id,
        lane.eid,
      );
      return {
        ...lane,
        eid:  lane.eid || eng?.id || null,
        engineerUserId,                  // UUID 만 (없으면 null)
        engineerCode: eng?.code || (UUID_RE.test(lane.eid || "") ? null : lane.eid),
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
  //   같은 lane → 시간만 변경 (adminRescheduleTask).
  //   다른 lane → 재배정 (adminReassignTask) — 기사 + 일정 동시.
  //   겹침 검사: 도착 lane(target) 의 활성 막대 기준 (사장님 spec).
  function handleTaskDragCommit({
    task, sourceLaneKey, targetLaneKey,
    oldIso, newIso, oldTime, newTime,
    newMinutes, durationMinutes,
    siblings, laneName,
    onAcceptUI, onCancelUI,
  }) {
    const isReassign = !!(targetLaneKey && sourceLaneKey && targetLaneKey !== sourceLaneKey);

    // 도착 lane 정보 lookup (재배정 시 새 기사 + target siblings 추출)
    let targetLane = null;
    let newEngineerUserId = null;     // ← UUID (RPC 인자)
    let newEngineerCode   = null;     // ← code (UUID lookup 실패 시 supabase 조회용)
    let newEngineerName   = laneName;
    let targetSiblings    = siblings || [];
    if (isReassign) {
      targetLane = lanes.find(l => l.key === targetLaneKey);
      if (!targetLane) {
        showToast("error", "대상 기사 lane 식별 실패 — 새로고침 후 다시 시도");
        onCancelUI && onCancelUI();
        return;
      }
      // engineerUserId(UUID) 또는 engineerCode 중 하나라도 있으면 진행 (둘 다 없으면 거부).
      //   handleConfirmYes 가 UUID 없으면 code → supabase users 조회로 채움.
      if (!targetLane.engineerUserId && !targetLane.engineerCode && !targetLane.eid) {
        showToast("error", `'${targetLane.name}' 기사 ID 식별 실패 — 새로고침 후 다시 시도`);
        onCancelUI && onCancelUI();
        return;
      }
      newEngineerUserId = targetLane.engineerUserId || null;
      newEngineerCode   = targetLane.engineerCode  || (targetLane.eid && !targetLane.engineerUserId ? targetLane.eid : null);
      newEngineerName   = targetLane.name;
      const tid         = task.id || task.taskCode;
      targetSiblings    = targetLane.tasks.filter(t => (t.id || t.taskCode) !== tid);
    }

    // 겹침 검사 — target lane 기준 (재배정이면 도착 lane, 시간만이면 source lane)
    const newStart = Number(newMinutes) || 0;
    const dur      = Number(durationMinutes) || 60;
    const newEnd   = newStart + dur;
    const inactive = new Set(["완료", "취소", "visit_only"]);

    const conflicts = [];
    for (const t of (targetSiblings || [])) {
      if (inactive.has(t.status)) continue;
      const at = t.scheduledAt || t.scheduled_at;
      if (!at) continue;
      if (toKstYmd(at) !== selectedDate) continue;
      const dt = new Date(at);
      if (isNaN(dt.getTime())) continue;
      const s = dt.getHours() * 60 + dt.getMinutes();
      const e = s + dur;
      if (newStart < e && s < newEnd) {
        conflicts.push({ task: t, start: s });
      }
    }
    conflicts.sort((a, b) => a.start - b.start);

    let conflict = null;
    if (conflicts.length > 0) {
      const first = conflicts[0];
      const timeStr = `${pad(Math.floor(first.start / 60))}:${pad(first.start % 60)}`;
      conflict = {
        laneName: newEngineerName,
        timeStr,
        extra: conflicts.length - 1,
      };
    }

    setConfirmInfo({
      task,
      isReassign,
      oldEngineerName: laneName,
      newEngineerName,
      newEngineerUserId,     // UUID 또는 null
      newEngineerCode,       // code 또는 null
      oldIso,
      newIso,
      oldTime,
      newTime,
      conflict,
      onAcceptUI,
      onCancelUI,
    });
  }

  async function handleConfirmYes() {
    if (!confirmInfo || busy) return;
    setBusy(true);
    const { task, isReassign, newEngineerUserId, newEngineerCode, newEngineerName, newIso, newTime, onAcceptUI, onCancelUI } = confirmInfo;
    try {
      let res;
      if (isReassign) {
        // 2026-06-19 — UUID 우선, 없으면 code → supabase users 조회 fallback.
        //   apiEngineers 시트 캐시가 user_id(UUID) 없는 경우 안전망.
        let engineerUuid = newEngineerUserId;
        if (!engineerUuid && newEngineerCode) {
          const { data, error } = await supabase
            .from("users")
            .select("id")
            .eq("code", newEngineerCode)
            .maybeSingle();
          if (!error && data?.id) {
            engineerUuid = data.id;
          }
        }
        if (!engineerUuid) {
          showToast("error", `'${newEngineerName}' 기사 UUID 조회 실패`);
          onCancelUI && onCancelUI();
          setConfirmInfo(null);
          return;
        }
        res = await adminReassignTask(task.id, engineerUuid, newIso);
      } else {
        res = await adminRescheduleTask(task.id, newIso);
      }
      if (!res || res.ok === false) {
        showToast("error", `변경 실패 — ${res?.error || "알 수 없는 오류"}`);
        onCancelUI && onCancelUI();
        setConfirmInfo(null);
        return;
      }
      const msg = isReassign
        ? `${task.customer || "작업"} 재배정 완료 (${newEngineerName} · ${newTime})`
        : `${task.customer || "작업"} 일정 변경 완료 (${newTime})`;
      showToast("success", msg);
      onAcceptUI && onAcceptUI();
      setConfirmInfo(null);
      if (typeof onRefresh === "function") onRefresh();
    } catch (err) {
      console.error("[handleConfirmYes]", err);
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
            onPrev={() => handleManualDate(d => shiftDate(d, -1))}
            onNext={() => handleManualDate(d => shiftDate(d, 1))}
            onToday={() => handleManualDate(today)}
            isToday={isToday}
          />
          <span style={{
            fontSize: 12, color: "var(--text-secondary)", fontWeight: 600,
          }}>{lanes.length}명 · {todayTasks.length}건</span>
        </div>

        {/* 2026-06-19 — 검색창 (헤더 우측) */}
        <SearchBox
          query={searchQuery}
          onQueryChange={setSearchQuery}
          results={searchResults}
          showResults={showResults}
          setShowResults={setShowResults}
          onSelect={handleSelectResult}
        />
      </div>

      <TimeAxisView
        wrapperRef={scrollWrapperRef}
        lanes={lanes}
        onTaskClick={onTaskClick}
        onTaskDragCommit={handleTaskDragCommit}
        showNowLine={showNowLine}
        nowPct={nowPct}
        nowLabel={nowLabel}
        highlightTaskId={highlightTaskId}
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
  const headerLabel = info.isReassign ? "🔄 재배정 확인" : "📅 일정 변경 확인";
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
        maxWidth: 440,
        width: "100%",
        fontFamily: "inherit",
        boxShadow: "0 12px 48px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: "var(--text-secondary)",
          marginBottom: 6,
        }}>{headerLabel}</div>
        <div style={{
          fontSize: 16, fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: 14,
          letterSpacing: "-0.2px",
        }}>{customer}</div>
        {info.isReassign && (
          <div style={{
            fontSize: 14,
            color: "var(--text-primary)",
            marginBottom: 8,
            fontVariantNumeric: "tabular-nums",
          }}>
            <span style={{ color: "var(--text-secondary)" }}>{info.oldEngineerName || "기존"}</span>
            <span style={{ margin: "0 8px", color: "var(--text-secondary)" }}>→</span>
            <span style={{ color: "#8B5CF6", fontWeight: 800 }}>{info.newEngineerName || "—"}</span>
            <span style={{ marginLeft: 8, color: "var(--text-secondary)" }}>기사</span>
          </div>
        )}
        <div style={{
          fontSize: 14,
          color: "var(--text-primary)",
          marginBottom: info.conflict ? 12 : 18,
          fontVariantNumeric: "tabular-nums",
        }}>
          <span style={{ color: "var(--text-secondary)" }}>{info.oldTime}</span>
          <span style={{ margin: "0 8px", color: "var(--text-secondary)" }}>→</span>
          <span style={{ color: "#FF1B8D", fontWeight: 800 }}>{info.newTime}</span>
          <span style={{ marginLeft: 8, color: "var(--text-secondary)" }}>으로 변경할까요?</span>
        </div>
        {info.conflict && (
          <div style={{
            background: "rgba(255, 184, 0, 0.12)",
            border: "1px solid rgba(255, 184, 0, 0.55)",
            color: "#A06400",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            marginBottom: 16,
            lineHeight: 1.45,
          }}>
            ⚠️ {info.conflict.laneName} {info.conflict.timeStr} 시간대에 이미 작업 있음
            {info.conflict.extra > 0 && ` 외 ${info.conflict.extra}건`}
          </div>
        )}
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

function TimeAxisView({ wrapperRef, lanes, onTaskClick, onTaskDragCommit, showNowLine, nowPct, nowLabel, highlightTaskId }) {
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
    <div
      ref={wrapperRef}
      style={{
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
            highlightTaskId={highlightTaskId}
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

function Lane({ lane, onTaskClick, onTaskDragCommit, highlightTaskId }) {
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
        data-lane-key={lane.key}
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
        {lane.tasks.map(task => {
          // 2026-06-19 — 같은 lane 의 다른 막대들 (자기 자신 제외) 을 TaskBar 에
          //   전달 → 드래그 commit 시 부모가 겹침 검사에 사용 (source lane 한정).
          //   cross-lane 재배정 시 target lane siblings 는 부모가 lanes lookup 으로 추출.
          const tid = task.id || task.taskCode;
          const siblings = lane.tasks.filter(t => (t.id || t.taskCode) !== tid);
          return (
            <TaskBar
              key={tid}
              task={task}
              laneRef={laneRef}
              sourceLaneKey={lane.key}
              siblings={siblings}
              laneName={lane.name}
              onClick={() => onTaskClick?.(task)}
              onDragCommit={onTaskDragCommit}
              highlightTaskId={highlightTaskId}
            />
          );
        })}
      </div>
    </>
  );
}

function TaskBar({ task, laneRef, sourceLaneKey, siblings, laneName, onClick, onDragCommit, highlightTaskId }) {
  // 2026-06-20 trace — TaskBar 렌더 확인 (조건부 return 위).
  console.log('[TaskBar RENDER]', task.id || task.taskCode, 'status=', task.status, 'isLocked=', LOCKED_STATUSES.has(task.status), 'hasOnClick=', !!onClick);
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
  // 2026-06-19 — 검색 강조 / 흐림.
  const tidStr = task.id || task.taskCode;
  const isHighlightActive = !!highlightTaskId;
  const isHighlighted    = isHighlightActive && highlightTaskId === tidStr;
  const isDimmed         = isHighlightActive && !isHighlighted;
  const baseOpacity = isDimmed ? 0.3 : (isDone ? 0.5 : 1);
  const opacity = drag && drag.dragging ? 0.85 : baseOpacity;

  // 2026-06-19 — cross-lane 드래그 시각 강조 (다른 기사 lane 위에 올라간 상태).
  const isCrossLaneDrag = drag && drag.dragging && drag.targetLaneKey
    && drag.targetLaneKey !== sourceLaneKey;

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
    // 2026-06-20 trace — 잠금 막대 클릭 누락 진단 (사장님 보고).
    console.log('[TaskBar PD]', { taskId: task.id || task.taskCode, status: task.status, isLocked, button: e.button, pointerId: e.pointerId, hasOnClick: !!onClick });
    // 좌클릭만
    if (e.button !== 0) { console.log('[TaskBar PD] non-left button, return'); return; }
    let captured = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); captured = true; } catch (err) {
      console.log('[TaskBar PD] setPointerCapture FAILED', err);
    }
    console.log('[TaskBar PD] captured?', captured);
    // 2026-06-20 — 잠금 막대도 pointerdown 받음. 이동량 < 임계값이면 pointerup 측 onClick 호출 (작업상세).
    //   드래그 자체 차단은 handlePointerMove / handlePointerUp 의 locked 분기.
    setDrag({
      pointerId:  e.pointerId,
      startX:     e.clientX,
      startY:     e.clientY,
      baseMinutes: baseTotalMin,
      currentMinutes: baseTotalMin,
      deltaY:     0,
      targetLaneKey: sourceLaneKey,  // 처음엔 자기 lane
      dragging:   false,
      locked:     isLocked,
    });
    console.log('[TaskBar PD] setDrag called locked=', isLocked);
  }

  function handlePointerMove(e) {
    if (!drag) return;
    // 2026-06-20 — 잠금 막대: 시간/lane 갱신 안 함 (pointerup 측 이동량 검사만).
    if (drag.locked) return;
    const laneEl = laneRef?.current;
    if (!laneEl) return;
    const rect = laneEl.getBoundingClientRect();
    if (rect.width <= 0) return;
    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;
    const dragging = drag.dragging
      || Math.abs(deltaX) > DRAG_THRESHOLD_PX
      || Math.abs(deltaY) > DRAG_THRESHOLD_PX;

    // X: 시간 환산 + 30분 스냅 + 클램프
    const minutesDelta = (deltaX / rect.width) * TOTAL_HOURS * 60;
    let newMin = drag.baseMinutes + minutesDelta;
    newMin = Math.round(newMin / SNAP_MINUTES) * SNAP_MINUTES;
    const minStart = START_HOUR * 60;
    const maxStart = (END_HOUR - 1) * 60 + 30;
    newMin = Math.max(minStart, Math.min(maxStart, newMin));

    // 2026-06-19 — target lane 식별: 막대(ghost) 시각적 box 의 center 사용.
    //   이전: e.clientX/Y (커서) 사용 → 사용자가 막대 가장자리를 잡으면 커서가
    //   막대 box 밖에 있을 수 있어 시각/판정 불일치 (사장님 보고 사고).
    //   현재: pointer-events:none 으로 막대 hit-test 제외 + getBoundingClientRect
    //   로 막대 box center 추출 → 막대가 시각적으로 안착한 lane 정확히 식별.
    let targetLaneKey = sourceLaneKey;
    try {
      const barRect = e.currentTarget.getBoundingClientRect();
      const barCenterX = barRect.left + barRect.width / 2;
      const barCenterY = barRect.top + barRect.height / 2;
      const el = document.elementFromPoint(barCenterX, barCenterY);
      if (el) {
        const laneEl2 = el.closest && el.closest("[data-lane-key]");
        if (laneEl2 && laneEl2.dataset && laneEl2.dataset.laneKey) {
          targetLaneKey = laneEl2.dataset.laneKey;
        }
      }
    } catch (_) {}

    setDrag(prev => prev ? {
      ...prev,
      currentMinutes: newMin,
      deltaY,
      targetLaneKey,
      dragging,
    } : null);
  }

  function handlePointerUp(e) {
    // 2026-06-20 trace — 잠금 막대 클릭 누락 진단.
    console.log('[TaskBar PU]', { taskId: task.id || task.taskCode, status: task.status, hasDrag: !!drag, locked: drag?.locked, hasOnClick: !!onClick });
    if (!drag) { console.log('[TaskBar PU] drag null — return (no onClick)'); return; }
    try { e.currentTarget.releasePointerCapture(drag.pointerId); } catch (_) {}
    // 2026-06-20 — 잠금 막대 클릭 처리: 이동량 < DRAG_THRESHOLD_PX 이면 onClick (작업상세).
    //   드래그 가능 막대의 클릭 분기(line 938~941)와 동일 로직 — wasDragging=false + movedTime/Lane=false 일 때 onClick.
    if (drag.locked) {
      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;
      const moved = Math.abs(deltaX) > DRAG_THRESHOLD_PX
                 || Math.abs(deltaY) > DRAG_THRESHOLD_PX;
      console.log('[TaskBar PU locked]', { deltaX, deltaY, moved, willCallOnClick: !moved && !!onClick });
      setDrag(null);
      if (!moved) onClick && onClick();
      return;
    }
    const wasDragging = drag.dragging;
    const movedTime  = drag.currentMinutes !== drag.baseMinutes;

    // 2026-06-19 — pointerup 시점에도 막대 box center 로 target lane 재추출.
    //   pointermove 와 같은 기준 사용 → 시각/판정 일치 보장 + stale closure 안전망.
    let finalTargetLaneKey = drag.targetLaneKey || sourceLaneKey;
    try {
      const barRect = e.currentTarget.getBoundingClientRect();
      const barCenterX = barRect.left + barRect.width / 2;
      const barCenterY = barRect.top + barRect.height / 2;
      const el = document.elementFromPoint(barCenterX, barCenterY);
      if (el) {
        const laneEl2 = el.closest && el.closest("[data-lane-key]");
        if (laneEl2 && laneEl2.dataset && laneEl2.dataset.laneKey) {
          finalTargetLaneKey = laneEl2.dataset.laneKey;
        }
      }
    } catch (_) {}
    const movedLane = finalTargetLaneKey && finalTargetLaneKey !== sourceLaneKey;

    if (wasDragging && (movedTime || movedLane)) {
      const newH = Math.floor(drag.currentMinutes / 60);
      const newM = drag.currentMinutes % 60;
      const newDate = new Date(d);
      newDate.setHours(newH, newM, 0, 0);
      const newIso = newDate.toISOString();
      onDragCommit && onDragCommit({
        task,
        sourceLaneKey,
        targetLaneKey: finalTargetLaneKey,
        oldIso: scheduled,
        newIso,
        oldTime: baseTimeStr,
        newTime: `${pad(newH)}:${pad(newM)}`,
        newMinutes: drag.currentMinutes,
        durationMinutes: 60,
        siblings,
        laneName,
        onAcceptUI: () => setDrag(null),
        onCancelUI: () => setDrag(null),
      });
    } else {
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
      onClick={(e) => { console.log('[TaskBar BTN onClick fired]', task.id || task.taskCode, 'isLocked=', isLocked); e.preventDefault(); }}
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
        border: isCrossLaneDrag
          ? "2px solid #8B5CF6"           // cross-lane: 보라
          : isHighlighted
            ? "2px solid #FF1B8D"
            : `1px solid ${kindColor}`,
        borderLeft: isCrossLaneDrag
          ? "4px solid #8B5CF6"
          : isHighlighted
            ? "4px solid #FF1B8D"
            : `4px solid ${kindColor}`,
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
        zIndex: drag && drag.dragging ? 50 : (isHighlighted ? 8 : 1),
        boxShadow: isCrossLaneDrag
          ? "0 0 0 3px rgba(139, 92, 246, 0.35), 0 6px 18px rgba(0,0,0,0.4)"
          : isHighlighted
            ? "0 0 0 3px rgba(255, 27, 141, 0.35), 0 4px 14px rgba(255, 27, 141, 0.45)"
            : (drag && drag.dragging ? "0 4px 12px rgba(0,0,0,0.35)" : "none"),
        transform: drag && drag.dragging ? `translateY(${drag.deltaY}px)` : "none",
        transition: drag ? "none" : "left 0.15s ease, opacity 0.2s ease",
        touchAction: "none",
        // 2026-06-19 — drag 중 막대 hit-test 제외 → elementFromPoint(barCenter)
        //   가 막대 자체를 잡지 않고 아래 lane 시간 영역을 잡음.
        //   pointerCapture 는 별도라 막대 자체는 마우스 이벤트 계속 받음.
        pointerEvents: drag && drag.dragging ? "none" : "auto",
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

// ──────────────────────────────────────────────────────────────────
// 2026-06-19 — 검색창 + 드롭다운 (사장님 spec).
//   매칭: 고객명/주소/연락처/작업번호. 디바운스는 부모.
//   결과 형식: "M/D(요일) HH:MM · 고객 · 기사"
//   - 클릭 → 부모 onSelect (날짜 점프 + 강조 + 가로 스크롤).
//   - blur 시 드롭다운 닫음 (timeout 으로 클릭과 충돌 방지).
// ──────────────────────────────────────────────────────────────────
const KO_DOW = ["일", "월", "화", "수", "목", "금", "토"];

function SearchBox({ query, onQueryChange, results, showResults, setShowResults, onSelect }) {
  return (
    <div style={{
      position: "relative",
      flexShrink: 0,
      minWidth: 240,
    }}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        onBlur={() => {
          // 클릭과 충돌 방지 — blur 즉시 닫으면 onClick 발화 X.
          setTimeout(() => setShowResults(false), 180);
        }}
        placeholder="🔍 고객·주소·연락처·작업번호"
        style={{
          width: "100%",
          minHeight: 36,
          padding: "8px 12px",
          fontSize: 12,
          fontFamily: "inherit",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      {showResults && query.trim() !== "" && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          maxHeight: 360,
          overflowY: "auto",
          zIndex: 50,
        }}>
          {results.length === 0 ? (
            <div style={{
              padding: "12px 14px",
              fontSize: 12,
              color: "var(--text-secondary)",
              textAlign: "center",
            }}>검색 결과 없음</div>
          ) : (
            results.map((task, idx) => (
              <ResultRow
                key={task.id || task.taskCode || idx}
                task={task}
                onClick={() => onSelect(task)}
                isLast={idx === results.length - 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ task, onClick, isLast }) {
  const scheduled = task.scheduledAt || task.scheduled_at;
  const d = scheduled ? new Date(scheduled) : null;
  const validDate = d && !isNaN(d.getTime());
  const dateLabel = validDate
    ? `${d.getMonth() + 1}/${d.getDate()}(${KO_DOW[d.getDay()]})`
    : "—";
  const timeLabel = validDate ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
  const customer = task.customer || task.customerName || task.고객명 || "—";
  const engineer = task.assignedEngineer || task.engineer || "(미배정)";
  const isCanceled = task.status === "취소";
  const isDone = task.status === "완료" || task.status === "정산완료" || task.status === "visit_only";

  return (
    <button
      type="button"
      // pointerdown 으로 onClick 보다 먼저 잡아서 input blur 와 충돌 회피
      onPointerDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        width: "100%",
        padding: "9px 12px",
        background: "transparent",
        border: "none",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 12,
        color: "var(--text-primary)",
        opacity: isCanceled ? 0.55 : 1,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-bg)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: "var(--text-secondary)",
        whiteSpace: "nowrap",
        minWidth: 64,
        fontVariantNumeric: "tabular-nums",
      }}>{dateLabel}</span>
      <span style={{
        fontSize: 11, fontWeight: 800,
        color: "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
        minWidth: 42,
      }}>{timeLabel}</span>
      <span style={{ color: "var(--text-secondary)" }}>·</span>
      <span style={{
        flex: 1, minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontWeight: 700,
      }}>{customer}</span>
      <span style={{ color: "var(--text-secondary)" }}>·</span>
      <span style={{
        whiteSpace: "nowrap",
        color: "var(--text-secondary)",
        fontWeight: 600,
      }}>{engineer}</span>
      {(isCanceled || isDone) && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: "1px 6px",
          borderRadius: 4,
          background: isCanceled ? "rgba(160,160,170,0.15)" : "rgba(61,184,138,0.15)",
          color: isCanceled ? "#9CA3AF" : "#3DB88A",
          flexShrink: 0,
        }}>{isCanceled ? "취소" : "완료"}</span>
      )}
    </button>
  );
}

export default AdminPcTimelineScreen;
