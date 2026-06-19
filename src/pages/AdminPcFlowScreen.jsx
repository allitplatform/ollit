// 2026-06-12 — AdminApp PC 🅑 처리 흐름 (1024px+ 전용).
//   작업별 한 줄 + 5단계 점 (접수 → 배정 → 확정 → 진행 → 완료).
//
// 2026-06-19 개선 (사장님 spec):
//   1) 5단계 점을 모든 행 고정 위치(균등 5칸 grid)에 배치. 상단 라벨 헤더 1줄 고정.
//      · 진행 완료 단계: 초록 점 + 선 / 현재 단계: 파랑 점(크게) / 미진행: 회색 점 + 선
//      · 완료 도달: 초록 점 외곽 링 강조
//   2) 좌 영역에 작업 종류·수량 추가 — "지역 · 기사 · 벽걸이 ×1" / 여러 개면 "벽걸이 외 2"
//   3) 레이아웃: [이름·지역·기사·기종수량] [5단계 타임라인] [시각 우측 정렬]
//
// 데이터/로직 변경 0줄. 행 클릭 → 우 aside (🅐 패턴 재사용).

import { useState, useMemo, Fragment } from "react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";
import { getServiceKind } from "../utils/workTypeKind.js";
import { AdminPcDateNav, shiftDate } from "./AdminPcDateNav.jsx";

const STEPS = [
  { id: "received",  label: "접수" },
  { id: "assigned",  label: "배정" },
  { id: "confirmed", label: "확정" },
  { id: "started",   label: "진행" },
  { id: "completed", label: "완료" },
];

// 도달 단계 index — status 기반.
function getReachedIdx(status) {
  switch (status) {
    case "미배정":      return 0;
    case "배정":
    case "약속대기":    return 1;
    case "확정":        return 2;
    case "진행중":      return 3;
    case "완료":
    case "정산완료":
    case "visit_only":  return 4;
    default:            return -1;
  }
}

// 색 — 사장님 spec.
const COLOR_REACHED  = "#3DB88A";              // 도달 — 초록
const COLOR_CURRENT  = "#3B82F6";              // 현재 — 파랑
const COLOR_PENDING  = "var(--border-strong)"; // 미진행 — 회색
const COLOR_CANCELED = "#A0A0AA";

const KIND_ICON = {
  cleaning:    "❄",
  refrigerant: "⚡",
};
const KIND_ICON_COLOR = {
  cleaning:    "#0EA5E9",
  refrigerant: "#FFB800",
};

// 그리드 컬럼 — 헤더와 행이 같은 비율 (5단계 위치 균등).
const GRID_COLS = "minmax(280px, 1.3fr) minmax(320px, 2fr) minmax(160px, auto)";

function pad(n) { return String(n).padStart(2, "0"); }
function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 품목 요약 — task.workItems → "벽걸이 ×1" / 여러 개면 "벽걸이 외 N".
//   취소된 행(is_canceled) 제외. category_data.appliance + qty fallback 지원.
function getItemSummary(task) {
  const items = Array.isArray(task.workItems) ? task.workItems : [];
  const live = items.filter(it => !(it.isCanceled ?? it.is_canceled));
  if (live.length > 0) {
    const first = live[0];
    const label = first.appliance || first.applianceLabel || first.workType || "";
    const qty   = Number(first.qty) || 1;
    if (!label) return "";
    const more = live.length - 1;
    if (more > 0) return `${label} 외 ${more}`;
    return `${label} ×${qty}`;
  }
  const cd = task.categoryData || task.category_data || {};
  if (cd.appliance && cd.qty) return `${cd.appliance} ×${cd.qty}`;
  return "";
}

