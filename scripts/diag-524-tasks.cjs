// 진단 — KST 2026-05-24 scheduled_at task 조회. 수정 X.
const fs = require("fs"), path = require("path");
function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// KST 2026-05-24 00:00 ~ 2026-05-25 00:00
// = UTC 2026-05-23 15:00 ~ 2026-05-24 15:00
const KST_START = "2026-05-23T15:00:00.000Z";
const KST_END   = "2026-05-24T15:00:00.000Z";

(async () => {
  // 사용자/원청 lookup
  const { data: users } = await sb.from("users").select("id, name").eq("tenant_id", "11111111-1111-1111-1111-111111111111");
  const uById = new Map((users || []).map(u => [u.id, u.name]));
  const { data: principals } = await sb.from("principals").select("id, code, name");
  const pById = new Map((principals || []).map(p => [p.id, p.name || p.code]));

  // 5/24 KST task 측 catch
  const { data: tasks, error } = await sb
    .from("tasks")
    .select("id, task_no, customer_name, status, scheduled_at, completed_at, assigned_engineer_id, principal_id")
    .eq("tenant_id", "11111111-1111-1111-1111-111111111111")
    .gte("scheduled_at", KST_START)
    .lt("scheduled_at", KST_END)
    .order("scheduled_at", { ascending: true });

  if (error) { console.log("FATAL:", error.message); return; }

  // payments 측 catch
  const taskIds = (tasks || []).map(t => t.id);
  const { data: pays } = await sb.from("payments").select("task_id").in("task_id", taskIds.length ? taskIds : ["00000000-0000-0000-0000-000000000000"]);
  const payByTask = new Set((pays || []).map(p => p.task_id));

  // 측 catch 측 catch
  const buckets = { done: [], pending: [], cancel: [], unassigned: [] };
  for (const t of (tasks || [])) {
    if (t.status === "취소") buckets.cancel.push(t);
    else if (t.status === "완료") buckets.done.push(t);
    else if (!t.assigned_engineer_id) buckets.unassigned.push(t);
    else if (["확정", "배정", "진행중", "약속대기"].includes(t.status)) buckets.pending.push(t);
    else buckets.pending.push(t); // 측 catch
  }

  function row(t) {
    const eng  = t.assigned_engineer_id ? (uById.get(t.assigned_engineer_id) || "?") : "—";
    const prin = t.principal_id ? (pById.get(t.principal_id) || "?") : "—";
    const comp = t.completed_at ? "○" : "×";
    const pay  = payByTask.has(t.id) ? "○" : "×";
    const sched = (t.scheduled_at || "").slice(0, 16).replace("T", " ");
    return `  ${(t.task_no || "").padEnd(20)} | ${(t.customer_name || "").padEnd(8)} | ${eng.padEnd(6)} | ${prin.padEnd(10)} | ${(t.status || "").padEnd(6)} | comp=${comp} | pay=${pay} | sched=${sched}`;
  }

  console.log("=".repeat(120));
  console.log(`5/24 KST scheduled_at task 진단 — 측 ${(tasks || []).length}건`);
  console.log(`범위: UTC ${KST_START} ~ ${KST_END}  (= KST 2026-05-24 00:00 ~ 2026-05-25 00:00)`);
  console.log("=".repeat(120));

  console.log(`\n【1. 이미 완료】 ${buckets.done.length}건 (그대로 둘 것)`);
  console.log("-".repeat(120));
  buckets.done.forEach(t => console.log(row(t)));

  console.log(`\n【2. 완료 처리 대상】 ${buckets.pending.length}건 (확정/배정/진행중)`);
  console.log("-".repeat(120));
  buckets.pending.forEach(t => console.log(row(t)));

  console.log(`\n【3. 취소】 ${buckets.cancel.length}건 (제외)`);
  console.log("-".repeat(120));
  buckets.cancel.forEach(t => console.log(row(t)));

  console.log(`\n【4. 미배정】 ${buckets.unassigned.length}건 (기사 없음 — 따로 측 catch)`);
  console.log("-".repeat(120));
  buckets.unassigned.forEach(t => console.log(row(t)));

  // 측 catch 측 catch
  console.log("\n" + "=".repeat(120));
  console.log(`측 catch — 측 ${(tasks || []).length}건 | 완료 ${buckets.done.length} | 완료 측 catch ${buckets.pending.length} | 취소 ${buckets.cancel.length} | 미배정 ${buckets.unassigned.length}`);
  console.log("=".repeat(120));
})().catch(e => console.log("FATAL:", e.message, e.stack));
