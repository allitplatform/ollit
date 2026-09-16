// KA + crikrin 테스트 작업 7건 삭제 — 안현생(CK-260604-001) 만 남김.
// 1) 명시적 task_no 7개 → id 조회 (안현생 포함 시 abort)
// 2) 백업 JSON (tasks/task_items/payments/photos/task_changes/status_history/task_assignments) 저장
// 3) DELETE FROM tasks WHERE id IN (...) — CASCADE
// 4) orphan 0 검증
// 5) 남은 KA/crikrin 작업 카운트
//
// 실행: node scripts/cleanup-ka-crikrin-delete.cjs

const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname,"..",".env"));
L(path.join(__dirname,"..",".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const DELETE_TASK_NOS = [
  "A-260606-001",
  "A-260605-007",
  "CK-260603-001",
  "CK-260529-001",
  "CK-260527-001",
  "CK-260524-001",
  "CK-260522-001",
];
const KEEP_TASK_NO = "CK-260604-001";  // 안현생 — 절대 삭제 X

(async () => {
  console.log("=== 1. 삭제 대상 id 조회 ===");
  const { data: tasks, error } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, principal_id")
    .in("task_no", DELETE_TASK_NOS);
  if (error) { console.error("tasks 조회:", error); process.exit(1); }
  if (tasks.length !== DELETE_TASK_NOS.length) {
    console.error(`예상 ${DELETE_TASK_NOS.length}건, 실제 ${tasks.length}건 — abort`);
    console.error("실제 조회된 task_no:", tasks.map(t => t.task_no));
    process.exit(1);
  }
  // 안현생 포함 검증
  const hasKeep = tasks.some(t => t.task_no === KEEP_TASK_NO);
  if (hasKeep) {
    console.error(`⚠️ 삭제 대상에 ${KEEP_TASK_NO} 포함됨 — abort`);
    process.exit(1);
  }
  const ids = tasks.map(t => t.id);
  console.log(`  ${tasks.length}건 확인 (안현생 미포함 ✓)`);
  tasks.forEach(t => console.log(`    ${t.task_no} ${t.customer_name} ${t.status}`));

  console.log("\n=== 2. 의존 데이터 fetch (백업용) ===");
  const [taskItems, payments, photos, taskChanges, statusHistory, taskAssignments] = await Promise.all([
    sb.from("task_items").select("*").in("task_id", ids),
    sb.from("payments").select("*").in("task_id", ids),
    sb.from("photos").select("*").in("task_id", ids),
    sb.from("task_changes_audit_log").select("*").in("task_id", ids).then(r => r.error ? { data: [], error: null } : r),
    sb.from("task_status_history").select("*").in("task_id", ids).then(r => r.error ? { data: [], error: null } : r),
    sb.from("task_assignments").select("*").in("task_id", ids).then(r => r.error ? { data: [], error: null } : r),
  ]);
  console.log(`  task_items: ${taskItems.data?.length || 0}`);
  console.log(`  payments  : ${payments.data?.length || 0}`);
  console.log(`  photos    : ${photos.data?.length || 0}`);
  console.log(`  task_changes_audit_log: ${taskChanges.data?.length || 0}`);
  console.log(`  task_status_history: ${statusHistory.data?.length || 0}`);
  console.log(`  task_assignments: ${taskAssignments.data?.length || 0}`);

  console.log("\n=== 3. 백업 JSON 저장 ===");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = path.join(__dirname, "..", "backups", `crikrin-ka-delete-backup-${ts}.json`);
  const backup = {
    backup_at: new Date().toISOString(),
    deleted_task_nos: DELETE_TASK_NOS,
    kept: KEEP_TASK_NO,
    tasks,
    task_items: taskItems.data || [],
    payments: payments.data || [],
    photos: photos.data || [],
    task_changes: taskChanges.data || [],
    status_history: statusHistory.data || [],
    task_assignments: taskAssignments.data || [],
    counts: {
      tasks: tasks.length,
      task_items: taskItems.data?.length || 0,
      payments: payments.data?.length || 0,
      photos: photos.data?.length || 0,
      task_changes: taskChanges.data?.length || 0,
      status_history: statusHistory.data?.length || 0,
      task_assignments: taskAssignments.data?.length || 0,
    },
  };
  if (!fs.existsSync(path.join(__dirname, "..", "backups"))) {
    fs.mkdirSync(path.join(__dirname, "..", "backups"), { recursive: true });
  }
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");
  const sz = fs.statSync(backupPath).size;
  console.log(`  ${backupPath}`);
  console.log(`  크기 ${(sz/1024).toFixed(1)} KB`);

  console.log("\n=== 4. DELETE (CASCADE) ===");
  const { error: delErr, count: delCount } = await sb.from("tasks")
    .delete({ count: "exact" })
    .in("id", ids);
  if (delErr) { console.error("DELETE 실패:", delErr); process.exit(1); }
  console.log(`  tasks 삭제: ${delCount}건`);

  console.log("\n=== 5. orphan 검증 ===");
  const [orphItems, orphPays, orphPhotos] = await Promise.all([
    sb.from("task_items").select("id", { count: "exact", head: true }).in("task_id", ids),
    sb.from("payments").select("id", { count: "exact", head: true }).in("task_id", ids),
    sb.from("photos").select("id", { count: "exact", head: true }).in("task_id", ids),
  ]);
  console.log(`  task_items orphan: ${orphItems.count}`);
  console.log(`  payments  orphan: ${orphPays.count}`);
  console.log(`  photos    orphan: ${orphPhotos.count}`);
  const totalOrphan = (orphItems.count || 0) + (orphPays.count || 0) + (orphPhotos.count || 0);
  if (totalOrphan > 0) console.error("⚠️ orphan 발생!");
  else console.log("  ✓ orphan 0 — CASCADE 정상");

  console.log("\n=== 6. 남은 KA/crikrin 작업 ===");
  const { data: ps } = await sb.from("principals").select("id, code").in("code", ["KA", "crikrin"]);
  const principalIds = ps.map(p => p.id);
  const { data: remain } = await sb.from("tasks")
    .select("task_no, customer_name, status")
    .in("principal_id", principalIds);
  console.log(`  남은 작업: ${remain.length}건`);
  remain.forEach(t => console.log(`    ${t.task_no} ${t.customer_name} ${t.status}`));

  if (remain.length === 1 && remain[0].task_no === KEEP_TASK_NO) {
    console.log("\n✅ 정상 — 안현생 1건만 남음.");
  } else {
    console.log("\n⚠️ 예상과 다름 — 확인 필요.");
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