export function AdminPcFlowScreen({ apiTasks = [], apiEngineers = [], onTaskClick }) {
  const [selectedDate, setSelectedDate] = useState(() => todayYmd());

  const today = todayYmd();
  const isToday = selectedDate === today;

  const dateTasks = useMemo(() => {
    return (apiTasks || []).filter(t => {
      if (!t) return false;
      const scheduled = t.scheduledAt || t.scheduled_at;
      if (!scheduled) return false;
      return toKstYmd(scheduled) === selectedDate;
    });
  }, [apiTasks, selectedDate]);

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
          }}>처리 흐름</div>
          <AdminPcDateNav
            selectedDate={selectedDate}
            onPrev={() => setSelectedDate(d => shiftDate(d, -1))}
            onNext={() => setSelectedDate(d => shiftDate(d, 1))}
            onToday={() => setSelectedDate(today)}
            isToday={isToday}
          />
          <span style={{
            fontSize: 12, color: "var(--text-secondary)", fontWeight: 600,
          }}>{dateTasks.length}건</span>
        </div>
      </div>

      {dateTasks.length === 0 ? (
        <EmptyBox/>
      ) : (
        <div style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
        }}>
          <FlowHeader/>
          {dateTasks.map(task => (
            <TaskFlowRow
              key={task.id || task.taskCode}
              task={task}
              apiEngineers={apiEngineers}
              onClick={() => onTaskClick?.(task)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyBox() {
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

// ──────────────────────────────────────────────────────────────────
// 상단 단계 라벨 헤더 — 1줄 고정. 행과 같은 grid 컬럼 사용해
// 5단계 위치 정확히 일치.
// ──────────────────────────────────────────────────────────────────
function FlowHeader() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: GRID_COLS,
      gap: 16,
      padding: "10px 18px",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg-secondary, var(--bg-elevated))",
      fontSize: 10, fontWeight: 700,
      color: "var(--text-secondary)",
      letterSpacing: 0.5,
    }}>
      <div>작업</div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        textAlign: "center",
      }}>
        {STEPS.map(s => (
          <div key={s.id}>{s.label}</div>
        ))}
      </div>
      <div style={{ textAlign: "right" }}>시각</div>
    </div>
  );
}

