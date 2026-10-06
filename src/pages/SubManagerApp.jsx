import { SubManagerSettleView, pendingStaffRemits } from "../components/SubSettlement.jsx";
// 2026-10-06 Mig 212~214, 220 — 협력사 관리자 화면 (v2).
//   방향: 별도 간이 화면을 키우지 않고 운영자 앱의 화면을 재사용한다.
//     · 작업 상세 = 운영자 AdminTaskDetailScreen 을 subMode 로 그대로 사용
//       (정산·견적 수정·취소 메뉴·협력사 넘기기 등 운영자 전용 카드는 subMode 가 숨김)
//     · 목록·배정·일정 변경 = 협력사 RPC (서버가 "자기 협력사 것" 인지 확인)
//   열어 주는 범위: 작업 목록 · 작업 상세 · 배정 · 일정 확정/변경 · 고객 통화.
//   숨기는 범위: 정산 · 가계부 · 원청 · 다른 협력사 · 사용자 권한 (메뉴 자체가 없음).
//   상태 흐름: 미배정 → 배정 → 확정(일정 확정) → 진행중 → 완료.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  subListTasks, subSetSchedule, subGetTaskDetail, subRejectTask,
  subListTaskMemos, subAddTaskMemo, subListTaskPhotos,
} from "../lib/subcontractorsDb.js";
import { v14NormalizeTask } from "../utils/v14Task.js";
import { AdminTaskDetailScreen } from "../components/AdminTaskDetailScreen.jsx";
import { RoleSwitcher } from "../components/RoleSwitcher.jsx";
import SubAssignSheet from "../components/SubAssignSheet.jsx";
import CategoryChip, { categoryBar } from "../components/CategoryChip.jsx";
import { subManagerListStaffRemits, subListDailySettlements } from "../lib/subcontractorsDb.js";
import { fmtWon as fmtWonMoney } from "../utils/money.js";
import { loadFontSize, applyFontSize } from "../utils/fontSize.js";
import BottomSheet, { SheetButtons } from "../components/BottomSheet.jsx";
import SubStaffManage from "../components/SubStaffManage.jsx";
import SafeTopCover from "../components/SafeTopCover.jsx";

const DONE = ["완료", "취소", "visit_only", "정산완료"];
const TABS = [
  { key: "todo",   label: "미배정" },
  { key: "assigned", label: "배정" },
  { key: "fixed",  label: "일정확정" },
  { key: "doing",  label: "진행" },
  { key: "done",   label: "완료" },
  { key: "cancel", label: "취소" },      // 0건이면 탭을 숨긴다
];
const STATUS_STYLE = {
  "미배정": { bg: "rgba(229,72,77,0.14)",  fg: "#E5484D" },
  "배정":   { bg: "rgba(245,158,11,0.16)", fg: "#D97706" },
  "확정":   { bg: "rgba(59,130,246,0.16)", fg: "#3B82F6" },
  "진행중": { bg: "rgba(255,27,141,0.16)", fg: "#FF1B8D" },
  "완료":   { bg: "rgba(16,185,129,0.16)", fg: "#059669" },
};

