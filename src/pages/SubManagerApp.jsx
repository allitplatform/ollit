// 2026-10-06 Mig 212~214, 220 — 협력사 관리자 화면 (v2).
//   방향: 별도 간이 화면을 키우지 않고 운영자 앱의 화면을 재사용한다.
//     · 작업 상세 = 운영자 AdminTaskDetailScreen 을 subMode 로 그대로 사용
//       (정산·견적 수정·취소 메뉴·협력사 넘기기 등 운영자 전용 카드는 subMode 가 숨김)
//     · 목록·배정·일정 변경 = 협력사 RPC (서버가 "자기 협력사 것" 인지 확인)
//   열어 주는 범위: 작업 목록 · 작업 상세 · 배정 · 일정 확정/변경 · 고객 통화.
//   숨기는 범위: 정산 · 가계부 · 원청 · 다른 협력사 · 사용자 권한 (메뉴 자체가 없음).
//   상태 흐름: 미배정 → 배정 → 확정(일정 확정) → 진행중 → 완료.
import { useCallback, useEffect, useMemo, useState } from "react";
import { subListTasks, subListStaff, subAssignTask, subSetSchedule } from "../lib/subcontractorsDb.js";
import { getTaskForListById } from "../data/tasksDb.js";
import { v14NormalizeTask } from "../utils/v14Task.js";
import { AdminTaskDetailScreen } from "../components/AdminTaskDetailScreen.jsx";
import { RoleSwitcher } from "../components/RoleSwitcher.jsx";

const DONE = ["완료", "취소", "visit_only", "정산완료"];
const TABS = [
  { key: "todo",   label: "미배정" },
  { key: "assigned", label: "배정" },
  { key: "fixed",  label: "일정확정" },
  { key: "doing",  label: "진행" },
  { key: "done",   label: "완료" },
];
const STATUS_STYLE = {
  "미배정": { bg: "rgba(229,72,77,0.14)",  fg: "#E5484D" },
  "배정":   { bg: "rgba(245,158,11,0.16)", fg: "#D97706" },
  "확정":   { bg: "rgba(59,130,246,0.16)", fg: "#3B82F6" },
  "진행중": { bg: "rgba(255,27,141,0.16)", fg: "#FF1B8D" },
  "완료":   { bg: "rgba(16,185,129,0.16)", fg: "#059669" },
};

function bucketOf(t) {
  if (DONE.includes(t.status)) return "done";
  if (t.status === "진행중") return "doing";
  if (!t.assigned_engineer_id) return "todo";
  if (t.status === "확정") return "fixed";
  return "assigned";
}

function fmtWhen(t) {
  // 목록(RPC, snake_case)과 상세(정규화, camelCase) 양쪽 형태를 모두 받는다.
  const sched = t.scheduled_at || t.scheduledAt;
  if (sched) {
    const d = new Date(sched);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short",
        hour: "2-digit", minute: "2-digit", hour12: false,
      });
    }
  }
  const parts = [t.requested_date || t.requestedDate, t.requested_time || t.requestedTime].filter(Boolean);
  return parts.length ? `희망 ${parts.join(" ")}` : "일정 미정";
}

function workLabel(t) {
  const items = Array.isArray(t.work_items) ? t.work_items : [];
  const names = items
    .map(i => [i.workType, i.appliance && i.appliance !== "(공통)" ? i.appliance : ""].filter(Boolean).join(" ")
      + (Number(i.qty) > 1 ? ` ×${i.qty}` : ""))
    .filter(Boolean);
  return names.join(", ") || t.work_type || "작업";
}

// KST 기준 date/time 입력값 → ISO (+09:00)
function toIsoKst(date, time) {
  if (!date) return null;
  return `${date}T${time || "09:00"}:00+09:00`;
}
function kstParts(iso) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  const date = d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

