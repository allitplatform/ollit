// 2026-10-06 Mig 212~214 — 협력사 관리자 화면.
//   · 자기 협력사 작업만 조회, 자기 소속 직원에게만 배정 (서버 RPC 가 소속을 확인).
//   · 원청 화면(PrincipalApp) 코드는 재사용하지 않는다 — 그쪽 조회는 브라우저 필터라 소속 보장이 안 됨.
//   · 큰 글씨 / 한 화면에 주 버튼 1개 (원청 PWA 수준의 단순함).
//   · 수수료 입금·정산 내역 탭은 수수료 규칙 적용(다음 묶음) 때 추가.
import { useCallback, useEffect, useMemo, useState } from "react";
import { subListTasks, subListStaff, subAssignTask } from "../lib/subcontractorsDb.js";
import { RoleSwitcher } from "../components/RoleSwitcher.jsx";

const C = {
  bg: "#F6F5F2", card: "#FFFFFF", text: "#141414", sub: "#5F5F5F", line: "#E4E1DA",
  pink: "#FF1B8D", red: "#D92D20", redBg: "#FDECEA", green: "#0F7B4F", greenBg: "#E7F5EE", grayBg: "#EEECE7",
};
const DONE = ["완료", "취소", "visit_only", "정산완료"];

function fmtWhen(t) {
  if (t.scheduled_at) {
    const d = new Date(t.scheduled_at);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short",
        hour: "2-digit", minute: "2-digit", hour12: false,
      });
    }
  }
  const parts = [t.requested_date, t.requested_time].filter(Boolean);
  return parts.length ? `희망 ${parts.join(" ")}` : "일정 협의";
}

function workLabel(t) {
  const items = Array.isArray(t.work_items) ? t.work_items : [];
  const names = items
    .map(i => [i.workType, i.appliance].filter(Boolean).join(" ") + (Number(i.qty) > 1 ? ` ×${i.qty}` : ""))
    .filter(Boolean);
  return names.join(", ") || t.work_type || "작업";
}

function won(n) {
  return n == null ? "-" : `₩${Number(n).toLocaleString("ko-KR")}`;
}

