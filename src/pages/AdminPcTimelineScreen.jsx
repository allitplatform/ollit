// 2026-06-12 — AdminApp PC 작업 타임라인 (1024px+ 전용).
//   🅐 시간축 (기사별 행 × 시간 격자, 작업 막대) — 이번 단계.
//   🅑 처리 흐름 — 다음 단계 (placeholder).
//   ⚠️ 데이터/로직 0줄 변경. apiTasks / apiEngineers / 공통 상태색 매핑 재사용.
//   ⚠️ 막대 클릭 → onTaskClick → openTaskDetailFromLight → 우 aside (Chunk 2 패턴).
//   ⚠️ 모바일(<1024) 옛 화면 그대로 — 사이드바 메뉴는 PC 셸에서만 노출.

import { useState, useMemo } from "react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";
import { getTaskStatusColor } from "../utils/taskStatusColor.js";
// 2026-06-12 — 작업 종류 (세척/냉매) 색 매핑 — 막대 배경. 상태색은 테두리로 보조.
import { getServiceKind } from "../utils/workTypeKind.js";

// 시간 축 — 07~19시 (13 슬롯). 슬롯 폭 키워 막대 정보 (고객명/지역) 표시.
const START_HOUR    = 7;
const END_HOUR      = 20;
const TOTAL_HOURS   = END_HOUR - START_HOUR;
const SLOT_WIDTH    = 90;
const TIMELINE_W    = TOTAL_HOURS * SLOT_WIDTH;
const LANE_HEIGHT   = 62;
const ENGINEER_COL  = 130;

// 작업 종류 색 (사장님 spec).
const KIND_COLOR = {
  cleaning:    "#0EA5E9",  // 세척 — 파랑
  refrigerant: "#FFB800",  // 냉매 — 노랑
};
const KIND_COLOR_FALLBACK = "#9CA3AF";  // 기타/방문 등

// 종류 라벨 (막대 안 작은 텍스트).
const KIND_LABEL = {
  cleaning:    "❄ 세척",
  refrigerant: "⚡ 냉매",
  visit:       "🚗 방문",
};

