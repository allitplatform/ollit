// 2026-06-12 — AdminApp PC 🅑 처리 흐름 (1024px+ 전용).
//   작업별 한 줄 + 5단계 점 (접수 → 배정 → 확정 → 진행 → 완료).
//   처리된 단계까지 초록, 현재 단계 상태색 강조, 안 된 단계 회색.
//   시각: 접수(createdAt) / 진행(startedAt) / 완료(completedAt) — 배정·확정은 DB 시각 없어 점만.
//   ⚠️ 데이터/로직 0줄 변경. 행 클릭 → 우 aside (🅐 패턴 재사용).
//   ⚠️ 사이드바 별도 항목 (pcTimelineFlow). 옛 화면 안 토글 폐기 → 렉 해소.

import { useState, useMemo, Fragment } from "react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";
import { getServiceKind } from "../utils/workTypeKind.js";
import { AdminPcDateNav, shiftDate } from "./AdminPcDateNav.jsx";

const STEPS = [
  { id: "received",  label: "접수", timeField: "createdAt" },
  { id: "assigned",  label: "배정", timeField: null },
  { id: "confirmed", label: "확정", timeField: null },
  { id: "started",   label: "진행", timeField: "startedAt" },
  { id: "completed", label: "완료", timeField: "completedAt" },
];

// 도달 단계 index — status 기반 (audit log 시각 없어 단순화).
function getReachedIdx(status) {
  switch (status) {
    case "미배정":            return 0;
    case "배정":
    case "약속대기":          return 1;
    case "확정":              return 2;
    case "진행중":            return 3;
    case "완료":
    case "정산완료":
    case "visit_only":        return 4;
    default:                  return -1;  // 취소 / 기타
  }
}

// 현재 단계 강조색 (옛 taskStatusColor 매핑 동일).
const STEP_CURRENT_COLOR = ["#FF6FA8", "#3DC6D0", "#5A95F0", "#E8A23D", "#3DB88A"];
const COLOR_REACHED  = "#3DB88A";   // 도달 (현재 X) — 초록
const COLOR_PENDING  = "var(--border-strong)";  // 안 됨 — 회색
const COLOR_CANCELED = "#A0A0AA";

const KIND_ICON = {
  cleaning:    "❄",
  refrigerant: "⚡",
};

function pad(n) { return String(n).padStart(2, "0"); }
function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminPcFlowScreen({ apiTasks = [], apiEngineers = [], onTaskClick }) {
  const [selectedDate, setSelectedDate] = useState(() => todayYmd());

  const today = todayYmd();
  const isToday = selectedDate === today;

  // 그 날짜 작업 — scheduledAt 기준 (🅐와 동일 filter, 취소 포함).
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

function TaskFlowRow({ task, apiEngineers, onClick }) {
  const kind     = getServiceKind(task);
  const customer = task.customer || task.고객명 || "—";
  const region   = task.region || task.district || task.지역 || "";
  // 기사 이름 — apiEngineers 매칭 시 우선, 아니면 task 필드.
  const engId    = task.assignedEngineerId || task.assigned_engineer_id;
  const engObj   = engId ? (apiEngineers || []).find(e => e.id === engId) : null;
  const engineer = engObj?.name || task.assignedEngineer || task.engineer || "미배정";
  const status   = task.status || "";

  const isCanceled = status === "취소";
  const reachedIdx = getReachedIdx(status);

  const receivedAt  = formatTime(task.createdAt || task.receivedAt);
  const startedAt   = formatTime(task.startedAt);
  const completedAt = formatTime(task.completedAt);

  return (
    <div onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(220px, 1.2fr) minmax(320px, 2fr) auto",
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
          <span style={{ fontSize: 14 }}>{KIND_ICON[kind] || "•"}</span>
          <span style={{
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{customer}</span>
          {isCanceled && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: COLOR_CANCELED,
              padding: "1px 6px",
              border: `1px solid ${COLOR_CANCELED}`,
              borderRadius: 4,
            }}>취소</span>
          )}
        </div>
        <span style={{
          fontSize: 11, color: "var(--text-secondary)", fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {region}{region && engineer ? " · " : ""}{engineer}
        </span>
      </div>

      {/* 중 — 5단계 점 */}
      <StepsRow reachedIdx={reachedIdx} isCanceled={isCanceled}/>

      {/* 우 — 시각 (있는 것만) */}
      <div style={{
        display: "flex", gap: 10,
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

function StepsRow({ reachedIdx, isCanceled }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start",
      gap: 0,
    }}>
      {STEPS.map((step, i) => {
        const reached   = i <= reachedIdx && !isCanceled;
        const isCurrent = i === reachedIdx && !isCanceled;
        const color = isCanceled
          ? COLOR_CANCELED
          : isCurrent ? STEP_CURRENT_COLOR[i]
          : reached    ? COLOR_REACHED
          : COLOR_PENDING;
        const lineColor = isCanceled
          ? COLOR_CANCELED
          : (i < reachedIdx) ? COLOR_REACHED
          : COLOR_PENDING;
        return (
          <Fragment key={step.id}>
            <Dot color={color} isCurrent={isCurrent} label={step.label}/>
            {i < STEPS.length - 1 && (
              <Line color={lineColor} isCanceled={isCanceled}/>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function Dot({ color, isCurrent, label }) {
  const inner = isCurrent ? 14 : 10;
  const ring = isCurrent ? 20 : 0;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      position: "relative",
      width: 56,
      flexShrink: 0,
    }}>
      <div style={{
        position: "relative",
        width: 20, height: 20,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {isCurrent && (
          <div style={{
            position: "absolute",
            width: ring, height: ring,
            borderRadius: "50%",
            background: `${color}33`,
          }}/>
        )}
        <div style={{
          width: inner, height: inner,
          borderRadius: "50%",
          background: color,
          position: "relative",
          zIndex: 1,
        }}/>
      </div>
      <span style={{
        fontSize: 10, color: "var(--text-secondary)", fontWeight: 700,
      }}>{label}</span>
    </div>
  );
}

function Line({ color, isCanceled }) {
  return (
    <div style={{
      flex: 1,
      height: 2,
      background: color,
      opacity: isCanceled ? 0.4 : 1,
      marginTop: 9,  // 점(20) 중앙 정렬
      minWidth: 16,
    }}/>
  );
}

export default AdminPcFlowScreen;
