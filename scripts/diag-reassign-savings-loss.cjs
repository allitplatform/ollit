// 진단 — 재배정 저장 버그로 assigned_engineer_id가 안 바뀐 작업 전수 (read-only)
// 2026-05-26
// 로직:
//   1) task_changes 에서 change_type='engineer' 이력 모두 fetch (changed_at desc)
//   2) task_id별 최신 1건만 추림 — 이력상 "마지막으로 바꾸려던 기사"
//   3) after_data.engineerId(예: 'E004') / engineerName → users.code or users.name → uuid resolve
//   4) tasks.assigned_engineer_id (uuid) 현재값과 비교
//   5) 불일치 작업 모두 출력 + 원청·status 집계
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // [1] users 전체 fetch (resolve용)
  const { data: users } = await sb.from("users").select("id, code, name");
  const byCode = new Map(); // E004 → uuid
  const byName = new Map(); // 김경호 → uuid
  const byId   = new Map(); // uuid → {code, name}
  for (const u of (users || [])) {
    if (u.code) byCode.set(u.code, u.id);
    if (u.name) byName.set(u.name, u.id);
    byId.set(u.id, { code: u.code, name: u.name });
  }

  // [2] principals 전체 (원청별 집계용)
  const { data: principals } = await sb.from("principals").select("id, code, name");
  const principalById = new Map((principals || []).map(p => [p.id, p]));

  // [3] task_changes change_type='engineer' 전체 페이지 루프 fetch
  let changes = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("task_changes")
      .select("task_id, before_data, after_data, note, changed_by_name, changed_at")
      .eq("change_type", "engineer")
      .order("changed_at", { ascending: false })
      .range(from, from + 999);
    if (error) { console.error("[task_changes fetch]", error); break; }
    if (!data || data.length === 0) break;
    changes.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`[task_changes change_type='engineer'] 측 ${changes.length}건`);

  // [4] task_id별 최신 1건만 (changed_at desc 정렬돼 있으니 첫 매칭이 최신)
  const latestByTask = new Map();
  for (const c of changes) {
    if (!latestByTask.has(c.task_id)) latestByTask.set(c.task_id, c);
  }
  console.log(`측 동안 기사 변경 이력 보유 측 ${latestByTask.size}건 측 측`);

  // [4.5] 재배정 시도 분포 — before.engineerName 측 측 측 측 (옛 기사 측 측 측 측 측 측)
  const reassignAttempts = changes.filter(c => {
    const before = c.before_data || {};
    return before.engineerName !== null && before.engineerName !== undefined && before.engineerName !== "";
  });
  console.log(`측 동안 재배정 측 측 측 측 (before.engineerName 측 측 측): ${reassignAttempts.length}건`);

  // 재배정 측 측 측 측 측 측 측 측 측 task_id 측 측 측
  const reassignTaskIds = new Set(reassignAttempts.map(c => c.task_id));
  console.log(`측 동안 측 측 측 측 측 측 측 측 측 측 측: ${reassignTaskIds.size}건`);

  // [5] 해당 task_id들의 현재 tasks 정보 fetch (page loop with .in())
  const taskIds = [...latestByTask.keys()];
  const tasks = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const slice = taskIds.slice(i, i + 200);
    const { data } = await sb.from("tasks")
      .select("id, task_no, customer_name, status, assigned_engineer_id, principal_id, updated_at")
      .in("id", slice);
    if (data) tasks.push(...data);
  }
  const taskById = new Map(tasks.map(t => [t.id, t]));

  // [6] 불일치 추출
  const mismatches = [];
  let debugCount = 0;
  for (const [taskId, change] of latestByTask) {
    const task = taskById.get(taskId);
    if (!task) continue; // task 삭제됐을 수도
    // 디버그: 정민구 케이스 강제 출력
    if (task.task_no === "YS-N-260526-031") {
      console.log("\n[DEBUG 정민구]");
      console.log("  task.assigned_engineer_id:", task.assigned_engineer_id);
      console.log("  change.after_data:", JSON.stringify(change.after_data));
      console.log("  change.changed_at:", change.changed_at);
    }

    const after = change.after_data || {};
    // after_data.engineerId 는 'E004' code 형태 측 측 / engineerName 으로 폴백
    let expectedUuid = null;
    if (after.engineerId) {
      expectedUuid = byCode.get(after.engineerId) || (after.engineerId.length === 36 ? after.engineerId : null);
    }
    if (!expectedUuid && after.engineerName) {
      expectedUuid = byName.get(after.engineerName);
    }
    if (task.task_no === "YS-N-260526-031") {
      console.log("  expectedUuid:", expectedUuid);
      console.log("  byCode.get('E004'):", byCode.get('E004'));
      console.log("  actualUuid:", task.assigned_engineer_id);
    }
    // engineerName 측 null/undefined 이면 "기사 해제" 의도일 수 측 측
    const expectedIsNull = !after.engineerId && (after.engineerName === null || after.engineerName === undefined);

    const actualUuid = task.assigned_engineer_id;

    let isMismatch = false;
    if (expectedIsNull) {
      if (actualUuid !== null) isMismatch = true;
    } else if (expectedUuid) {
      if (actualUuid !== expectedUuid) isMismatch = true;
    } else {
      // resolve 실패 — 자료 측 없음 측 측 측 측 측 측 측 측 측 측 측 측
      // 그래도 후보 보고
      isMismatch = true;
    }

    if (isMismatch) {
      mismatches.push({
        task_no:          task.task_no,
        customer_name:    task.customer_name,
        status:           task.status,
        principal_id:     task.principal_id,
        principal_code:   principalById.get(task.principal_id)?.code || "?",
        principal_name:   principalById.get(task.principal_id)?.name || "?",
        history_after:    after,
        history_changed_at: change.changed_at,
        history_changed_by: change.changed_by_name,
        history_note:     change.note,
        current_uuid:     actualUuid,
        current_engineer: actualUuid ? (byId.get(actualUuid)?.name || "(매핑 X)") : "(미배정)",
        expected_uuid:    expectedUuid,
        expected_engineer: expectedIsNull ? "(해제)" : (after.engineerName || "(?)"),
      });
    }
  }

  // [7] 정렬 — 원청 → 시각
  mismatches.sort((a, b) => {
    if (a.principal_code !== b.principal_code) return a.principal_code.localeCompare(b.principal_code);
    return String(b.history_changed_at).localeCompare(String(a.history_changed_at));
  });

  console.log(`\n[★ 불일치 작업 측 ${mismatches.length}건]\n`);

  // [8] 원청별 + status별 집계
  const byPrincipal = {};
  const byStatus    = {};
  const closedFlag  = { closed: 0, open: 0 }; // 완료/취소 vs 그 외
  for (const m of mismatches) {
    byPrincipal[m.principal_code] = (byPrincipal[m.principal_code] || 0) + 1;
    byStatus[m.status]            = (byStatus[m.status] || 0) + 1;
    if (m.status === "완료" || m.status === "취소") closedFlag.closed++; else closedFlag.open++;
  }

  console.log("[원청별]");
  for (const [k, v] of Object.entries(byPrincipal).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(10)}: ${v}`);
  }
  console.log("\n[status별]");
  for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)}: ${v}`);
  }
  console.log(`\n[정산 영향 측 측 측 측]`);
  console.log(`  완료·취소(정산 측 측 측 측 측 측 측 측 측): ${closedFlag.closed}`);
  console.log(`  진행/배정 측 (측 측 측 측 측 측 측 측 측 측 측 측 측 측 측 측 측 측 측 측 측): ${closedFlag.open}`);

  // [9] 측 측 측 측 측 측 측 측 측 — 측 측 측 측 측 측 측 측 측 측
  const closed = mismatches.filter(m => m.status === "완료" || m.status === "취소");
  const open   = mismatches.filter(m => m.status !== "완료" && m.status !== "취소");

  if (closed.length > 0) {
    console.log(`\n[★★ 완료·취소 측 — ${closed.length}건 (정산 측 측 측 측 측 측 측 측 측 측 측 측 측 측)]`);
    for (const m of closed) {
      console.log(`  ${m.principal_code.padEnd(8)} | ${m.task_no.padEnd(20)} | ${m.status.padEnd(4)} | ${m.customer_name.padEnd(10)} | 측 측 측: ${m.current_engineer.padEnd(8)} | 측 측: ${m.expected_engineer.padEnd(8)} | ${m.history_changed_at.slice(0,19)} | by ${m.history_changed_by || "?"}`);
      if (m.history_note) console.log(`    note: ${m.history_note}`);
    }
  }

  if (open.length > 0) {
    console.log(`\n[측 측 측 측 — ${open.length}건 (배정/진행/확정/약속대기)]`);
    for (const m of open) {
      console.log(`  ${m.principal_code.padEnd(8)} | ${m.task_no.padEnd(20)} | ${m.status.padEnd(4)} | ${m.customer_name.padEnd(10)} | 측 측 측: ${m.current_engineer.padEnd(8)} | 측 측: ${m.expected_engineer.padEnd(8)} | ${m.history_changed_at.slice(0,19)} | by ${m.history_changed_by || "?"}`);
      if (m.history_note) console.log(`    note: ${m.history_note}`);
    }
  }

  // [10] 재배정 시도 측 측 측 작업 5건 — 측 측 측 측 측 측 측 측 측 측 (검증용)
  console.log(`\n[측 측 측 — 재배정 시도가 측 측 측 작업 ${reassignTaskIds.size}건 측 측]`);
  for (const taskId of reassignTaskIds) {
    const task = taskById.get(taskId);
    if (!task) { console.log(`  ${taskId} → task 측 X (삭제)`); continue; }
    const pcode = principalById.get(task.principal_id)?.code || "?";
    const currentName = task.assigned_engineer_id ? (byId.get(task.assigned_engineer_id)?.name || "?") : "(미배정)";
    // 측 작업의 모든 engineer change 측 측 측
    const taskChanges = changes.filter(c => c.task_id === taskId);
    console.log(`\n  ${pcode} ${task.task_no} | ${task.customer_name} | status=${task.status} | 현재 기사: ${currentName}`);
    for (const c of taskChanges) {
      const before = c.before_data || {};
      const after = c.after_data || {};
      console.log(`    ${c.changed_at.slice(0,19)} | ${(before.engineerName ?? "(null)")} → ${after.engineerName || "(?)"} | by ${c.changed_by_name || "?"}${c.note ? ` | note: ${c.note}` : ""}`);
    }
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
