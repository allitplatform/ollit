// 2026-06-12 — AdminApp PC 작업 타임라인 (1024px+ 전용).
//   🅐 시간축 (기사별 행 × 시간 격자) — 화면 폭에 맞춤, 가로 스크롤 없음.
//   🅑 처리 흐름 — 다음 단계 placeholder.
//   ⚠️ 데이터/로직 0줄 변경. apiTasks / apiEngineers / 공통 상태색 / 종류색.
//   ⚠️ 막대 클릭 → 우 aside (Shell PC 분기 main 유지).
//   ⚠️ 모바일(<1024) 옛 화면 그대로.

import { useState, useMemo } from "react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";
import { getTaskStatusColor } from "../utils/taskStatusColor.js";
import { getServiceKind } from "../utils/workTypeKind.js";

// 시간 축 — 07~19시 (13 슬롯, % 균등 분배).
const START_HOUR    = 7;
const END_HOUR      = 20;
const TOTAL_HOURS   = END_HOUR - START_HOUR;
const LANE_HEIGHT   = 52;
const ENGINEER_COL  = 120;

// 작업 종류 색 (사장님 spec — 더 쨍한 파랑/노랑).
const KIND_COLOR = {
  cleaning:    "#38BDF8",  // sky-400 (옛 0EA5E9 cyan-500 보다 밝음)
  refrigerant: "#FACC15",  // yellow-400 (옛 FFB800 보다 환한 노랑)
};
const KIND_COLOR_FALLBACK = "#9CA3AF";

export function AdminPcTimelineScreen({ apiTasks = [], apiEngineers = [], onTaskClick }) {
  const [view, setView] = useState("time");
  // 2026-06-12 — 날짜 네비 (사장님 spec). 기본 오늘 + ‹ 이전 / 다음 › / 오늘 버튼.
  const [selectedDate, setSelectedDate] = useState(() => todayYmd());

  const today    = todayYmd();
  const isToday  = selectedDate === today;

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
      display: "flex",
      flexDirection: "column",
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
          }}>작업 타임라인</div>
          <DateNav
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

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateKo(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}/${d} (${WEEKDAYS[dt.getDay()]})`;
}

function shiftDate(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// ──────────────────────────────────────────────────────────────────
// 날짜 네비 — ‹ 이전 / [날짜] / 다음 › + (선택 ≠ 오늘 시) "오늘" 버튼.
// ──────────────────────────────────────────────────────────────────
function DateNav({ selectedDate, onPrev, onNext, onToday, isToday }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 2,
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 999,
      padding: 3,
    }}>
      <NavBtn onClick={onPrev} aria="이전 날짜">‹</NavBtn>
      <span style={{
        padding: "4px 10px",
        fontSize: 13, fontWeight: 700,
        color: isToday ? "var(--accent)" : "var(--text-primary)",
        minWidth: 90, textAlign: "center",
        fontVariantNumeric: "tabular-nums",
      }}>{formatDateKo(selectedDate)}</span>
      <NavBtn onClick={onNext} aria="다음 날짜">›</NavBtn>
      {!isToday && (
        <button onClick={onToday}
          style={{
            marginLeft: 4,
            padding: "4px 11px",
            background: "var(--accent)",
            border: "none",
            borderRadius: 999,
            color: "#fff",
            fontSize: 11, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
          }}>오늘</button>
      )}
    </div>
  );
}

function NavBtn({ onClick, children, aria }) {
  return (
    <button onClick={onClick} aria-label={aria}
      style={{
        width: 26, height: 26, padding: 0,
        background: "transparent",
        border: "none",
        color: "var(--text-secondary)",
        fontSize: 18, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
        borderRadius: 999,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>{children}</button>
  );
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
// 🅐 시간축 — 화면 폭에 맞춤 (1fr + 슬롯 flex:1). 가로 스크롤 없음.
//   세로도 기사 수만큼만 — maxHeight 없음.
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
      }}>예정 작업 없음</div>
    );
  }

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      overflow: "hidden",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `${ENGINEER_COL}px 1fr`,
      }}>
        {/* 헤더 좌 — 기사 라벨 */}
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

        {/* 헤더 우 — 시간 슬롯 (flex:1 균등 분배) */}
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
      {/* 좌측 — 기사명 + 건수 */}
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

      {/* 우측 — 타임라인 (격자 + 막대) */}
      <div style={{
        position: "relative",
        borderBottom: "1px solid var(--border)",
        minHeight: LANE_HEIGHT,
        background: "var(--bg-primary)",
      }}>
        {/* 시간 격자 — % 위치 */}
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

  // 위치/폭 = % (화면 폭에 비례). 시작 시각 기준 1시간 가정.
  const hoursOffset = (hours - START_HOUR) + minutes / 60;
  let leftPct  = (hoursOffset / TOTAL_HOURS) * 100;
  let widthPct = (1 / TOTAL_HOURS) * 100;

  if (leftPct < 0) {
    widthPct += leftPct;
    leftPct = 0;
  }
  if (leftPct + widthPct > 100) widthPct = 100 - leftPct;
  if (widthPct <= 0) return null;

  // 색: 종류 단일 (세척 파랑 / 냉매 노랑). 테두리=종류색 약하게. 좌측 4px 굵은 바.
  const kind = getServiceKind(task);
  const kindColor = KIND_COLOR[kind] || KIND_COLOR_FALLBACK;

  // 완료 / visit_only / 정산완료 → 흐림 (작업 끝난 표시).
  const isDone = task.status === "완료" || task.status === "정산완료" || task.status === "visit_only";
  const opacity = isDone ? 0.5 : 1;

  const customer = task.customer || task.고객명 || "—";
  const region   = task.region || task.district || task.지역 || "";
  // tooltip — 상세 정보 (시각·지역·상태 등). 막대 폭 좁아도 호버로 확인.
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
        background: `${kindColor}E6`,            // 90% alpha — 종류색 거의 단색 (밝게)
        border: `1px solid ${kindColor}`,         // 종류색 테두리 (얇게)
        borderLeft: `4px solid ${kindColor}`,     // 좌측 굵은 종류 바
        borderRadius: 5,
        color: "var(--text-primary)",
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
          color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.1,
        }}>{customer}</span>
        {region && (
          <span style={{
            fontSize: 9, fontWeight: 600,
            color: "var(--text-primary)",
            opacity: 0.75,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            lineHeight: 1.1,
          }}>{region}</span>
        )}
      </div>
      {/* 상태 hint — 우측 작은 점 (색만) */}
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
