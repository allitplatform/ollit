// 2026-10-06 Mig 238 — 협력사 관리자 PC 화면 (폭 1024px 이상): 타임라인 · 전체 작업 검색.
//   운영자 PC 화면의 배치(기사별 가로 타임라인 / 필터 한 줄 + 표)를 따르되, 데이터는 전부
//   협력사 RPC(sub_query_tasks · sub_list_staff — 세션 확인 + 자기 협력사 작업만)에서 읽는다.
//   운영자 RPC·운영자 화면 구성요소는 쓰지 않는다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TimelineDatePicker } from "./TimelineDatePicker.jsx";
import { subQueryTasks, subListStaff, subListTasks, subListStaffForTask, subAssignTask, subSetSchedule, subListStaffOffs } from "../lib/subcontractorsDb.js";
import { getCategoryMeta, categoriesInTasks, getTaskDurationHours, categoryTint } from "../lib/serviceCatalog.js";
import CategoryChip from "./CategoryChip.jsx";
import { fmtWon } from "../utils/money.js";
import { catTask, workLabel, townOf, kstYmd, visitYmd, visitHm, stageOf, STAGE_STYLE } from "../utils/subTaskView.js";

const btn = {
  background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px",
  fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};
const field = {
  height: 34, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit",
};
// 이번 달 마지막 날 (미배정은 앞으로의 일정까지 봐야 해서 달 끝까지)
const endOfMonth = (ymd) => {
  const y = Number(ymd.slice(0, 4)), m = Number(ymd.slice(5, 7));
  return `${ymd.slice(0, 8)}${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
};
const addDays = (ymd, n) => kstYmd(new Date(new Date(`${ymd}T12:00:00+09:00`).getTime() + n * 86400000));
const dayTitle = (ymd) => {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });
};

// ───────────────────────── 타임라인 ─────────────────────────
const H0 = 5, H1 = 24;                      // 05시 ~ 24시 (2026-10-08 — 전에는 08~22시. 새벽 · 밤 작업이 잘리지 않게)
const SPAN = H1 - H0;
function hourPos(t) {
  if (!t.scheduled_at) return null;
  const d = new Date(t.scheduled_at);
  if (Number.isNaN(d.getTime())) return null;
  const [h, m] = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
  return h + m / 60;
}

const UN_W = 280;                 // 왼쪽 미배정 목록 폭
const DRAG_PX = 5;
const SUB_OPEN_DONE = ["완료", "취소", "visit_only", "정산완료", "진행중"];
const hmOf = (x) => `${String(Math.floor(x)).padStart(2, "0")}:${String(Math.round((x % 1) * 60)).padStart(2, "0")}`;

// 미배정 카드의 희망일·시간 글자. overdue = 희망일이 오늘보다 앞 (빨간 표시)
function wishOf(t, today) {
  const ymd = t.scheduled_at ? kstYmd(new Date(t.scheduled_at)) : (t.requested_date || "");
  const hm = visitHm(t);
  if (!ymd) return { text: hm ? `희망 ${hm}` : "시간 미정", overdue: false };
  const [, m, d] = ymd.split("-");
  return { text: `${ymd === today ? "오늘" : `${Number(m)}/${Number(d)}`}${hm ? ` ${hm}` : ""}`, overdue: ymd < today };
}

// 2026-10-07 — 왼쪽 미배정 목록 (운영자 타임라인 시안 v1 과 같은 배치).
//   카드를 기사 줄의 시간 칸에 끌어다 놓으면 배정 + 일정 확정. 누르면 기존 배정 시트.
//   운영자 화면의 목록 부품과 모양은 같지만, 데이터 꼴(협력사 RPC 의 snake_case 행)과 저장 함수가 달라 따로 둔다.
function SubUnassignedPanel({ tasks, today, onPick, onDragStart, onDragMove, onDrop, onDragCancel }) {
  const [dragging, setDragging] = useState(null);
  const start = useRef(null);
  return (
    <div style={{
      width: UN_W, flexShrink: 0, background: "var(--bg-elevated)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh", boxSizing: "border-box",
    }}>
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)" }}>
        <b style={{ fontSize: 16 }}>미배정</b>
        <span style={{
          display: "inline-grid", placeItems: "center", minWidth: 22, height: 22, borderRadius: 99, marginLeft: 6, padding: "0 6px", boxSizing: "border-box",
          background: tasks.length > 0 ? "var(--danger, #E5484D)" : "var(--border)", color: "#fff", fontSize: 12, fontWeight: 800,
        }}>{tasks.length}</span>
      </div>
      <div style={{ padding: "10px 12px", overflowY: "auto", flex: 1, minHeight: 0 }}>
        {tasks.length === 0 && (
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textAlign: "center", padding: "28px 0" }}>미배정 없음 ✓</div>
        )}
        {tasks.map(t => {
          const cat = getCategoryMeta(catTask(t));
          const wish = wishOf(t, today);
          const amount = Number(t.product_price || t.supply_amount || 0);
          const isDrag = dragging && dragging.id === t.id;
          return (
            <div
              key={t.id}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_e) { /* 무시 */ }
                start.current = { id: t.id, x: e.clientX, y: e.clientY, moved: false };
              }}
              onPointerMove={(e) => {
                const st = start.current;
                if (!st || st.id !== t.id) return;
                if (!st.moved && Math.abs(e.clientX - st.x) < DRAG_PX && Math.abs(e.clientY - st.y) < DRAG_PX) return;
                if (!st.moved) { st.moved = true; onDragStart(t); }
                setDragging({ id: t.id, x: e.clientX, y: e.clientY, label: `${cat.icon} ${t.customer_name || ""}`, color: cat.color });
                onDragMove(t, e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                const st = start.current;
                start.current = null;
                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_e) { /* 무시 */ }
                if (!st || st.id !== t.id) return;
                setDragging(null);
                if (st.moved) onDrop(t, e.clientX, e.clientY);
                else onPick(t);                        // 끌지 않고 누르면 기존 배정 시트
              }}
              onPointerCancel={() => { start.current = null; setDragging(null); onDragCancel(); }}
              style={{
                border: isDrag ? "1px dashed var(--border)" : "1px solid var(--border)", borderRadius: 12, padding: "10px 12px 10px 14px", marginBottom: 8,
                position: "relative", background: "var(--bg-elevated)", cursor: isDrag ? "grabbing" : "grab",
                opacity: isDrag ? 0.35 : 1, userSelect: "none", touchAction: "none",
              }}>
              <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 4, borderRadius: "0 4px 4px 0", background: cat.color }}/>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 12, color: "var(--text-secondary)", fontWeight: 700 }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, marginRight: 4, background: categoryTint(cat.color, 0.16), color: cat.color }}>{cat.icon} {cat.short || cat.label}</span>
                  {townOf(t)}
                </span>
                <em style={{ fontStyle: "normal", flexShrink: 0, fontWeight: 800, color: wish.overdue ? "var(--danger, #E5484D)" : "var(--accent, #FF1B8D)" }}>
                  {wish.overdue ? "⚠ " : ""}{wish.text}
                </em>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, margin: "3px 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.customer_name || "—"}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {workLabel(t)}{amount > 0 ? ` · ${fmtWon(amount)}` : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5, background: "var(--bg-secondary)" }}>
        카드를 오른쪽 기사 줄의 원하는 시간에 <strong>끌어다 놓으면</strong> 배정 + 시간이 한 번에 정해집니다. 누르면 배정 시트.
      </div>
      {dragging && (
        <div style={{
          position: "fixed", left: dragging.x + 12, top: dragging.y + 12, zIndex: 2000, pointerEvents: "none",
          background: dragging.color, color: "#fff", fontSize: 12, fontWeight: 800, padding: "6px 10px", borderRadius: 8,
          boxShadow: "0 6px 18px rgba(0,0,0,0.35)", whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis",
        }}>{dragging.label}</div>
      )}
    </div>
  );
}

// preset: { day, n } — 홈에서 날짜를 정해 넘어올 때. n 이 바뀔 때마다 그 날짜로 맞춘다.
// onPick(task): 미배정 카드를 눌렀을 때 — 기존 배정 시트를 연다.  onChanged(taskId): 끌어다 배정한 뒤 바깥 목록 갱신.
export function SubPcTimeline({ onOpen, onPick, onChanged, refreshKey = 0, preset = null }) {
  const today = kstYmd(new Date());
  const [day, setDay] = useState((preset && preset.day) || today);
  useEffect(() => { if (preset && preset.day) setDay(preset.day); }, [preset && preset.n]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [tasks, setTasks] = useState([]);
  const [openAll, setOpenAll] = useState([]);       // 그 협력사의 전체 작업 (미배정 목록용)
  const [staff, setStaff] = useState([]);
  const [offs, setOffs] = useState([]);             // 그 날짜의 기사 휴무 (Mig 246). 못 읽으면 빈 목록 — 전처럼 전원 표시
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [preview, setPreview] = useState(null);     // 놓을 자리 { rowId, hour, dur, label, tip, bad }
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [idleOpen, setIdleOpen] = useState(false);  // "오늘 일 없는 기사" 펼침
  const canDo = useRef(new Map());                  // taskId → Map(engineerId → 할 수 있는지)  (서버 판정: sub_list_staff_for_task)

  const load = useCallback(async () => {
    setLoading(true);
    const [tr, sr, ar, fr] = await Promise.all([subQueryTasks({ from: day, to: day }), subListStaff(), subListTasks(), subListStaffOffs(day)]);
    setOffs(fr.ok && Array.isArray(fr.offs) ? fr.offs : []);
    if (!tr.ok) setError(tr.error || "작업을 불러오지 못했습니다.");
    else { setError(""); setTasks(Array.isArray(tr.tasks) ? tr.tasks : []); }
    if (sr.ok) setStaff(Array.isArray(sr.staff) ? sr.staff : []);
    if (ar.ok) setOpenAll(Array.isArray(ar.tasks) ? ar.tasks : []);
    setLoading(false);
  }, [day]);
  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);

  function say(type, message) { setToast({ type, message }); setTimeout(() => setToast(null), 3200); }

  // 왼쪽 목록 — 끝나지 않았고 담당 기사가 없는 작업 (날짜와 상관없이). 희망일이 이른 순.
  const unassigned = useMemo(() => {
    const key = (t) => (t.scheduled_at ? kstYmd(new Date(t.scheduled_at)) : (t.requested_date || "9999-99-99")) + " " + (visitHm(t) || "99:99");
    return openAll.filter(t => !t.assigned_engineer_id && !SUB_OPEN_DONE.includes(t.status)).sort((a, b) => key(a).localeCompare(key(b)));
  }, [openAll]);

  // 줄: 그날 작업 있는 기사(많은 순), 없는 기사(흐리게). 담당 기사 없는 작업은 왼쪽 목록에만 나온다.
  const rows = useMemo(() => {
    const by = new Map();
    for (const t of tasks) {
      if (!t.assigned_engineer_id) continue;
      if (!by.has(t.assigned_engineer_id)) by.set(t.assigned_engineer_id, []);
      by.get(t.assigned_engineer_id).push(t);
    }
    const names = new Map(staff.map(s => [s.id, s.name]));
    for (const t of tasks) if (t.assigned_engineer_id && !names.has(t.assigned_engineer_id)) names.set(t.assigned_engineer_id, t.engineer_name || "기사");
    // 2026-10-07 — 휴무 규칙 (운영자 타임라인과 같음)
    //   정기(반복) 휴무 + 그날 작업 0건 → 줄을 숨긴다 (위쪽에 "정기 휴무 n명" 숫자만). 끌어다 놓을 대상도 아니다.
    //   정기 휴무인데 작업이 있음      → 줄 표시 + "⚠ 휴무일 작업"
    //   하루·기간 휴무                 → 줄은 그대로, 이름 옆에 🏖️
    const offBy = new Map();
    for (const o of offs) { if (!offBy.has(o.engineer_id)) offBy.set(o.engineer_id, []); offBy.get(o.engineer_id).push(o); }
    const isRepeat = (id) => (offBy.get(id) || []).some(o => o.type === "repeat");
    const isDayOff = (id) => (offBy.get(id) || []).some(o => ["single", "range", "repeat", "휴무종일"].includes(o.type));
    const live = (id) => (by.get(id) || []).filter(t => t.status !== "취소").length;
    const withWork = [...names.keys()].filter(id => by.has(id)).sort((a, b) => by.get(b).length - by.get(a).length || String(names.get(a)).localeCompare(String(names.get(b)), "ko"));
    const idleAll = [...names.keys()].filter(id => !by.has(id)).sort((a, b) => String(names.get(a)).localeCompare(String(names.get(b)), "ko"));
    const hidden = idleAll.filter(isRepeat).map(id => names.get(id));
    const idle = idleAll.filter(id => !isRepeat(id));
    const list = [
      ...withWork.map(id => ({ id, name: names.get(id), items: by.get(id), offWork: isRepeat(id) && live(id) > 0, dayOff: isDayOff(id) })),
      ...idle.map(id => ({ id, name: names.get(id), items: [], dim: true, dayOff: isDayOff(id) })),
    ];
    list.hiddenOff = hidden;
    return list;
  }, [tasks, staff, offs]);

  // ── 끌어다 놓기 ──
  async function handleDragStart(t) {
    if (canDo.current.has(t.id)) return;
    const res = await subListStaffForTask(t.id);          // 이 작업 종목을 할 수 있는 기사인지 (서버 판정)
    if (res.ok) canDo.current.set(t.id, new Map((res.staff || []).map(x => [x.id, x.can_do !== false])));
  }
  function locate(x, y) {
    const el = document.elementFromPoint(x, y);
    const laneEl = el && el.closest ? el.closest("[data-sub-lane]") : null;
    if (!laneEl) return null;
    const row = rows.find(r => r.id === laneEl.dataset.subLane);
    if (!row) return null;
    const rect = laneEl.getBoundingClientRect();
    if (rect.width <= 0) return null;
    let hour = H0 + ((x - rect.left) / rect.width) * SPAN;
    hour = Math.round(hour * 2) / 2;                       // 30분 단위
    hour = Math.max(H0, Math.min(H1 - 0.5, hour));
    return { row, hour };
  }
  const cannot = (t, rowId) => { const m = canDo.current.get(t.id); return !!m && m.get(rowId) === false; };
  function handleDragMove(t, x, y) {
    const hit = locate(x, y);
    if (!hit) { setPreview(null); return; }
    if (cannot(t, hit.row.id)) {
      setPreview({ rowId: hit.row.id, bad: true, tip: `${hit.row.name} 님은 이 종목을 할 수 없습니다` });
      return;
    }
    setPreview({
      rowId: hit.row.id, hour: hit.hour, dur: getTaskDurationHours(catTask(t)),
      label: `${getCategoryMeta(catTask(t)).icon} ${t.customer_name || ""}`,
      tip: `← ${hmOf(hit.hour)} ${hit.row.name} 배정 (놓으면 확인창)`,
    });
  }
  async function handleDrop(t, x, y) {
    const hit = locate(x, y);
    setPreview(null);
    if (!hit || saving) return;
    // 종목 가능 여부 — 아직 못 읽었으면 지금 읽어서 확인한다
    if (!canDo.current.has(t.id)) await handleDragStart(t);
    if (cannot(t, hit.row.id)) { say("error", `${hit.row.name} 님은 이 종목을 할 수 없습니다 — 다른 기사를 골라 주세요`); return; }
    const [, m, d] = day.split("-");
    if (!window.confirm(`${t.customer_name || "작업"}\n\n${hit.row.name} 님 · ${Number(m)}/${Number(d)} ${hmOf(hit.hour)} 에 배정하고 일정을 확정할까요?`)) return;
    setSaving(true);
    // 기존 협력사 함수 그대로: 담당 기사 배정 → 일정 확정
    const ar = await subAssignTask(t.id, hit.row.id);
    if (!ar.ok) { setSaving(false); say("error", ar.error || "배정하지 못했습니다"); return; }
    const sr = await subSetSchedule(t.id, new Date(`${day}T${hmOf(hit.hour)}:00+09:00`).toISOString());
    setSaving(false);
    if (!sr.ok) say("error", `배정은 됐지만 일정을 정하지 못했습니다 — ${sr.error || ""}`);
    else say("success", `${t.customer_name || "작업"} 배정 완료 (${hit.row.name} · ${hmOf(hit.hour)})`);
    canDo.current.delete(t.id);
    await load();
    if (typeof onChanged === "function") onChanged(t.id);
  }

  const nowPos = (() => {
    if (day !== today) return null;
    const [h, m] = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
    const x = h + m / 60;
    return x >= H0 && x <= H1 ? ((x - H0) / SPAN) * 100 : null;
  })();
  const NAMEW = 180;
  // 달력의 "작업 있는 날" 점 — 이미 읽어 온 작업 목록의 일정 날짜
  const markedDates = new Set();
  for (const t of [...(openAll || []), ...(tasks || [])]) {
    if (!t || t.status === "취소" || !t.scheduled_at) continue;
    markedDates.add(kstYmd(new Date(t.scheduled_at)));
  }
  // 오늘 일 없는 기사는 기본으로 접는다 (한 줄 요약). 펼치면 전처럼 줄이 나온다.
  const busyRows = rows.filter(r => r.items.length > 0 || r.dayOff);
  const idleRows = rows.filter(r => !(r.items.length > 0 || r.dayOff));
  const shownRows = idleOpen ? [...busyRows, ...idleRows] : busyRows;
  const dayTasks = tasks.filter(t => t.assigned_engineer_id);

  return (
    <div style={{ display: "flex", alignItems: "stretch", minHeight: "100%" }}>
      <SubUnassignedPanel
        tasks={unassigned}
        today={today}
        onPick={(t) => { if (typeof onPick === "function") onPick(t); else onOpen(t.id); }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDrop={handleDrop}
        onDragCancel={() => setPreview(null)}
      />
    <div style={{ flex: 1, minWidth: 0, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginRight: 8 }}>타임라인</div>
        {/* 2026-10-07 시안 v2 — 운영자 타임라인과 같은 날짜 고르기 (달력 + 어제·오늘·내일·모레) */}
        <TimelineDatePicker selectedDate={day} today={today} onChange={setDay} markedDates={markedDates}/>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>· {dayTasks.filter(t => t.status !== "취소").length}건{dayTasks.some(t => t.status === "취소") ? ` (취소 ${dayTasks.filter(t => t.status === "취소").length})` : ""}</span>
        {rows.hiddenOff && rows.hiddenOff.length > 0 && (
          <button type="button" onClick={() => window.alert(`🏖️ 이 날 정기 휴무

${rows.hiddenOff.join(", ")}`)} title={rows.hiddenOff.join(", ")} style={{
            background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, color: "var(--text-secondary)", textDecoration: "underline dotted",
          }}>· 정기 휴무 {rows.hiddenOff.length}명</button>
        )}
        <span style={{ flex: 1 }}/>
        <button type="button" onClick={load} disabled={loading} style={btn}>{loading ? "…" : "새로고침"}</button>
      </div>
      {error && <div style={{ color: "var(--danger, #E5484D)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{error}</div>}

      <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-elevated)", overflowX: "auto" }}>
        <div style={{ minWidth: 1240 }}>
          {/* 시간 눈금 */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
            <div style={{ width: NAMEW, flexShrink: 0, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>기사</div>
            <div style={{ flex: 1, position: "relative", height: 32 }}>
              {Array.from({ length: SPAN + 1 }, (_, i) => (
                <span key={i} style={{ position: "absolute", left: `${(i / SPAN) * 100}%`, top: 8, transform: "translateX(-50%)", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>{H0 + i}</span>
              ))}
            </div>
          </div>
          {rows.length === 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>등록된 기사가 없습니다</div>
          )}
          {shownRows.map((r, rowIdx) => {
            const timed = r.items.filter(t => { const x = hourPos(t); return x != null; });
            const untimed = r.items.filter(t => hourPos(t) == null);
            const pv = preview && preview.rowId === r.id ? preview : null;
            const target = pv && !pv.bad;
            return (
              <div key={r.id} style={{ display: "flex", borderBottom: "1px solid var(--border)", opacity: r.dim && !target ? 0.45 : 1, minHeight: 62, background: rowIdx % 2 === 1 ? "var(--bg-secondary)" : "transparent" }}>
                <div style={{ width: NAMEW, flexShrink: 0, padding: "10px 14px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                    {r.dayOff && <span title="휴무" style={{ marginRight: 3 }}>🏖️</span>}
                    {r.name}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>{r.items.length}건</div>
                  {r.offWork && (
                    <span title="정기 휴무일에 작업이 잡혀 있습니다" style={{
                      display: "inline-block", marginTop: 3, fontSize: 10.5, fontWeight: 800, padding: "1px 6px", borderRadius: 5,
                      background: "rgba(249,115,22,0.16)", color: "#F97316", whiteSpace: "nowrap",
                    }}>⚠ 휴무일 작업</span>
                  )}
                  {/* 시각이 없는 작업은 이름 아래 칩으로 */}
                  {untimed.map(t => (
                    <button key={t.id} type="button" onClick={() => onOpen(t.id)} title={`${t.customer_name} · 시간 미정`} style={{
                      display: "block", maxWidth: "100%", marginTop: 4, padding: "2px 6px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                      border: `1px dashed ${getCategoryMeta(catTask(t)).color}`, background: "transparent", color: "var(--text-primary)",
                      fontFamily: "inherit", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left",
                    }}>미정 · {t.customer_name}</button>
                  ))}
                </div>
                <div data-sub-lane={r.id} style={{
                  flex: 1, position: "relative",
                  background: target ? "var(--accent-bg, rgba(255,27,141,0.07))" : "transparent",
                  outline: target ? "2px dashed var(--accent, #FF1B8D)" : "none", outlineOffset: -2,
                }}>
                  {Array.from({ length: SPAN }, (_, i) => (
                    <span key={i} style={{ position: "absolute", left: `${(i / SPAN) * 100}%`, top: 0, bottom: 0, borderLeft: "1px solid var(--border)", opacity: 0.5 }}/>
                  ))}
                  {nowPos != null && <span style={{ position: "absolute", left: `${nowPos}%`, top: 0, bottom: 0, borderLeft: "2px solid var(--accent, #FF1B8D)", zIndex: 2 }}/>}
                  {(() => {
                    // 시작 시각순으로 놓고, 막대 길이 = 서비스별 기본 소요 시간. 다음 막대와 겹치는 구간만 반투명으로 칠한다.
                    const bars = timed.map(t => {
                      const s0 = Math.min(Math.max(hourPos(t), H0), H1 - 0.25);
                      return { t, s: s0, e: Math.min(s0 + getTaskDurationHours(catTask(t)), H1) };
                    }).sort((x, y) => x.s - y.s);
                    return bars.map((bar, i) => {
                      const { t, s: bs, e: be } = bar;
                      const cat = getCategoryMeta(catTask(t));
                      const cancelled = t.status === "취소";
                      const done = stageOf(t) === "완료";
                      const prevEnd = Math.max(bs, ...bars.slice(0, i).map(x => x.e));          // 앞 막대가 덮는 끝
                      const nextStart = i + 1 < bars.length ? Math.min(be, bars[i + 1].s) : be; // 뒤 막대가 시작하는 곳
                      const len = Math.max(be - bs, 0.01);
                      const p1 = Math.min(Math.max(((prevEnd - bs) / len) * 100, 0), 100);      // 앞쪽 겹침 끝 %
                      const p2 = Math.min(Math.max(((nextStart - bs) / len) * 100, p1), 100);   // 뒤쪽 겹침 시작 %
                      const solid = cat.color, soft = categoryTint(cat.color, 0.45);
                      const bg = cancelled
                        ? "repeating-linear-gradient(135deg, var(--bg-secondary) 0 6px, var(--border) 6px 12px)"   // 취소 = 회색 줄무늬
                        : `linear-gradient(to right, ${soft} 0 ${p1}%, ${solid} ${p1}% ${p2}%, ${soft} ${p2}% 100%)`;
                      return (
                        <button key={t.id} type="button" onClick={() => onOpen(t.id)}
                          title={`${visitHm(t)} ${t.customer_name} · ${townOf(t)} · ${stageOf(t)} · 약 ${getTaskDurationHours(catTask(t))}시간`}
                          style={{
                            position: "absolute", top: 6, bottom: 6, left: `${((bs - H0) / SPAN) * 100}%`,
                            width: `calc(${((be - bs) / SPAN) * 100}% - 3px)`, minWidth: 48, zIndex: 1 + i,
                            borderRadius: 8, border: "none", padding: "0 8px", cursor: "pointer", fontFamily: "inherit",
                            fontSize: 12, fontWeight: 700, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            color: cancelled ? "var(--text-secondary)" : (cat.textOnColor || "#fff"),
                            background: bg,
                            opacity: done ? 0.4 : 1,          // 완료 = 종목 색 그대로 + 반투명 + ✓ (진행·확정·배정은 진하게)
                            textDecoration: cancelled ? "line-through" : "none",
                          }}>
                          {done ? "✓ " : ""}{t.customer_name}{townOf(t) ? ` · ${townOf(t)}` : ""}
                        </button>
                      );
                    });
                  })()}
                  {/* 놓을 자리 미리보기: 점선 막대 + 말풍선 */}
                  {target && (() => {
                    const leftPct = ((pv.hour - H0) / SPAN) * 100;
                    const widthPct = Math.min(100 - leftPct, (pv.dur / SPAN) * 100);
                    const tipLeft = leftPct + widthPct > 70;
                    return (
                      <>
                        <div style={{
                          position: "absolute", top: 5, bottom: 5, left: `${leftPct}%`, width: `${widthPct}%`, boxSizing: "border-box",
                          borderRadius: 8, border: "2px dashed var(--accent, #FF1B8D)", background: "rgba(255,27,141,0.12)",
                          color: "var(--accent, #FF1B8D)", fontSize: 11.5, fontWeight: 800, display: "flex", alignItems: "center",
                          padding: "0 8px", whiteSpace: "nowrap", overflow: "hidden", pointerEvents: "none", zIndex: 40,
                        }}>{pv.label}</div>
                        <div style={{
                          position: "absolute", top: 9,
                          ...(tipLeft ? { right: `calc(${100 - leftPct}% + 8px)` } : { left: `calc(${leftPct + widthPct}% + 8px)` }),
                          background: "#1A1A1A", color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 8,
                          whiteSpace: "nowrap", pointerEvents: "none", zIndex: 60,
                        }}>{tipLeft ? pv.tip.replace(/^← /, "") + " →" : pv.tip}</div>
                      </>
                    );
                  })()}
                  {pv && pv.bad && (
                    <div style={{
                      position: "absolute", top: 9, left: 12, background: "#1A1A1A", color: "#fff", fontSize: 12, fontWeight: 700,
                      padding: "6px 10px", borderRadius: 8, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 60,
                    }}>🚫 {pv.tip}</div>
                  )}
                </div>
              </div>
            );
          })}
          {/* 2026-10-07 시안 v2 — 오늘 일 없는 기사: 기본 접힘, 한 줄 요약 */}
          {idleRows.length > 0 && (
            <button type="button" onClick={() => setIdleOpen(v => !v)} style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", cursor: "pointer", fontFamily: "inherit",
              background: "var(--bg-secondary)", border: "none", borderTop: "1px dashed var(--border)",
              fontSize: 13.5, color: "var(--text-secondary)", textAlign: "left",
            }}>
              <span>{idleOpen ? "▾" : "▸"}</span>
              <b style={{ color: "var(--text-primary)" }}>오늘 일 없는 기사 {idleRows.length}명</b>
              {!idleOpen && <span>· 펼치면 끌어다 배정 가능</span>}
            </button>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, color: "var(--text-secondary)", flexWrap: "wrap" }}>
        {categoriesInTasks(tasks.map(catTask)).map(m => (
          <span key={m.key} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: m.color }}/>{m.icon} {m.label}
          </span>
        ))}
        <span>✓ 연한 막대 = 완료 · 줄무늬 = 취소 · 분홍 세로선 = 지금 · 막대 길이 = 서비스별 기본 소요 시간(표시용) · 겹친 구간은 연하게</span>
      </div>
    </div>
      {toast && (
        <div style={{
          position: "fixed", right: 24, bottom: 24, padding: "12px 16px", borderRadius: 10, zIndex: 1000,
          background: toast.type === "success" ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)",
          color: "#fff", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        }}>{toast.message}</div>
      )}
    </div>
  );
}

// ───────────────────────── 전체 작업 검색 ─────────────────────────
const STAGES = ["전체", "미배정", "배정", "일정확정", "진행", "완료", "취소"];
const COLS = [
  { key: "when",  label: "방문일시", get: t => `${visitYmd(t)} ${visitHm(t)}` },
  { key: "cat",   label: "종목",     get: t => getCategoryMeta(catTask(t)).label },
  { key: "name",  label: "고객명",   get: t => t.customer_name || "" },
  { key: "town",  label: "주소(구·동)", get: t => townOf(t) },
  { key: "work",  label: "작업 항목", get: t => workLabel(t) },
  { key: "eng",   label: "담당 기사", get: t => t.engineer_name || "" },
  { key: "stage", label: "상태",     get: t => stageOf(t) },
  { key: "supply", label: "공급가",  get: t => Number(t.supply_amount) || 0, num: true },
  { key: "fee",   label: "수수료",   get: t => Number(t.fee) || 0, num: true },
];

// preset: { stage?, eng?, n } — 홈·기사 탭에서 조건을 정해 넘어올 때 (기간은 이번 달).
// 2026-10-08 — 기본 기간을 '이번 달 1일 ~ 60일 뒤'로 넓히고, 기본 정렬을 '앞으로 할 일 먼저'로.
//   예정 작업이 우선이라는 대표 요청: 오늘 이후 일정은 가까운 순, 그 아래 지난 작업은 최근 순.
const RANGES = [
  { key: "ahead", label: "앞으로",   get: (d) => [d, addDays(d, 90)] },
  { key: "month", label: "이번 달",  get: (d) => [d.slice(0, 8) + "01", endOfMonth(d)] },
  { key: "last",  label: "지난 달",  get: (d) => { const p = addDays(d.slice(0, 8) + "01", -1); return [p.slice(0, 8) + "01", p]; } },
  { key: "wide",  label: "전체(앞뒤 3개월)", get: (d) => [addDays(d, -92), addDays(d, 92)] },
];
export function SubPcSearch({ onOpen, refreshKey = 0, preset = null }) {
  const today = kstYmd(new Date());
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(addDays(today, 60));
  const [stage, setStage] = useState((preset && preset.stage) || "전체");
  const [eng, setEng] = useState((preset && preset.eng) || "");
  useEffect(() => {
    if (!preset) return;
    setStage(preset.stage || "전체"); setEng(preset.eng || "");
    setFrom(today.slice(0, 8) + "01"); setTo(addDays(today, 60));    // 이번 달 + 앞으로 60일
  }, [preset && preset.n]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: "ahead", dir: 1 });   // ahead = 앞으로 할 일 먼저

  useEffect(() => { subListStaff().then(r => { if (r.ok) setStaff(Array.isArray(r.staff) ? r.staff : []); }); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await subQueryTasks({ from, to, engineerId: eng || null, query: q.trim() });
    if (!res.ok) { setError(res.error || "작업을 불러오지 못했습니다."); setRows([]); setTotal(0); }
    else { setError(""); setRows(Array.isArray(res.tasks) ? res.tasks : []); setTotal(Number(res.total) || 0); }
    setLoading(false);
  }, [from, to, eng, q]);
  // 검색어는 입력이 멈춘 뒤에, 나머지 조건은 바로
  useEffect(() => { const id = setTimeout(load, 350); return () => clearTimeout(id); }, [load, refreshKey]);

  const cats = useMemo(() => categoriesInTasks(rows.map(catTask)), [rows]);
  const shown = useMemo(() => {
    const list = rows.filter(t => (stage === "전체" || stageOf(t) === stage) && (!cat || getCategoryMeta(catTask(t)).key === cat));
    if (sort.key === "ahead") {
      // 오늘 이후(일정 미정 포함) → 가까운 날짜 순, 지난 작업 → 최근 순, 취소는 맨 아래
      const rank = (t) => t.status === "취소" ? 2 : (visitYmd(t) || "9999") >= today ? 0 : 1;
      const when = (t) => `${visitYmd(t) || "9999-99-99"} ${visitHm(t) || "99:99"}`;
      return [...list].sort((a, b) => {
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;
        const c = when(a).localeCompare(when(b));
        return ra === 0 ? c : -c;
      });
    }
    const col = COLS.find(c => c.key === sort.key) || COLS[0];
    return [...list].sort((a, b) => {
      const x = col.get(a), y = col.get(b);
      const r = col.num ? (x - y) : String(x).localeCompare(String(y), "ko");
      return r * sort.dir;
    });
  }, [rows, stage, cat, sort, today]);
  const sum = useMemo(() => {
    const live = shown.filter(t => t.status !== "취소");
    return { n: shown.length, supply: live.reduce((s, t) => s + (Number(t.supply_amount) || 0), 0), fee: live.reduce((s, t) => s + (Number(t.fee) || 0), 0) };
  }, [shown]);

  function downloadCsv() {
    const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ["작업번호", ...COLS.map(c => c.label), "고객 전화", "주소"];
    const lines = shown.map(t => [t.task_no || "", ...COLS.map(c => c.get(t)), t.phone || "", t.address || ""].map(esc).join(","));
    // UTF-8 BOM — 엑셀에서 한글이 깨지지 않게
    const blob = new Blob(["﻿" + [head.map(esc).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `작업목록_${from}_${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const th = { padding: "9px 10px", fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textAlign: "left", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", position: "sticky", top: 0 };
  const td = { padding: "9px 10px", fontSize: 13, borderBottom: "1px solid var(--border)", verticalAlign: "middle" };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>전체 작업</div>
      {/* 필터 한 줄 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input type="date" value={from} onChange={e => e.target.value && setFrom(e.target.value)} style={field} aria-label="기간 시작"/>
        <span style={{ color: "var(--text-secondary)" }}>~</span>
        <input type="date" value={to} onChange={e => e.target.value && setTo(e.target.value)} style={field} aria-label="기간 끝"/>
        <select value={stage} onChange={e => setStage(e.target.value)} style={field} aria-label="상태">
          {STAGES.map(s => <option key={s} value={s}>{s === "전체" ? "상태 전체" : s}</option>)}
        </select>
        <select value={eng} onChange={e => setEng(e.target.value)} style={field} aria-label="기사">
          <option value="">기사 전체</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={cat} onChange={e => setCat(e.target.value)} style={field} aria-label="종목">
          <option value="">종목 전체</option>
          {cats.map(m => <option key={m.key} value={m.key}>{m.icon} {m.label}</option>)}
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="고객명 · 전화 뒷자리 · 주소 · 작업번호" style={{ ...field, flex: 1, minWidth: 220 }} aria-label="검색어"/>
        <button type="button" onClick={load} disabled={loading} style={btn}>{loading ? "…" : "조회"}</button>
      </div>
      {/* 기간 바로 고르기 + 정렬 되돌리기 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {RANGES.map(r => { const [f, t2] = r.get(today); const on = from === f && to === t2; return (
          <button key={r.key} type="button" onClick={() => { setFrom(f); setTo(t2); }}
            style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              border: on ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)", background: on ? "rgba(255,27,141,0.10)" : "var(--bg-secondary)",
              color: on ? "var(--accent, #FF1B8D)" : "var(--text-secondary)" }}>{r.label}</button>
        ); })}
        <span style={{ flex: 1 }}/>
        <button type="button" onClick={() => setSort({ key: "ahead", dir: 1 })}
          style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            border: sort.key === "ahead" ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)", background: sort.key === "ahead" ? "rgba(255,27,141,0.10)" : "var(--bg-secondary)",
            color: sort.key === "ahead" ? "var(--accent, #FF1B8D)" : "var(--text-secondary)" }}>
          {sort.key === "ahead" ? "✓ 앞으로 할 일 먼저" : "앞으로 할 일 먼저 보기"}
        </button>
      </div>
      {error && <div style={{ color: "var(--danger, #E5484D)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{error}</div>}
      {total > rows.length && <div style={{ fontSize: 12, color: "var(--danger, #E5484D)", fontWeight: 700, marginBottom: 8 }}>조건에 맞는 작업이 {total}건이라 최근 {rows.length}건만 보여 줍니다. 기간을 줄여 주세요.</div>}

      <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-elevated)", overflow: "auto", maxHeight: "calc(100vh - 250px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr>
              {COLS.map(c => (
                <th key={c.key} onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))} style={{ ...th, textAlign: c.num ? "right" : "left" }}>
                  {c.label}{sort.key === c.key ? (sort.dir > 0 ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && shown.length === 0 && (
              <tr><td colSpan={COLS.length} style={{ ...td, textAlign: "center", color: "var(--text-secondary)", padding: "40px 0" }}>조건에 맞는 작업이 없습니다.</td></tr>
            )}
            {shown.map(t => {
              const st = stageOf(t);
              const ss = STAGE_STYLE[st] || STAGE_STYLE["취소"];
              const cancelled = t.status === "취소";
              return (
                <tr key={t.id} onClick={() => onOpen(t.id)} style={{ cursor: "pointer", opacity: cancelled ? 0.55 : 1 }}>
                  <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 700 }}>{visitYmd(t).slice(5).replace("-", "/")} {visitHm(t) || "미정"}</td>
                  <td style={td}><CategoryChip task={catTask(t)} size="sm"/></td>
                  <td style={{ ...td, fontWeight: 700 }}>{t.customer_name}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{townOf(t)}</td>
                  <td style={{ ...td, color: "var(--text-secondary)" }}>{workLabel(t)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", color: t.engineer_name ? "var(--text-primary)" : "#E5484D" }}>{t.engineer_name || "미배정"}</td>
                  <td style={td}><span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: ss.bg, color: ss.fg, whiteSpace: "nowrap" }}>{st}</span></td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{Number(t.supply_amount) > 0 ? fmtWon(t.supply_amount) : "—"}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{Number(t.fee) > 0 ? fmtWon(t.fee) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* 합계 + CSV */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>합계 {sum.n}건</span>
        <span style={{ fontSize: 13 }}>공급가 <b>{fmtWon(sum.supply)}</b></span>
        <span style={{ fontSize: 13 }}>수수료 <b>{fmtWon(sum.fee)}</b></span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>(금액 합계는 취소 건 제외)</span>
        <span style={{ flex: 1 }}/>
        <button type="button" onClick={downloadCsv} disabled={shown.length === 0} style={btn}>엑셀(CSV) 받기</button>
      </div>
    </div>
  );
}