export default function SubManagerApp({ user, onLogout, onSwitchRole }) {
  const [tab, setTab] = useState("todo");
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(null);      // 담당 기사 지정 대상 { id, customer_name, assigned_engineer_id, ... }
  const [scheduling, setScheduling] = useState(null); // 일정 확정·변경 대상
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [detail, setDetail] = useState(null);         // 운영자 상세 화면에 넘길 정규화 task
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [tr, sr] = await Promise.all([subListTasks(), subListStaff()]);
    if (!tr.ok) setError(tr.error || "작업을 불러오지 못했습니다.");
    else setTasks(Array.isArray(tr.tasks) ? tr.tasks : []);
    if (sr.ok) setStaff(Array.isArray(sr.staff) ? sr.staff : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const g = { todo: [], assigned: [], fixed: [], doing: [], done: [] };
    for (const t of tasks) g[bucketOf(t)].push(t);
    const asc = (a, b) => String(a.sort_at || "").localeCompare(String(b.sort_at || ""));
    g.todo.sort(asc); g.assigned.sort(asc); g.fixed.sort(asc); g.doing.sort(asc);
    g.done.sort((a, b) => String(b.completed_at || "").localeCompare(String(a.completed_at || "")));
    return g;
  }, [tasks]);

  const list = groups[tab] || [];

  // 상세 열기 — 목록(RPC)에 있는 자기 협력사 작업의 id 로 전체 내용을 읽어 운영자 상세 화면에 넘긴다.
  const openDetail = useCallback(async (taskId) => {
    setDetailLoading(true);
    try {
      const row = await getTaskForListById(taskId);
      const norm = row ? v14NormalizeTask(row) : null;
      // 방어: 목록에 없는 작업이거나 수행처가 다르면 열지 않는다.
      if (!norm || !norm.subcontractorId || norm.subcontractorId !== user?.subcontractor?.id) {
        alert("작업을 열 수 없습니다.");
      } else {
        setDetail(norm);
      }
    } finally {
      setDetailLoading(false);
    }
  }, [user]);

  const refreshAfterChange = useCallback(async (taskId) => {
    await load();
    if (detail && detail.id === taskId) {
      const row = await getTaskForListById(taskId);
      const norm = row ? v14NormalizeTask(row) : null;
      setDetail(norm && norm.subcontractorId === user?.subcontractor?.id ? norm : null);
    }
  }, [load, detail, user]);

  async function assign(target, engineerId) {
    if (busy) return;
    setBusy(true);
    const res = await subAssignTask(target.id, engineerId);
    setBusy(false);
    if (!res.ok) { alert(res.error || "배정에 실패했습니다."); return; }
    setPicking(null);
    refreshAfterChange(target.id);
  }

  function openSchedule(target) {
    const cur = kstParts(target.scheduled_at || target.scheduledAt);
    setSchedDate(cur.date || target.requested_date || target.requestedDate || "");
    setSchedTime(cur.time || "");
    setScheduling(target);
  }

  async function saveSchedule() {
    if (busy || !scheduling) return;
    if (!schedDate || !schedTime) { alert("날짜와 시간을 모두 정해 주세요."); return; }
    setBusy(true);
    const res = await subSetSchedule(scheduling.id, toIsoKst(schedDate, schedTime));
    setBusy(false);
    if (!res.ok) { alert(res.error || "일정을 저장하지 못했습니다."); return; }
    const id = scheduling.id;
    setScheduling(null);
    refreshAfterChange(id);
  }

  const subName = user?.subcontractor?.name || "협력사";

  // ── 공용 시트 (담당 기사 지정 / 일정) — 목록과 상세 양쪽에서 뜬다 ──
  const sheets = (
    <>
      {picking && (
        <Sheet onClose={() => { if (!busy) setPicking(null); }}>
          <div style={sheetTitle}>담당 기사 지정</div>
          <div style={sheetSub}>{picking.customer_name || picking.customer} · {fmtWhen(picking)}</div>
          {staff.length === 0 && <div style={{ ...sheetSub, padding: "18px 0" }}>등록된 기사가 없습니다.</div>}
          {staff.map(s => {
            const zones = Array.isArray(s.zones) ? s.zones : [];
            const zoneText = s.region || (zones.length > 4 ? `${zones.slice(0, 4).join("·")} 외 ${zones.length - 4}` : zones.join("·"));
            const on = (picking.assigned_engineer_id || picking.assignedEngineerId) === s.id;
            return (
              <button key={s.id} disabled={busy} onClick={() => assign(picking, s.id)} style={{
                display: "block", width: "100%", textAlign: "left",
                background: on ? "var(--accent-bg, rgba(255,27,141,0.08))" : "var(--bg-elevated)",
                border: on ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)",
                borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                color: "var(--text-primary)", fontFamily: "inherit", cursor: "pointer",
              }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>
                  {s.name}{s.sub_role === "manager" ? " (관리자)" : ""}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  오늘 일정 {s.today_tasks || 0}건 · 진행 {s.in_progress || 0}건{zoneText ? ` · ${zoneText}` : ""}
                </div>
              </button>
            );
          })}
          {(picking.assigned_engineer_id || picking.assignedEngineerId) && (
            <button disabled={busy} onClick={() => assign(picking, null)} style={{ ...btnGhost, width: "100%", color: "#E5484D" }}>
              배정 해제 (미배정으로)
            </button>
          )}
          <button disabled={busy} onClick={() => setPicking(null)} style={{ ...btnGhost, width: "100%", marginTop: 8 }}>닫기</button>
        </Sheet>
      )}
      {scheduling && (
        <Sheet onClose={() => { if (!busy) setScheduling(null); }}>
          <div style={sheetTitle}>일정 확정 · 변경</div>
          <div style={sheetSub}>{scheduling.customer_name || scheduling.customer}</div>
          <label style={fieldLabel}>날짜</label>
          <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} style={fieldInput}/>
          <label style={fieldLabel}>시간</label>
          <input type="time" step={600} value={schedTime} onChange={e => setSchedTime(e.target.value)} style={fieldInput}/>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.5 }}>
            저장하면 상태가 "일정확정"으로 바뀝니다. 담당 기사가 먼저 배정돼 있어야 합니다.
          </div>
          <button disabled={busy} onClick={saveSchedule} style={{ ...btnMain, width: "100%", marginTop: 14 }}>
            {busy ? "저장 중…" : "일정 저장"}
          </button>
          <button disabled={busy} onClick={() => setScheduling(null)} style={{ ...btnGhost, width: "100%", marginTop: 8 }}>닫기</button>
        </Sheet>
      )}
    </>
  );

  // ── 작업 상세: 운영자 화면 재사용 (subMode) ──
  if (detail) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "'Pretendard', sans-serif" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <AdminTaskDetailScreen
            subMode
            task={detail}
            user={user}
            onBack={() => { setDetail(null); load(); }}
            onAssign={() => setPicking(detail)}
            onScheduleChange={() => openSchedule(detail)}
          />
        </div>
        {sheets}
      </div>
    );
  }

  // ── 작업 목록 ──
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "'Pretendard', sans-serif", paddingBottom: 40 }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 5, background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
        padding: "calc(env(safe-area-inset-top, 0px) + 12px) 14px 10px",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{subName}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{user?.name} 님 · 작업 관리</div>
            </div>
            {onSwitchRole && <RoleSwitcher user={user} onSwitch={onSwitchRole}/>}
            <button onClick={load} disabled={loading} style={btnGhost}>{loading ? "…" : "새로고침"}</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto" }}>
            {TABS.map(tb => {
              const n = groups[tb.key].length;
              const on = tab === tb.key;
              return (
                <button key={tb.key} onClick={() => setTab(tb.key)} style={{
                  flex: "1 0 auto", padding: "9px 10px", borderRadius: 10, fontFamily: "inherit", cursor: "pointer",
                  border: on ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)",
                  background: on ? "var(--accent-bg, rgba(255,27,141,0.08))" : "var(--bg-elevated)",
                  color: "var(--text-primary)", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap",
                }}>
                  {tb.label}{" "}
                  <span style={{ color: tb.key === "todo" && n > 0 ? "#E5484D" : "var(--text-secondary)" }}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 12px 0" }}>
        {error && (
          <div style={{ background: "rgba(229,72,77,0.12)", color: "#E5484D", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        {!error && !loading && list.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 14, padding: "48px 0" }}>
            해당 상태의 작업이 없습니다.
          </div>
        )}

        {list.map(t => {
          const closed = DONE.includes(t.status);
          const hasEng = !!t.assigned_engineer_id;
          const st = hasEng || closed ? t.status : "미배정";
          const ss = STATUS_STYLE[st] || { bg: "var(--bg-secondary)", fg: "var(--text-secondary)" };
          return (
            <div key={t.id} style={{
              background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14,
              padding: 14, marginBottom: 10,
            }}>
              <div onClick={() => openDetail(t.id)} style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: ss.bg, color: ss.fg, whiteSpace: "nowrap" }}>
                    {st === "확정" ? "일정확정" : st === "진행중" ? "진행" : st === "visit_only" ? "방문만" : st}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.customer_name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t.task_no}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent, #FF1B8D)", marginTop: 8 }}>{fmtWhen(t)}</div>
                <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>{t.address || t.district || "주소 없음"}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  {workLabel(t)}{hasEng ? ` · 담당 ${t.engineer_name || ""}` : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {t.phone && <a href={`tel:${t.phone}`} style={btnLink}>고객 통화</a>}
                {!closed && t.status !== "진행중" && (
                  <button onClick={() => setPicking(t)} style={hasEng ? btnLinkBtn : btnMain}>
                    {hasEng ? "기사 변경" : "배정"}
                  </button>
                )}
                {!closed && t.status !== "진행중" && hasEng && (
                  <button onClick={() => openSchedule(t)} style={t.status === "확정" ? btnLinkBtn : btnMain}>
                    {t.status === "확정" ? "일정 변경" : "일정 확정"}
                  </button>
                )}
                <button onClick={() => openDetail(t.id)} disabled={detailLoading} style={btnLinkBtn}>상세</button>
              </div>
            </div>
          );
        })}

        <button onClick={onLogout} style={{ ...btnGhost, width: "100%", marginTop: 16, padding: "12px 0" }}>로그아웃</button>
      </div>
      {sheets}
    </div>
  );
}

function Sheet({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-secondary)", color: "var(--text-primary)", width: "100%", maxWidth: 560, maxHeight: "82vh", overflowY: "auto",
        borderRadius: "18px 18px 0 0", padding: "18px 16px calc(env(safe-area-inset-bottom, 0px) + 18px)",
      }}>
        {children}
      </div>
    </div>
  );
}

const sheetTitle = { fontSize: 17, fontWeight: 800 };
const sheetSub   = { fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 14px" };
const fieldLabel = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", margin: "10px 0 6px" };
const fieldInput = {
  width: "100%", boxSizing: "border-box", padding: "12px 12px", borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
  fontSize: 16, fontFamily: "inherit",
};
const btnMain = {
  flex: 1, background: "var(--accent, #FF1B8D)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 12px",
  fontSize: 13, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", textAlign: "center",
};
const btnGhost = {
  background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px",
  fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};
const btnLinkBtn = {
  flex: 1, background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 10,
  padding: "10px 12px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", textAlign: "center",
};
const btnLink = { ...btnLinkBtn, textDecoration: "none", display: "block" };
