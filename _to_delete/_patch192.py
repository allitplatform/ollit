import io, sys

ROOT = "/sessions/rcw-01u4et6pwfchupgdzvaelxyk/mnt/ollit/"

def patch(path, pairs):
    p = ROOT + path
    s = io.open(p, encoding="utf-8").read()
    before = len(s)
    for old, new in pairs:
        n = s.count(old)
        if n != 1:
            print("FAIL %s anchor count=%d\n---\n%s\n---" % (path, n, old[:160]))
            sys.exit(1)
        s = s.replace(old, new)
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    print("OK %s (%d -> %d)" % (path, before, len(s)))


# ---------- AdminApp.jsx : 새 배정 branch optimistic setters ----------
A = "src/pages/AdminApp.jsx"

a1_old = """                      ...t,
                      _optimisticUntil: optimisticUntil,
                      assignedEngineer: eng.name,
                      engineer: eng.name,
                      배정기사: eng.name,
                      status: '배정',
                      상태: '배정',
                      state: 'scheduled',
                    }"""
a1_new = """                      ...t,
                      _optimisticUntil: optimisticUntil,
                      assignedEngineer: eng.name,
                      engineer: eng.name,
                      배정기사: eng.name,
                      status: '배정',
                      상태: '배정',
                      state: 'scheduled',
                      // 2026-07-25 — 같은 기사 재선택 시 재배정 요청이 목록에 남던 버그.
                      //   isReassignment 는 '다른 기사' 일 때만 true 라 이 분기로 떨어지는데
                      //   여기 optimistic state 에 reassignRequest 초기화가 빠져 있었고
                      //   _optimisticUntil 5분 동안 polling 이 덮지도 못해 계속 남았음.
                      //   서버는 assignEngineerAdapter → clear_reassign_request 로 이미 지움.
                      reassignRequest: null,
                    }"""

a2_old = """            setSelectedTask(prev => prev ? {
              ...prev,
              assignedEngineer: eng.name,
              engineer: eng.name,
              status: '배정',
              state: 'scheduled',
            } : prev);"""
a2_new = """            setSelectedTask(prev => prev ? {
              ...prev,
              assignedEngineer: eng.name,
              engineer: eng.name,
              status: '배정',
              state: 'scheduled',
              reassignRequest: null,   // 2026-07-25 — 재배정 요청 목록 잔존 fix
            } : prev);"""

a3_old = """            setSelectedTaskDetail(prev => prev ? {
              ...prev,
              assignedEngineer: eng.name, engineer: eng.name,
              배정기사: eng.name,
              status: '배정', 상태: '배정', state: 'scheduled',
            } : prev);"""
a3_new = """            setSelectedTaskDetail(prev => prev ? {
              ...prev,
              assignedEngineer: eng.name, engineer: eng.name,
              배정기사: eng.name,
              status: '배정', 상태: '배정', state: 'scheduled',
              reassignRequest: null,   // 2026-07-25 — 재배정 요청 목록 잔존 fix
            } : prev);"""

patch(A, [(a1_old, a1_new), (a2_old, a2_new), (a3_old, a3_new)])


# ---------- AdminPcTimelineScreen.jsx : 타임라인 재배정 후 플래그 해제 ----------
T = "src/pages/AdminPcTimelineScreen.jsx"

t1_old = 'import { adminRescheduleTask, adminReassignTask } from "../lib/adminTaskRpc.js";'
t1_new = 'import { adminRescheduleTask, adminReassignTask, clearReassignRequest } from "../lib/adminTaskRpc.js";'

t2_old = """      const msg = isReassign
        ? `${task.customer || "작업"} 재배정 완료 (${newEngineerName} · ${newTime})`
        : `${task.customer || "작업"} 일정 변경 완료 (${newTime})`;"""
t2_new = """      // 2026-07-25 — 타임라인에서 기사를 바꿔도 '재배정 요청' 목록에 남던 버그.
      //   Mig 145 admin_reassign_task 는 기사/일정만 갱신하고
      //   category_data.reassignRequest 는 건드리지 않음 → 여기서 해제.
      //   시간만 끄는 단순 드래그(isReassign=false)에는 적용 X — 잘못 끌었을 때
      //   요청이 소리 없이 사라지면 안 되므로.
      if (isReassign) {
        try {
          const cr = await clearReassignRequest(task.id);
          if (!cr?.ok) console.warn("[clearReassignRequest]", cr?.error);
        } catch (e) {
          console.warn("[clearReassignRequest]", e?.message || e);
        }
      }
      const msg = isReassign
        ? `${task.customer || "작업"} 재배정 완료 (${newEngineerName} · ${newTime})`
        : `${task.customer || "작업"} 일정 변경 완료 (${newTime})`;"""

patch(T, [(t1_old, t1_new), (t2_old, t2_new)])
