// 2026-06-12 — AdminApp PC 작업 타임라인 (1024px+ 전용, 🅐 시간축).
//   기사별 행 × 시간 격자 (07~19시, % 균등 분배). 가로 스크롤 없음.
//   ⚠️ 처리 흐름은 별도 화면 (AdminPcFlowScreen) — 사이드바 항목 분리 (렉 해소).
//   ⚠️ 데이터/로직 0줄 변경. apiTasks / apiEngineers / 공통 상태색 / 종류색.
//   ⚠️ 막대 클릭 → 우 aside (Shell PC 분기 main 유지).

import { useState, useMemo, useEffect } from "react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";
import { getTaskStatusColor } from "../utils/taskStatusColor.js";
import { getServiceKind } from "../utils/workTypeKind.js";
import { AdminPcDateNav, shiftDate } from "./AdminPcDateNav.jsx";

const START_HOUR    = 7;
const END_HOUR      = 20;
const TOTAL_HOURS   = END_HOUR - START_HOUR;
const LANE_HEIGHT   = 52;
const ENGINEER_COL  = 120;

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

export function AdminPcTimelineScreen({ apiTasks = [], apiEngineers = [], onTaskClick }) {
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
        showNowLine={showNowLine}
        nowPct={nowPct}
        nowLabel={nowLabel}
      />
    </div>
  );
}

function TimeAxisView({ lanes, onTaskClick, showNowLine, nowPct, nowLabel }) {
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
      overflow: "hidden",
      position: "relative",   // 2026-06-19 — now line absolute wrapper
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `${ENGINEER_COL}px 1fr`,
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
          <Lane key={lane.key} lane={lane} onTaskClick={onTaskClick}/>
        ))}
      </div>

      {/* 2026-06-19 — 현재 시각 표시선 (KST). 시간 영역만 덮음 (기사 컬럼 right). */}
      {showNowLine && (
        <div style={{
          position: "absolute",
          top: 0, bottom: 0,
          left: `calc(${ENGINEER_COL}px + (100% - ${ENGINEER_COL}px) * ${nowPct / 100})`,
          width: 0,
          pointerEvents: "none",
          zIndex: 5,
        }}>
          {/* 세로선 */}
          <div style={{
            position: "absolute",
            top: 34,                 // 시간 헤더(34) 아래부터
            bottom: 0,
            left: -1,
            width: 2,
            background: "#FF1B8D",
            boxShadow: "0 0 6px rgba(255, 27, 141, 0.45)",
          }}/>
          {/* 상단 라벨 — 시간 헤더 위로 살짝 겹쳐 */}
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

function Lane({ lane, onTaskClick }) {
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

      <div style={{
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

  const hoursOffset = (hours - START_HOUR) + minutes / 60;
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
  const opacity = isDone ? 0.5 : 1;

  const customer = task.customer || task.고객명 || "—";
  const region   = task.region || task.district || task.지역 || "";
  const statusStyle = getTaskStatusColor(task.status);
  const time = `${pad(hours)}:${pad(minutes)}`;
  const title = `${time} · ${customer}${region ? " · " + region : ""} · ${kind === "refrigerant" ? "냉매" : kind === "cleaning" ? "세척" : ""} · ${task.status || ""}`;

  return (
    <button onClick={onClick} title={title}
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
        cursor: "pointer",
        padding: "4px 8px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflow: "hidden",
        textAlign: "left",
        boxSizing: "border-box",
        opacity,
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
        {region && (
          <span style={{
            fontSize: 9, fontWeight: 600,
            color: textCol,
            opacity: 0.8,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            lineHeight: 1.1,
          }}>{region}</span>
        )}
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