export default function SubManagerApp({ user, onLogout, onSwitchRole }) {
  const [tab, setTab] = useState("todo");            // todo(직원 미정) | plan(배정됨) | done(완료)
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(null);      // 배정할 작업
  const [busy, setBusy] = useState(false);

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
    const todo = [], plan = [], done = [];
    for (const t of tasks) {
      if (DONE.includes(t.status)) done.push(t);
      else if (!t.assigned_engineer_id) todo.push(t);
      else plan.push(t);
    }
    const asc = (a, b) => String(a.sort_at || "").localeCompare(String(b.sort_at || ""));
    todo.sort(asc);
    plan.sort(asc);
    done.sort((a, b) => String(b.completed_at || "").localeCompare(String(a.completed_at || "")));
    return { todo, plan, done };
  }, [tasks]);

  const list = groups[tab] || [];

  async function assign(task, engineerId) {
    if (busy) return;
    setBusy(true);
    const res = await subAssignTask(task.id, engineerId);
    setBusy(false);
    if (!res.ok) {
      alert(res.error || "배정에 실패했습니다.");
      return;
    }
    setPicking(null);
    load();
  }

  const subName = user?.subcontractor?.name || "협력사";
  const emptyText = tab === "todo"
    ? "직원을 정해야 할 작업이 없습니다."
    : tab === "plan" ? "배정된 작업이 없습니다." : "최근 완료한 작업이 없습니다.";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Pretendard', sans-serif", paddingBottom: 40 }}>
      {/* 머리 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 5, background: C.card, borderBottom: `1px solid ${C.line}`,
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{subName}</div>
            <div style={{ fontSize: 14, color: C.sub, marginTop: 2 }}>{user?.name} 님 · 협력사 관리</div>
          </div>
          {onSwitchRole && <RoleSwitcher user={user} onSwitch={onSwitchRole}/>}
          <button onClick={load} disabled={loading} style={btnGhost}>{loading ? "…" : "새로고침"}</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <TabBtn label="직원 미정" count={groups.todo.length} active={tab === "todo"} warn={groups.todo.length > 0} onClick={() => setTab("todo")}/>
          <TabBtn label="배정됨" count={groups.plan.length} active={tab === "plan"} onClick={() => setTab("plan")}/>
          <TabBtn label="완료" count={groups.done.length} active={tab === "done"} onClick={() => setTab("done")}/>
        </div>
      </div>

      <div style={{ padding: "14px 14px 0" }}>
        {error && (
          <div style={{ background: C.redBg, color: C.red, borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        {!error && !loading && list.length === 0 && (
          <div style={{ textAlign: "center", color: C.sub, fontSize: 17, padding: "56px 0" }}>{emptyText}</div>
        )}

        {list.map(t => {
          const isDone = DONE.includes(t.status);
          const hasEng = !!t.assigned_engineer_id;
          const stateText = isDone
            ? `${t.status === "visit_only" ? "방문만" : t.status} · ${t.engineer_name || "-"}${t.received_total != null ? ` · ${won(t.received_total)}` : ""}`
            : hasEng ? `담당 ${t.engineer_name || ""}` : "직원 미정";
          return (
            <div key={t.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 19, fontWeight: 800 }}>{t.customer_name}</div>
                <div style={{ fontSize: 13, color: C.sub }}>{t.task_no}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.pink, marginTop: 6 }}>{fmtWhen(t)}</div>
              <div style={{ fontSize: 16, marginTop: 6, lineHeight: 1.45 }}>{t.address || t.district || "주소 없음"}</div>
              <div style={{ fontSize: 15, color: C.sub, marginTop: 6 }}>{workLabel(t)}</div>
              {t.request_note && (
                <div style={{ fontSize: 15, color: C.sub, marginTop: 6, lineHeight: 1.45 }}>요청: {t.request_note}</div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                <div style={{
                  flex: 1, fontSize: 16, fontWeight: 800, padding: "10px 12px", borderRadius: 12,
                  background: isDone ? C.grayBg : hasEng ? C.greenBg : C.redBg,
                  color: isDone ? C.sub : hasEng ? C.green : C.red,
                }}>
                  {stateText}
                </div>
                {!isDone && t.status !== "진행중" && (
                  <button onClick={() => setPicking(t)} style={btnMain}>
                    {hasEng ? "변경" : "직원 정하기"}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                {t.phone && <a href={`tel:${t.phone}`} style={btnLink}>고객 전화</a>}
                {t.engineer_phone && <a href={`tel:${t.engineer_phone}`} style={btnLink}>직원 전화</a>}
              </div>
            </div>
          );
        })}

        <button onClick={onLogout} style={{ ...btnGhost, width: "100%", marginTop: 18, padding: "14px 0", fontSize: 16 }}>
          로그아웃
        </button>
      </div>

      {/* 직원 선택 */}
      {picking && (
        <div
          onClick={() => { if (!busy) setPicking(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 20, display: "flex", alignItems: "flex-end" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.card, width: "100%", maxHeight: "80vh", overflowY: "auto",
              borderRadius: "20px 20px 0 0", padding: "18px 16px calc(env(safe-area-inset-bottom, 0px) + 18px)",
            }}
          >
            <div style={{ fontSize: 19, fontWeight: 800 }}>누가 갈까요?</div>
            <div style={{ fontSize: 15, color: C.sub, margin: "6px 0 14px" }}>
              {picking.customer_name} · {fmtWhen(picking)}
            </div>
            {staff.length === 0 && (
              <div style={{ fontSize: 16, color: C.sub, padding: "20px 0" }}>등록된 직원이 없습니다.</div>
            )}
            {staff.map(s => (
              <button
                key={s.id}
                disabled={busy}
                onClick={() => assign(picking, s.id)}
                style={{
                  display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
                  background: picking.assigned_engineer_id === s.id ? C.greenBg : C.card,
                  border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 14px", marginBottom: 10,
                  fontSize: 18, fontWeight: 800, color: C.text, fontFamily: "inherit", cursor: "pointer",
                }}
              >
                <span>{s.name}{s.sub_role === "manager" ? " (관리자)" : ""}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.sub }}>진행 {s.open_tasks || 0}건</span>
              </button>
            ))}
            {picking.assigned_engineer_id && (
              <button
                disabled={busy}
                onClick={() => assign(picking, null)}
                style={{ ...btnGhost, width: "100%", padding: "14px 0", fontSize: 16, color: C.red }}
              >
                배정 해제 (직원 미정으로)
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => setPicking(null)}
              style={{ ...btnGhost, width: "100%", padding: "14px 0", fontSize: 16, marginTop: 8 }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ label, count, active, warn, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "12px 4px", borderRadius: 12, fontFamily: "inherit", cursor: "pointer",
        border: active ? `2px solid ${C.text}` : `1px solid ${C.line}`,
        background: active ? C.text : C.card, color: active ? "#fff" : C.text,
        fontSize: 16, fontWeight: 800,
      }}
    >
      {label} <span style={{ color: active ? "#fff" : warn ? C.red : C.sub }}>{count}</span>
    </button>
  );
}

const btnMain = {
  background: C.pink, color: "#fff", border: "none", borderRadius: 12, padding: "12px 16px",
  fontSize: 16, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};
const btnGhost = {
  background: "transparent", color: C.sub, border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 12px",
  fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};
const btnLink = {
  flex: 1, textAlign: "center", textDecoration: "none", background: C.grayBg, color: C.text,
  borderRadius: 12, padding: "12px 0", fontSize: 16, fontWeight: 700,
};