function fmtFilterDate(ymd) {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  const wd = d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))} (${wd})`;
}

function taskDay(t) {
  const iso = DONE.includes(t.status) ? (t.completed_at || t.scheduled_at) : t.scheduled_at;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }
  return t.requested_date || "";
}

function bucketOf(t) {
  if (t.status === "취소") return "cancel";        // 완료 탭에 섞이지 않게 따로
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

// 목록 RPC 의 줄(work_items / work_type)을 종목 판정이 읽는 꼴로
function catTask(t) {
  return { workItems: Array.isArray(t.work_items) ? t.work_items : [], workType: t.work_type, categoryId: t.category_id };
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
  const [view, setView] = useState("tasks");          // tasks(작업) | settle(정산)
  const [tab, setTab] = useState("todo");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(null);      // 담당 기사 지정 대상 { id, customer_name, assigned_engineer_id, ... }
  const [scheduling, setScheduling] = useState(null); // 일정 확정·변경 대상
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [detail, setDetail] = useState(null);         // 운영자 상세 화면에 넘길 정규화 task
  const [detailLoading, setDetailLoading] = useState(false);
  const [memos, setMemos] = useState([]);             // 상세 화면 메모 (RPC)
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoText, setMemoText] = useState("");
  // 2026-10-06 Mig 232 — 반려(사유 입력 → 올데이케어로 회수) + 목록 필터(날짜·기사)
  const [rejecting, setRejecting] = useState(null);
  const [rejectText, setRejectText] = useState("");
  const [fDate, setFDate] = useState("");             // YYYY-MM-DD (비우면 전체)
  const [fEng, setFEng] = useState("");               // 기사 id (비우면 전체)
  // 2026-10-06 — 화면 정리: 하단 탭 4개(작업·정산·기사·내 정보), "지금 할 일" 요약 띠, 기사 검색 시트
  const [engSheet, setEngSheet] = useState(false);
  const [settleFocus, setSettleFocus] = useState(0);   // 띠를 눌러 정산으로 갈 때마다 +1 → 확인 대기 상자로 스크롤
  const [engQuery, setEngQuery] = useState("");
  const [todo, setTodo] = useState({ waiting: 0, todayFee: 0 });   // 받음 확인 대기 건수 / 오늘 보낼 수수료
  const [fontSize, setFontSizeState] = useState(() => loadFontSize());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const tr = await subListTasks();
    if (!tr.ok) setError(tr.error || "작업을 불러오지 못했습니다.");
    else setTasks(Array.isArray(tr.tasks) ? tr.tasks : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // "지금 할 일" 요약 — 받음 확인 대기(기사가 보냈다고 보고했는데 아직 확인 안 한 줄), 오늘 보낼 수수료
  const loadTodo = useCallback(async () => {
    const [rm, ds] = await Promise.all([subManagerListStaffRemits(), subListDailySettlements()]);
    let waiting = 0, todayFee = 0;
    if (rm.ok) waiting = pendingStaffRemits(rm.staff).length;     // 정산 화면의 상자와 같은 함수 → 숫자가 항상 같다
    if (ds.ok) {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
      const row = (ds.days || []).find(d => d.date === today);
      if (row && !row.locked && Number(row.fee) > 0) todayFee = Number(row.fee);
    }
    setTodo({ waiting, todayFee });
  }, []);
  useEffect(() => { if (view === "tasks") loadTodo(); }, [view, loadTodo]);

  const groups = useMemo(() => {
    const g = { todo: [], assigned: [], fixed: [], doing: [], done: [], cancel: [] };
    for (const t of tasks) {
      if (fEng && t.assigned_engineer_id !== fEng) continue;
      if (fDate && taskDay(t) !== fDate) continue;
      g[bucketOf(t)].push(t);
    }
    const asc = (a, b) => String(a.sort_at || "").localeCompare(String(b.sort_at || ""));
    g.todo.sort(asc); g.assigned.sort(asc); g.fixed.sort(asc); g.doing.sort(asc);
    g.done.sort((a, b) => String(b.completed_at || "").localeCompare(String(a.completed_at || "")));
    g.cancel.sort((a, b) => String(b.sort_at || "").localeCompare(String(a.sort_at || "")));
    return g;
  }, [tasks, fDate, fEng]);

  // 기사 필터 선택지 — 지금 목록에 담당으로 나온 기사만
  const engOptions = useMemo(() => {
    const m = new Map();
    for (const t of tasks) if (t.assigned_engineer_id) m.set(t.assigned_engineer_id, t.engineer_name || "이름 없음");
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "ko"));
  }, [tasks]);

  const list = groups[tab] || [];

  // 상세 열기 — 서버가 소속을 확인하는 RPC(sub_get_task_detail, Mig 221)로 한 건을 읽어
  //   운영자 상세 화면에 넘긴다. 자기 협력사 작업이 아니면 서버가 내용을 주지 않는다.
  const openDetail = useCallback(async (taskId) => {
    setDetailLoading(true);
    try {
      const row = await subGetTaskDetail(taskId);
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

  // 상세가 열려 있는 동안 메모 목록 (서버가 소속 확인 — Mig 222)
  const detailId = detail ? detail.id : null;
  useEffect(() => {
    let alive = true;
    if (!detailId) { setMemos([]); return undefined; }
    subListTaskMemos(detailId).then(list => { if (alive) setMemos(list); });
    return () => { alive = false; };
  }, [detailId]);

  async function saveMemo() {
    if (busy || !detail) return;
    const text = memoText.trim();
    if (!text) { alert("메모 내용을 입력해 주세요."); return; }
    setBusy(true);
    const res = await subAddTaskMemo(detail.id, text);
    setBusy(false);
    if (!res.ok) { alert(res.error || "메모를 저장하지 못했습니다."); return; }
    setMemoOpen(false);
    setMemoText("");
    setMemos(await subListTaskMemos(detail.id));
  }

  const refreshAfterChange = useCallback(async (taskId) => {
    await load();
    if (detail && detail.id === taskId) {
      const row = await subGetTaskDetail(taskId);
      const norm = row ? v14NormalizeTask(row) : null;
      setDetail(norm && norm.subcontractorId === user?.subcontractor?.id ? norm : null);
    }
  }, [load, detail, user]);

  async function saveReject() {
    if (busy || !rejecting) return;
    if (!rejectText.trim()) { alert("반려 사유를 입력해 주세요."); return; }
    setBusy(true);
    const res = await subRejectTask(rejecting.id, rejectText.trim());
    setBusy(false);
    if (!res.ok) { alert(res.error || "반려하지 못했습니다."); return; }
    setRejecting(null);
    setDetail(null);
    load();
  }

  function openSchedule(target) {
    const cur = kstParts(target.scheduled_at || target.scheduledAt);
    setSchedDate(cur.date || target.requested_date || target.requestedDate || "");
    // 시간이 아직 없으면 오전 10시를 제안 (빈 상자로 보이지 않게). 저장 전 바꿀 수 있다.
    setSchedTime(cur.time || "10:00");
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
        <SubAssignSheet
          taskId={picking.id}
          mode="sub"
          subtitle={`${picking.customer_name || picking.customer || ""} · ${fmtWhen(picking)}`}
          onClose={() => setPicking(null)}
          onAssigned={() => { const id = picking.id; setPicking(null); refreshAfterChange(id); }}
        />
      )}
      {rejecting && (
        <BottomSheet
          onClose={() => { if (!busy) setRejecting(null); }}
          title="작업 반려"
          subtitle={`${rejecting.customer_name || rejecting.customer || ""} · 올데이케어로 되돌립니다. 담당 기사 배정도 해제됩니다.`}
          footer={<SheetButtons onCancel={() => setRejecting(null)} onOk={saveReject} okLabel="반려하기" busy={busy} danger/>}
        >
          <label style={fieldLabel}>반려 사유 (운영자에게 전달됩니다)</label>
          <div style={fieldWrap}>
            <textarea value={rejectText} onChange={e => setRejectText(e.target.value)} rows={3} maxLength={500}
              placeholder="예: 해당 지역 일정 불가 / 작업 범위 밖" style={{ ...fieldInput, minHeight: 88, resize: "vertical" }}/>
          </div>
        </BottomSheet>
      )}
      {scheduling && (
        <BottomSheet
          onClose={() => { if (!busy) setScheduling(null); }}
          title="일정 확정 · 변경"
          subtitle={scheduling.customer_name || scheduling.customer}
          footer={<SheetButtons onCancel={() => setScheduling(null)} onOk={saveSchedule} okLabel="일정 저장" busy={busy}/>}
        >
          <label style={fieldLabel}>날짜 선택</label>
          <div style={fieldWrap}>
            <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} style={fieldInput}/>
          </div>
          <label style={fieldLabel}>시간 선택{schedTime ? "" : " (아래에서 고르거나 직접 입력)"}</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map(tm => (
              <button key={tm} type="button" onClick={() => setSchedTime(tm)} style={{
                padding: "8px 10px", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                border: schedTime === tm ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)",
                background: schedTime === tm ? "var(--accent-bg, rgba(255,27,141,0.08))" : "var(--bg-elevated)",
                color: "var(--text-primary)",
              }}>{tm}</button>
            ))}
          </div>
          <div style={fieldWrap}>
            <input type="time" step={600} value={schedTime} onChange={e => setSchedTime(e.target.value)} style={fieldInput}/>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.5 }}>
            저장하면 상태가 "일정확정"으로 바뀝니다. 담당 기사가 먼저 배정돼 있어야 합니다.
          </div>
        </BottomSheet>
      )}
      {memoOpen && detail && (
        <BottomSheet
          onClose={() => { if (!busy) setMemoOpen(false); }}
          title="메모 추가"
          subtitle={`${detail.customer || ""} · 올데이케어 운영자도 함께 봅니다`}
          footer={<SheetButtons onCancel={() => setMemoOpen(false)} onOk={saveMemo} okLabel="메모 저장" busy={busy}/>}
        >
          <textarea
            value={memoText} onChange={e => setMemoText(e.target.value)} rows={4} autoFocus
            placeholder="현장 상황, 고객 통화 내용 등을 남겨 주세요"
            style={{ ...fieldInput, resize: "vertical", lineHeight: 1.5 }}
          />
        </BottomSheet>
      )}
    </>
  );

  // ── 작업 상세: 운영자 화면 재사용 (subMode) ──
  if (detail) {
    return (
      // 상단 여백: 휴대폰 상태표시줄(시계) 아래로 뒤로가기 줄이 깔리지 않게 (운영자·기사 앱은 바깥 틀이 같은 여백을 준다)
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "'Pretendard', sans-serif", paddingTop: "env(safe-area-inset-top, 0px)", boxSizing: "border-box" }}>
        <SafeTopCover background="var(--bg-secondary)"/>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <AdminTaskDetailScreen
            subMode
            task={detail}
            user={user}
            onBack={() => { setDetail(null); load(); }}
            onAssign={() => setPicking(detail)}
            onScheduleChange={() => openSchedule(detail)}
            fetchTask={subGetTaskDetail}
            externalMemos={memos}
            photoLoader={subListTaskPhotos}
            onMemoAdd={() => { setMemoText(""); setMemoOpen(true); }}
          />
        </div>
        {sheets}
      </div>
    );
  }

  // ── 탭 화면 (작업 · 정산 · 기사 · 내 정보) ──
  const NAV = [["tasks", "📋", "작업"], ["settle", "💰", "정산"], ["staff", "👷", "기사"], ["me", "👤", "내 정보"]];
  const viewTitle = view === "settle" ? "정산" : view === "staff" ? "기사" : view === "me" ? "내 정보" : "작업";
  const fEngName = fEng ? ((engOptions.find(([id]) => id === fEng) || [])[1] || "기사") : "";
  const todoItems = [
    groups.todo.length > 0 ? { key: "todo", label: `미배정 ${groups.todo.length}`, onClick: () => setTab("todo") } : null,
    // "보고됨"(올데이케어 송금 보고)과 헷갈리지 않게 "기사 송금 확인". 누르면 정산 탭의 그 상자로 간다.
    todo.waiting > 0 ? { key: "wait", label: `기사 송금 확인 ${todo.waiting}`, onClick: () => { setSettleFocus(n => n + 1); setView("settle"); } } : null,
    todo.todayFee > 0 ? { key: "fee", label: `오늘 보낼 수수료 ${fmtWonMoney(todo.todayFee)}`, onClick: () => setView("settle") } : null,
  ].filter(Boolean);

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "'Pretendard', sans-serif",
      paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)",     // 하단 탭에 가려지지 않게
    }}>
      {/* 시계·배터리 줄을 머리와 같은 불투명 색으로 덮는다 (4개 탭 공통) */}
      <SafeTopCover background="var(--bg-secondary)"/>
      {/* 머리: 회사명 + 이름 한 줄. 작업 탭에서만 단계 탭과 함께 고정한다. */}
      <div style={{
        position: view === "tasks" ? "sticky" : "relative", top: 0, zIndex: 5,
        background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
        padding: "calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {subName} <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>· {user?.name} 님 · {viewTitle}</span>
            </div>
            {onSwitchRole && <RoleSwitcher user={user} onSwitch={onSwitchRole}/>}
            {view === "tasks" && <button onClick={() => { load(); loadTodo(); }} disabled={loading} style={{ ...btnGhost, padding: "6px 10px" }}>{loading ? "…" : "새로고침"}</button>}
          </div>
          <div style={{ display: view === "tasks" ? "flex" : "none", gap: 6, marginTop: 8, overflowX: "auto" }}>
            {TABS.filter(tb => tb.key !== "cancel" || groups.cancel.length > 0 || tab === "cancel").map(tb => {
              const n = groups[tb.key].length;
              const on = tab === tb.key;
              return (
                <button key={tb.key} onClick={() => setTab(tb.key)} style={{
                  flex: "1 0 auto", padding: "8px 10px", borderRadius: 10, fontFamily: "inherit", cursor: "pointer",
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

      {view === "staff" && (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <SubStaffManage subName={subName}/>
        </div>
      )}
      {view === "settle" && (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <SubManagerSettleView focusRemits={settleFocus}/>
        </div>
      )}
      {view === "me" && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: 12 }}>
          <div style={meCard}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{user?.name || "—"}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{subName} · 관리자</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{user?.phone || ""}</div>
          </div>
          <div style={meCard}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>글자 크기</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["small", "작게"], ["medium", "기본"], ["large", "크게"]].map(([k, label]) => (
                <button key={k} onClick={() => { applyFontSize(k); setFontSizeState(k); }} style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, fontFamily: "inherit", cursor: "pointer", fontSize: 13, fontWeight: 800,
                  border: fontSize === k ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)",
                  background: fontSize === k ? "var(--accent-bg, rgba(255,27,141,0.08))" : "var(--bg-elevated)",
                  color: "var(--text-primary)",
                }}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{ ...meCard, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            기사 삭제 · 전화번호 변경 · 관리자 지정은 올데이케어 운영자에게 요청해 주세요.
          </div>
          <button onClick={onLogout} style={{ ...btnGhost, width: "100%", padding: "13px 0", color: "#E5484D" }}>로그아웃</button>
        </div>
      )}

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "10px 12px 0", display: view === "tasks" ? "block" : "none" }}>
        {error && (
          <div style={{ background: "rgba(229,72,77,0.12)", color: "#E5484D", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {/* "지금 할 일" 요약 띠 — 0건 항목은 숨긴다. 누르면 해당 단계 탭 / 정산 화면으로. */}
        {todoItems.length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10 }}>
            {todoItems.map(it => (
              <button key={it.key} onClick={it.onClick} style={{
                flexShrink: 0, padding: "8px 12px", borderRadius: 999, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
                fontSize: 12, fontWeight: 800, border: "1px solid rgba(229,72,77,0.4)", background: "rgba(229,72,77,0.10)", color: "#E5484D",
              }}>{it.label} ›</button>
            ))}
          </div>
        )}

        {/* 필터 줄 — 날짜 / 기사(검색 시트) */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8, marginBottom: (fDate || fEng) ? 4 : 10 }}>
          <label style={{ ...filterBox, position: "relative", borderColor: fDate ? "var(--accent, #FF1B8D)" : "var(--border)" }}>
            <span aria-hidden="true">📅</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fDate ? fmtFilterDate(fDate) : "날짜 전체"}
            </span>
            <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} aria-label="날짜 필터"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, border: "none", padding: 0, margin: 0, cursor: "pointer" }}/>
          </label>
          <button type="button" onClick={() => { setEngQuery(""); setEngSheet(true); }} aria-label="기사 필터"
            style={{ ...filterBox, width: "100%", textAlign: "left", borderColor: fEng ? "var(--accent, #FF1B8D)" : "var(--border)" }}>
            <span aria-hidden="true">👷</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fEng ? fEngName : "기사 전체"}</span>
          </button>
        </div>
        {(fDate || fEng) && (
          <div style={{ textAlign: "right", marginBottom: 8 }}>
            <button onClick={() => { setFDate(""); setFEng(""); }}
              style={{ background: "transparent", border: "none", padding: "4px 2px", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "inherit", cursor: "pointer", textDecoration: "underline" }}>
              필터 해제
            </button>
          </div>
        )}
        {!error && !loading && list.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 14, padding: "48px 0" }}>
            해당 상태의 작업이 없습니다.
          </div>
        )}

        {list.map((t, idx) => {
          const closed = DONE.includes(t.status);
          const cancelled = t.status === "취소";
          const hasEng = !!t.assigned_engineer_id;
          const st = hasEng || closed ? t.status : "미배정";
          const ss = STATUS_STYLE[st] || { bg: "var(--bg-secondary)", fg: "var(--text-secondary)" };
          const day = taskDay(t);
          const showHead = idx === 0 || taskDay(list[idx - 1]) !== day;
          const engDigits = String(t.engineer_phone || "").replace(/[^0-9]/g, "");
          return (
            <div key={t.id}>
              {/* 날짜가 바뀌는 곳에 묶음 머리 — 오늘 / 내일 / 10월 9일(금) */}
              {showHead && <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", margin: idx === 0 ? "2px 2px 8px" : "16px 2px 8px" }}>{dayHead(day)}</div>}
              <div style={{
                background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14,
                padding: 14, marginBottom: 10,
                ...categoryBar(catTask(t)),          // 종목 색 띠 (상태 배지와 겹치지 않게 띠·칩으로만)
                ...(cancelled ? { opacity: 0.6, filter: "grayscale(1)" } : {}),
              }}>
                <div onClick={() => openDetail(t.id)} style={{ cursor: "pointer" }}>
                  {/* ① 종목 칩 · 방문 시각 · 상태 배지 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CategoryChip task={catTask(t)} size="sm"/>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, color: "var(--accent, #FF1B8D)" }}>{timeText(t)}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: ss.bg, color: ss.fg, whiteSpace: "nowrap" }}>
                      {st === "확정" ? "일정확정" : st === "진행중" ? "진행" : st === "visit_only" ? "방문만" : st}
                    </span>
                  </div>
                  {/* ② 고객 · 동네(구·동) · 작업 항목 요약 */}
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8, lineHeight: 1.45 }}>
                    {t.customer_name}
                    <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{" · "}{townOf(t) || "주소 없음"}{" · "}{workLabel(t)}</span>
                  </div>
                </div>
                {/* ③ 담당 기사 + 전화 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, minHeight: 36 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: hasEng ? "var(--text-primary)" : "#E5484D" }}>
                    {hasEng ? `담당 ${t.engineer_name || ""}` : "담당 기사 미배정"}
                  </span>
                  {hasEng && engDigits && (
                    <a href={`tel:${engDigits}`} aria-label={`${t.engineer_name || "기사"} 전화`} title="기사 전화" style={{
                      width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, textDecoration: "none", flexShrink: 0,
                    }}>📞</a>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {t.phone && !cancelled && <a href={`tel:${t.phone}`} style={btnLink}>고객 통화</a>}
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
                {!closed && t.status !== "진행중" && (
                  <button onClick={() => { setRejectText(""); setRejecting(t); }}
                    style={{ background: "transparent", border: "none", padding: "10px 0 0", fontSize: 12, fontWeight: 700,
                             color: "var(--text-secondary)", fontFamily: "inherit", cursor: "pointer", textDecoration: "underline" }}>
                    올데이케어로 반려
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 기사 필터 — 검색 시트 (기사가 많아도 찾기 쉽게) */}
      {engSheet && (
        <BottomSheet
          onClose={() => setEngSheet(false)}
          title="기사 선택"
          header={(
            <input value={engQuery} onChange={e => setEngQuery(e.target.value)} placeholder="이름 검색"
              style={{ ...fieldInput, marginTop: 10 }}/>
          )}
          footer={<SheetButtons onCancel={() => setEngSheet(false)} cancelLabel="닫기"/>}
        >
          {[["", "기사 전체"], ...engOptions.filter(([, name]) => !engQuery.trim() || String(name).includes(engQuery.trim()))].map(([id, name]) => (
            <button key={id || "all"} type="button" onClick={() => { setFEng(id); setEngSheet(false); }} style={{
              display: "block", width: "100%", textAlign: "left", padding: "13px 12px", marginBottom: 6, borderRadius: 10,
              fontFamily: "inherit", cursor: "pointer", fontSize: 15, fontWeight: 700, color: "var(--text-primary)",
              border: fEng === id ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)",
              background: fEng === id ? "var(--accent-bg, rgba(255,27,141,0.08))" : "var(--bg-elevated)",
            }}>{name}</button>
          ))}
          {engOptions.length === 0 && <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "8px 2px" }}>아직 배정된 기사가 없습니다.</div>}
        </BottomSheet>
      )}

      {/* 하단 탭 — 기사 앱과 같은 자리·모양 */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: "var(--bg-primary)", borderTop: "1px solid var(--border)",
        padding: "6px 4px calc(env(safe-area-inset-bottom, 0px) + 10px)",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", justifyContent: "space-around" }}>
          {NAV.map(([k, icon, label]) => (
            <button key={k} onClick={() => setView(k)} style={{
              flex: 1, padding: "6px 4px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minHeight: 48,
              color: view === k ? "var(--accent, #FF1B8D)" : "var(--text-secondary)",
            }}>
              <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
              <span style={{ fontSize: 11, fontWeight: view === k ? 800 : 600 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
      {sheets}
    </div>
  );
}

const meCard = {
  background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 10,
};

// 카드 ① 줄의 방문 시각 — "14:00" / 시간이 없으면 "시간 미정" (날짜는 묶음 머리가 보여 준다)
function timeText(t) {
  const iso = t.scheduled_at || t.scheduledAt;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d.toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
  }
  return t.requested_time ? `희망 ${t.requested_time}` : "시간 미정";
}

// 묶음 머리 — 오늘 / 내일 / 10월 9일(금) / 날짜 미정
function dayHead(ymd) {
  if (!ymd) return "날짜 미정";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const d = new Date(`${ymd}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  const wd = d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });
  const label = `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일(${wd})`;
  if (ymd === today) return `오늘 · ${label}`;
  if (ymd === tomorrow) return `내일 · ${label}`;
  return label;
}

