// 2026-06-12 — AdminApp PC 대시보드 (1024px+).
//   PC 전용 설계 — 모바일 압축 사고 X, 펼침형.
//   1단계 (이번): 매출 + 미배정 작업 목록 + 메트릭 5개.
//   다음 단계: 유솔N 펼침 / 기사별 일정 / 전체 작업 검색.
//   ⚠️ 배정/정산/접수 로직 안 건드림. dynamicStats / apiTasks 그대로 재사용.
//   ⚠️ 색 토큰만 사용 (var(--accent) 다크 #FF1B8D / 라이트 #E91860).

// 2026-06-12 — PC 매출 패널 — 도넛 + 회사 마진 강조 + 세척/냉매 (사장님 spec).
//   모바일 옛 RevenueOverviewBlock(막대)은 그대로, PC만 새 패널.
import { AdminPcRevenuePanel } from "./AdminPcRevenuePanel.jsx";

export function AdminPcDashboard({
  t,
  apiTasks = [],
  user,
  dynamicStats,
  onClickRevenueDetail,
  onClickNewReception,
  onClickAssignedList,
  onClickInProgress,
  onClickLiveWork,
  onTaskAssign,
}) {
  const stats = dynamicStats || {};
  const unassignedTasks = stats.newReceptionTasks || [];

  // 메트릭 5개 — 새접수 / 배정 / 확정 / 진행 / 완료.
  //   클릭 시 옛 라우팅 재사용 (= setScreen 호출).
  const metrics = [
    { id: "new",        label: "새 접수", count: stats.new        || 0, onClick: () => onClickNewReception?.() },
    { id: "assigned",   label: "배정",   count: stats.assigned   || 0, onClick: () => onClickAssignedList?.() },
    { id: "confirmed",  label: "확정",   count: stats.confirmed  || 0, onClick: () => onClickAssignedList?.("confirmed") },
    { id: "inProgress", label: "진행",   count: stats.inProgress || 0, onClick: () => onClickInProgress?.() },
    { id: "completed",  label: "완료",   count: stats.completed  || 0, onClick: () => onClickLiveWork?.("completed-today") },
  ];

  return (
    <div style={{
      padding: "20px 24px 32px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      {/* 상단 2단 — 좌: 매출(큰칸) / 우: 미배정 목록 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
        gap: 16,
        alignItems: "start",
      }}>
        <AdminPcRevenuePanel
          t={t}
          apiTasks={apiTasks}
          user={user}
          onDetailClick={onClickRevenueDetail}
        />
        <UnassignedPanel
          t={t}
          tasks={unassignedTasks}
          onTaskAssign={onTaskAssign}
          onClickViewAll={onClickNewReception}
        />
      </div>

      {/* 메트릭 5개 한줄 */}
      <MetricsRow metrics={metrics}/>

      {/* 다음 단계 — 유솔N / 기사 일정 / 전체 작업 검색 */}
      <div style={{
        padding: "18px 20px",
        background: "var(--bg-elevated)",
        border: "1px dashed var(--border)",
        borderRadius: 12,
        color: "var(--text-secondary)",
        fontSize: 12, fontWeight: 600,
        textAlign: "center",
      }}>
        🚧 다음 단계 — 유솔N 펼침 / 기사별 일정 / 전체 작업 검색
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 미배정 작업 패널 — 우상.
//   숫자만 X, 작업 행이 바로 보이게. 행 클릭 → 배정 화면 (recommend).
// ──────────────────────────────────────────────────────────────────
function UnassignedPanel({ t, tasks = [], onTaskAssign, onClickViewAll }) {
  // 표시 한도 — 너무 길면 답답. 10건 + "전체 N건 보기" 링크.
  const VISIBLE_LIMIT = 10;
  const visible = tasks.slice(0, VISIBLE_LIMIT);
  const hidden  = Math.max(0, tasks.length - VISIBLE_LIMIT);

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "14px 14px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      minHeight: 0,
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
          📥 미배정 작업
          <span style={{
            marginLeft: 6,
            fontSize: 14, color: "var(--accent)", fontWeight: 800,
          }}>{tasks.length}</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>건</span>
        </div>
        {hidden > 0 && (
          <button onClick={onClickViewAll} style={{
            padding: "4px 10px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 999,
            color: "var(--text-secondary)",
            fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>전체 {tasks.length}건 →</button>
        )}
      </div>

      {/* 본문 */}
      {tasks.length === 0 ? (
        <div style={{
          padding: "40px 20px",
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: 12, fontWeight: 600,
        }}>🎉 미배정 작업 없음 — 깨끗합니다</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {visible.map(task => (
            <UnassignedRow key={task.id} task={task} onAssign={() => onTaskAssign?.(task)}/>
          ))}
        </div>
      )}
    </div>
  );
}

function UnassignedRow({ task, onAssign }) {
  const customer  = task.customer || task.고객명 || "—";
  const region    = task.region || task.지역 || "—";
  const workType  = task.workType
                 || task.appliance
                 || (Array.isArray(task.workItems) && task.workItems[0]?.workType)
                 || "—";
  const principal = task.principalLabel || task.principal || task.principalCode || "—";
  const schedule  = task.schedule
                 || (task.scheduleType === "tbd" ? "협의" : "—");

  return (
    <button onClick={onAssign} style={{
      display: "grid",
      gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr) minmax(0,0.9fr) minmax(0,1fr) minmax(0,0.9fr) auto",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      background: "var(--bg-primary)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      cursor: "pointer",
      fontFamily: "inherit",
      textAlign: "left",
      color: "var(--text-primary)",
      transition: "border-color 0.1s, background 0.1s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer}</span>
      <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{region}</span>
      <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workType}</span>
      <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{principal}</span>
      <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{schedule}</span>
      <span style={{
        fontSize: 11, fontWeight: 800,
        color: "var(--accent)",
        whiteSpace: "nowrap",
      }}>배정 →</span>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// 메트릭 5개 한줄 — 새접수 / 배정 / 확정 / 진행 / 완료.
//   클릭 → 옛 setScreen 호출 (해당 목록 화면).
// ──────────────────────────────────────────────────────────────────
function MetricsRow({ metrics }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
      gap: 12,
    }}>
      {metrics.map(m => (
        <button key={m.id} onClick={m.onClick} style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "16px 18px",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          transition: "border-color 0.1s, transform 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--text-secondary)",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}>{m.label}</span>
          <span className="mono" style={{
            fontSize: 30, fontWeight: 800,
            color: m.count > 0 ? "var(--accent)" : "var(--text-primary)",
            letterSpacing: "-1px",
            lineHeight: 1,
          }}>{m.count}</span>
        </button>
      ))}
    </div>
  );
}

export default AdminPcDashboard;