function TaskFlowRow({ task, apiEngineers, onClick }) {
  const kind     = getServiceKind(task);
  const customer = task.customer || task.고객명 || "—";
  const region   = task.region || task.district || task.지역 || "";
  const engId    = task.assignedEngineerId || task.assigned_engineer_id;
  const engObj   = engId ? (apiEngineers || []).find(e => e.id === engId) : null;
  const engineer = engObj?.name || task.assignedEngineer || task.engineer || "미배정";
  const status   = task.status || "";
  const itemSummary = getItemSummary(task);

  const isCanceled = status === "취소";
  const isVisitFeeCanceled = isCanceled && task.cancelEngineerCompKind === "visit_fee";
  const visitFeeAmount     = Number(task.cancelEngineerCompAmount || 0);
  const reachedIdx = getReachedIdx(status);

  const receivedAt  = formatTime(task.createdAt || task.receivedAt);
  const startedAt   = formatTime(task.startedAt);
  const completedAt = formatTime(task.completedAt);

  return (
    <div onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: GRID_COLS,
        gap: 16,
        padding: "14px 18px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        alignItems: "center",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-bg)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {/* 좌 — 작업 정보 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 800, color: "var(--text-primary)",
        }}>
          <span style={{
            fontSize: 14,
            color: KIND_ICON_COLOR[kind] || "var(--text-secondary)",
          }}>{KIND_ICON[kind] || "•"}</span>
          <span style={{
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            textDecoration: isCanceled && !isVisitFeeCanceled ? "line-through" : "none",
            opacity: isCanceled && !isVisitFeeCanceled ? 0.7 : 1,
          }}>{customer}</span>
          {isCanceled && !isVisitFeeCanceled && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: COLOR_CANCELED,
              padding: "1px 6px",
              border: `1px solid ${COLOR_CANCELED}`,
              borderRadius: 4,
            }}>취소</span>
          )}
          {isVisitFeeCanceled && (
            <span style={{
              fontSize: 10, fontWeight: 800,
              color: COLOR_CANCELED,
              padding: "1px 7px",
              background: "var(--bg-inset, var(--bg-elevated))",
              border: `1px solid ${COLOR_CANCELED}`,
              borderRadius: 4,
              fontVariantNumeric: "tabular-nums",
            }}>출장비 ₩{visitFeeAmount.toLocaleString("ko-KR")}</span>
          )}
        </div>
        <span style={{
          fontSize: 11, color: "var(--text-secondary)", fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {region}
          {region && engineer ? " · " : ""}{engineer}
          {(region || engineer) && itemSummary ? " · " : ""}{itemSummary}
        </span>
      </div>

      {/* 중 — 5단계 점 (균등 5칸 grid) */}
      <StepsRow reachedIdx={reachedIdx} isCanceled={isCanceled}/>

      {/* 우 — 시각 (우측 정렬 통일) */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "flex-end",
        gap: 2,
        fontSize: 10, color: "var(--text-secondary)", fontWeight: 600,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}>
        {receivedAt && (
          <span><span style={{ opacity: 0.7 }}>접수</span> {receivedAt}</span>
        )}
        {startedAt && (
          <span><span style={{ opacity: 0.7 }}>시작</span> {startedAt}</span>
        )}
        {completedAt && (
          <span><span style={{ opacity: 0.7 }}>완료</span> {completedAt}</span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 5단계 — repeat(5, 1fr) 균등 grid. 각 칸에 점 + 좌/우 선.
//   · 도달(i<reachedIdx): 좌선·우선·점 모두 초록
//   · 현재(i===reachedIdx, 완료 외): 점 파랑 + 외곽 hover-ring(크게)
//   · 완료 도달(i===4 && reachedIdx===4): 초록 점 + 초록 외곽 링 강조
//   · 미진행(i>reachedIdx): 회색
//   · 취소: 전부 회색
// ──────────────────────────────────────────────────────────────────
function StepsRow({ reachedIdx, isCanceled }) {
  const reachedCompleted = reachedIdx === 4 && !isCanceled;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      alignItems: "center",
      height: 24,
      position: "relative",
    }}>
      {STEPS.map((step, i) => {
        const isReachedPast    = i < reachedIdx && !isCanceled;
        const isReachedCurrent = i === reachedIdx && !isCanceled;
        const isCompletedStep  = i === 4 && reachedCompleted;

        // 점 색
        const dotColor = isCanceled
          ? COLOR_CANCELED
          : isCompletedStep
            ? COLOR_REACHED                   // 완료 도달 — 초록
            : isReachedCurrent
              ? COLOR_CURRENT                 // 현재 단계 — 파랑
              : isReachedPast
                ? COLOR_REACHED               // 지난 — 초록
                : COLOR_PENDING;              // 미진행 — 회색

        // 선 색 — 좌/우 별도 (이전 단계가 도달이면 좌선 초록, 다음 단계가 도달이면 우선 초록)
        const leftLineReached  = i > 0 && !isCanceled && i <= reachedIdx;
        const rightLineReached = i < STEPS.length - 1 && !isCanceled && i < reachedIdx;

        return (
          <Fragment key={step.id}>
            <Cell
              dotColor={dotColor}
              isCurrent={isReachedCurrent && !isCompletedStep}
              isCompleted={isCompletedStep}
              showLeftLine={i > 0}
              showRightLine={i < STEPS.length - 1}
              leftLineColor={leftLineReached ? COLOR_REACHED : COLOR_PENDING}
              rightLineColor={rightLineReached ? COLOR_REACHED : COLOR_PENDING}
              isCanceled={isCanceled}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

function Cell({ dotColor, isCurrent, isCompleted, showLeftLine, showRightLine,
                 leftLineColor, rightLineColor, isCanceled }) {
  const lineOpacity = isCanceled ? 0.4 : 1;
  const dotSize = isCurrent ? 14 : 10;
  return (
    <div style={{
      position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100%",
    }}>
      {/* 좌선 */}
      {showLeftLine && (
        <div style={{
          position: "absolute",
          left: 0, right: "50%",
          top: "50%", transform: "translateY(-50%)",
          height: 2,
          background: leftLineColor,
          opacity: lineOpacity,
        }}/>
      )}
      {/* 우선 */}
      {showRightLine && (
        <div style={{
          position: "absolute",
          left: "50%", right: 0,
          top: "50%", transform: "translateY(-50%)",
          height: 2,
          background: rightLineColor,
          opacity: lineOpacity,
        }}/>
      )}
      {/* 점 (선 위) */}
      <div style={{
        position: "relative",
        width: 22, height: 22,
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1,
      }}>
        {/* 현재 단계 — hover-ring (반투명 파랑) */}
        {isCurrent && (
          <div style={{
            position: "absolute",
            width: 22, height: 22,
            borderRadius: "50%",
            background: `${dotColor}33`,
          }}/>
        )}
        {/* 완료 도달 — 외곽 링 강조 (초록) */}
        {isCompleted && (
          <div style={{
            position: "absolute",
            width: 20, height: 20,
            borderRadius: "50%",
            border: `2px solid ${dotColor}`,
            background: "transparent",
          }}/>
        )}
        <div style={{
          width: dotSize, height: dotSize,
          borderRadius: "50%",
          background: dotColor,
          position: "relative",
          zIndex: 1,
        }}/>
      </div>
    </div>
  );
}

export default AdminPcFlowScreen;