// 고객 동네 — 구·동까지만 (상세 주소는 작업 상세에서)
function townOf(t) {
  const tokens = String(t.address || "").trim().split(/\s+/).filter(Boolean);
  const gi = tokens.findIndex(x => /(구|군|시)$/.test(x) && !/(특별시|광역시|특별자치시)$/.test(x));
  // 시 다음에 구가 또 오는 주소(수원시 영통구 …)는 더 안쪽 구를 쓴다
  let i = gi;
  if (i >= 0 && /시$/.test(tokens[i]) && tokens[i + 1] && /(구|군)$/.test(tokens[i + 1])) i += 1;
  const gu = i >= 0 ? tokens[i] : (t.district || "");
  const dong = i >= 0 && tokens[i + 1] && /(동|읍|면|가|리)$/.test(tokens[i + 1]) ? tokens[i + 1] : "";
  return [gu, dong].filter(Boolean).join(" ");
}

const filterBox = {
  display: "flex", alignItems: "center", gap: 6, boxSizing: "border-box", minWidth: 0, height: 44,
  padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg-elevated)", color: "var(--text-primary)",
  fontSize: 16, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
};
const fieldLabel = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", margin: "10px 0 6px" };
const fieldWrap = { width: "100%", maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" };
const fieldInput = {
  display: "block", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box",
  padding: "12px 12px", borderRadius: 10, minHeight: 48,
  border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
  fontSize: 16, fontFamily: "inherit",
  WebkitAppearance: "none", appearance: "none",
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