export function AdminPcTimelineScreen({ apiTasks = [], apiEngineers = [], onTaskClick }) {
  const [view, setView] = useState("time"); // "time" | "flow"

  const today = todayYmd();

  // 오늘 작업 — scheduledAt 기준 + 취소 제외.
  const todayTasks = useMemo(() => {
    return (apiTasks || []).filter(t => {
      if (!t || t.status === "취소") return false;
      const scheduled = t.scheduledAt || t.scheduled_at;
      if (!scheduled) return false;
      return toKstYmd(scheduled) === today;
    });
  }, [apiTasks, today]);

  // 기사별 그룹 + 정렬 (작업 수 많은 순, 동률 이름순).
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

  return (
    <div style={{
      padding: "20px 24px 32px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      {/* 헤더 + 탭 토글 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{
          fontSize: 18, fontWeight: 800,
          color: "var(--text-primary)",
          letterSpacing: "-0.4px",
        }}>
          작업 타임라인 · {formatDateKo(today)}
          <span style={{
            marginLeft: 10,
            fontSize: 12, color: "var(--text-secondary)", fontWeight: 600,
          }}>{lanes.length}명 · {todayTasks.length}건</span>
        </div>
        <ViewToggle value={view} onChange={setView}/>
      </div>

      {view === "time" ? (
        <TimeAxisView lanes={lanes} onTaskClick={onTaskClick}/>
      ) : (
        <FlowPlaceholder/>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 헤더 — 날짜 표시 + view 토글.
// ──────────────────────────────────────────────────────────────────
function formatDateKo(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function ViewToggle({ value, onChange }) {
  const tabs = [
    { id: "time", label: "🅐 시간축" },
    { id: "flow", label: "🅑 처리 흐름" },
  ];
  return (
    <div style={{
      display: "flex",
      gap: 2,
      background: "var(--bg-elevated)",
      padding: 4,
      borderRadius: 999,
      border: "1px solid var(--border)",
    }}>
      {tabs.map(tab => {
        const active = value === tab.id;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            style={{
              padding: "7px 16px",
              background: active ? "var(--accent)" : "transparent",
              border: "none",
              borderRadius: 999,
              color: active ? "#fff" : "var(--text-secondary)",
              fontSize: 12, fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}>{tab.label}</button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 🅐 시간축 — 기사별 행 × 시간 격자, 막대.
// ──────────────────────────────────────────────────────────────────
function TimeAxisView({ lanes, onTaskClick }) {
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
      }}>오늘 예정 작업 없음</div>
    );
  }

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      overflow: "auto",  // 가로 + 세로 scroll
      maxHeight: 560,  // 휑함 줄임 (옛 640 → 560)
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `${ENGINEER_COL}px ${TIMELINE_W}px`,
        minWidth: ENGINEER_COL + TIMELINE_W,
      }}>
        {/* 헤더 좌 — 기사 라벨 */}
        <div style={{
          padding: "10px 14px",
          background: "var(--bg-elevated)",
          borderRight: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          position: "sticky", left: 0, top: 0, zIndex: 4,
          fontSize: 11, fontWeight: 700,
          color: "var(--text-secondary)",
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}>기사</div>

        {/* 헤더 우 — 시간 슬롯 */}
        <div style={{
          position: "sticky", top: 0, zIndex: 3,
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          height: 38,
        }}>
          {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
            const hour = START_HOUR + i;
            return (
              <div key={hour} style={{
                width: SLOT_WIDTH,
                borderRight: "1px solid var(--border)",
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

        {/* 행들 */}
        {lanes.map(lane => (
          <Lane key={lane.key} lane={lane} onTaskClick={onTaskClick}/>
        ))}
      </div>
    </div>
  );
}

function Lane({ lane, onTaskClick }) {
  return (
    <>
      {/* 좌측 — 기사명 + 건수 (sticky) */}
      <div style={{
        padding: "10px 14px",
        borderRight: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        position: "sticky", left: 0, zIndex: 1,
        background: "var(--bg-elevated)",
        fontSize: 12, fontWeight: 700, color: "var(--text-primary)",
        display: "flex", alignItems: "center", gap: 6,
        minHeight: LANE_HEIGHT,
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

      {/* 우측 — 타임라인 (격자 + 막대) */}
      <div style={{
        position: "relative",
        borderBottom: "1px solid var(--border)",
        minHeight: LANE_HEIGHT,
        background: "var(--bg-primary)",
      }}>
        {/* 시간 격자 (세로 line) */}
        {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: i * SLOT_WIDTH,
            top: 0, bottom: 0,
            width: 1,
            background: "var(--border)",
            opacity: 0.5,
          }}/>
        ))}
        {/* 작업 막대 */}
        {lane.tasks.map(task => (
          <TaskBar
            key={task.id || task.taskCode}
            task={task}
            onClick={() => onTaskClick?.(task)}
          />
        ))}
      </div>
    </>
  );
}

function TaskBar({ task, onClick }) {
  const scheduled = task.scheduledAt || task.scheduled_at;
  if (!scheduled) return null;
  const d = new Date(scheduled);
  if (isNaN(d.getTime())) return null;
  const hours   = d.getHours();
  const minutes = d.getMinutes();

  // 막대 위치/폭 — 시작 시각 기준 1시간 가정 (작업 종료시각 데이터 없음).
  let leftPos = (hours - START_HOUR) * SLOT_WIDTH + (minutes / 60) * SLOT_WIDTH;
  let width   = SLOT_WIDTH;
  if (leftPos < 0) {
    width += leftPos;
    leftPos = 0;
  }
  if (leftPos + width > TIMELINE_W) width = TIMELINE_W - leftPos;
  if (width <= 0) return null;

  // 색: 배경=작업 종류 (세척 파랑 / 냉매 노랑), 테두리=상태 (확정 파랑 / 진행 주황 / 완료 초록).
  const kind = getServiceKind(task);
  const kindColor = KIND_COLOR[kind] || KIND_COLOR_FALLBACK;
  const statusStyle = getTaskStatusColor(task.status);

  // 완료/취소 시 막대 흐리게 (작업 끝난 표시).
  const isDone = task.status === "완료" || task.status === "정산완료" || task.status === "visit_only";
  const opacity = isDone ? 0.55 : 1;

  const customer = task.customer || task.고객명 || "—";
  const region   = task.region || task.district || task.지역 || "";
  const kindLabel = KIND_LABEL[kind] || "";
  const time = `${pad(hours)}:${pad(minutes)}`;
  const title = `${time} · ${customer} · ${region} · ${kindLabel || (task.workType || "")} · ${task.status || ""}`;

  return (
    <button onClick={onClick} title={title}
      style={{
        position: "absolute",
        left: leftPos + 1,
        top: 5,
        height: LANE_HEIGHT - 10,
        width: width - 2,
        background: `${kindColor}33`,         // 종류 색 (≈20% alpha)
        border: `2px solid ${statusStyle.color}`,
        borderLeft: `4px solid ${kindColor}`, // 종류 표시 강조 — 좌측 굵은 바
        borderRadius: 6,
        color: "var(--text-primary)",
        fontFamily: "inherit",
        cursor: "pointer",
        padding: "4px 8px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 2,
        overflow: "hidden",
        textAlign: "left",
        boxSizing: "border-box",
        opacity,
      }}>
      <span style={{
        fontSize: 12, fontWeight: 800,
        color: "var(--text-primary)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        lineHeight: 1.1,
      }}>{customer}</span>
      <span style={{
        fontSize: 10, fontWeight: 600,
        color: kindColor,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        lineHeight: 1.1,
      }}>{time}{region ? " · " + region : ""}{kindLabel ? " · " + kindLabel : ""}</span>
    </button>
  );
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// ──────────────────────────────────────────────────────────────────
// 🅑 처리 흐름 — 다음 단계 placeholder.
// ──────────────────────────────────────────────────────────────────
function FlowPlaceholder() {
  return (
    <div style={{
      padding: "60px 40px",
      textAlign: "center",
      background: "var(--bg-elevated)",
      border: "1px dashed var(--border)",
      borderRadius: 14,
      color: "var(--text-secondary)",
      fontSize: 13, fontWeight: 600,
    }}>
      🚧 🅑 처리 흐름 — 다음 단계 예정 (5단계 점 · 도달 색 · 시각은 접수/시작/완료만)
    </div>
  );
}

export default AdminPcTimelineScreen;
