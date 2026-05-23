// 유솔 데이터 인벤토리 진단 — 수정 X
const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const USOL_H = "22222222-2222-2222-2222-222222222005";
const USOL_N = "22222222-2222-2222-2222-222222222006";

(async () => {
  // [1] usol_h / usol_n task count + status
  console.log(`${"=".repeat(85)}\n[1] tasks — usol_h / usol_n 측 + status 분포\n${"=".repeat(85)}\n`);
  for (const [name, pid] of [["usol_h", USOL_H], ["usol_n", USOL_N]]) {
    const { data: tasks, count } = await sb.from("tasks").select("status", { count: "exact" }).eq("tenant_id", TENANT_ID).eq("principal_id", pid);
    const dist = {};
    for (const t of (tasks || [])) dist[t.status || "(빈)"] = (dist[t.status || "(빈)"] || 0) + 1;
    console.log(`  ${name} (${pid.slice(-3)}): ${count}건`);
    for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) console.log(`    · ${k}: ${v}건`);
  }

  // [2] 측 테이블 측 측 측 — tasks / task_items / payments / 측 측
  console.log(`\n${"=".repeat(85)}\n[2] 측 테이블 측 측 (전체 / 측 / usol 측)\n${"=".repeat(85)}\n`);
  const tables = ["tasks", "task_items", "payments", "status_history", "engineer_remittances", "push_candidates", "push_subscriptions", "users", "user_roles", "principals", "commission_policies"];
  for (const t of tables) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    if (error) console.log(`  · ${t}: 측 측 X (${error.message?.slice(0, 50)})`);
    else console.log(`  · ${t}: ${count}건`);
  }

  // usol task_items / payments 측 측 catch
  console.log(`\n  [usol_h + usol_n 측 측]`);
  for (const [name, pid] of [["usol_h", USOL_H], ["usol_n", USOL_N]]) {
    const { data: tIds } = await sb.from("tasks").select("id").eq("tenant_id", TENANT_ID).eq("principal_id", pid);
    const ids = (tIds || []).map(t => t.id);
    let itemCnt = 0, payCnt = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { count: ic } = await sb.from("task_items").select("*", { count: "exact", head: true }).in("task_id", chunk);
      const { count: pc } = await sb.from("payments").select("*", { count: "exact", head: true }).in("task_id", chunk);
      itemCnt += ic || 0; payCnt += pc || 0;
    }
    console.log(`  · ${name} — task: ${ids.length} / task_items: ${itemCnt} / payments: ${payCnt}`);
  }

  // [3] 백업 측 테이블 (pg_tables 측 직접 측 X 측 측, 측 측 측 측 측 측 catch)
  console.log(`\n${"=".repeat(85)}\n[3] 백업 측 테이블 측\n${"=".repeat(85)}\n`);
  const backupNames = ["tasks_backup", "tasks_snapshot", "tasks_archive", "usol_backup", "usol_n_backup", "task_items_backup", "task_items_snapshot", "backup_tasks", "snapshot_tasks"];
  for (const n of backupNames) {
    const { count, error } = await sb.from(n).select("*", { count: "exact", head: true });
    if (error) {
      if (error.message?.includes("does not exist") || error.code === "PGRST205") {
        /* 측 측 X — 측 X */
      } else {
        console.log(`  · ${n}: err=${error.message?.slice(0, 60)}`);
      }
    } else console.log(`  · ${n}: ${count}건 ⚠️ 측 측`);
  }
  console.log(`  → 측 측 측 측 X (Supabase Studio 측 측 측 측 측 측 측 X — service_role 측 측 측 측 측 측)`);

  // [4] 정산 이력
  console.log(`\n${"=".repeat(85)}\n[4] 정산 측 (payments + task_items 측 측)\n${"=".repeat(85)}\n`);
  for (const [name, pid] of [["usol_h", USOL_H], ["usol_n", USOL_N]]) {
    const { data: tIds } = await sb.from("tasks").select("id").eq("tenant_id", TENANT_ID).eq("principal_id", pid);
    const ids = (tIds || []).map(t => t.id);
    let naverCnt = 0, companyCnt = 0, engineerCnt = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { count: nc } = await sb.from("task_items").select("*", { count: "exact", head: true }).in("task_id", chunk).not("naver_settled_at", "is", null);
      const { count: cc } = await sb.from("task_items").select("*", { count: "exact", head: true }).in("task_id", chunk).not("company_received_at", "is", null);
      const { count: ec } = await sb.from("task_items").select("*", { count: "exact", head: true }).in("task_id", chunk).not("engineer_settled_at", "is", null);
      naverCnt += nc || 0; companyCnt += cc || 0; engineerCnt += ec || 0;
    }
    console.log(`  ${name}:`);
    console.log(`    · naver_settled_at measurement: ${naverCnt}건`);
    console.log(`    · company_received_at measurement: ${companyCnt}건`);
    console.log(`    · engineer_settled_at measurement: ${engineerCnt}건`);
  }

  // [5] created_at 범위
  console.log(`\n${"=".repeat(85)}\n[5] created_at 범위\n${"=".repeat(85)}\n`);
  for (const [name, pid] of [["usol_h", USOL_H], ["usol_n", USOL_N]]) {
    const { data: minRow } = await sb.from("tasks").select("created_at").eq("tenant_id", TENANT_ID).eq("principal_id", pid).order("created_at", { ascending: true }).limit(1).maybeSingle();
    const { data: maxRow } = await sb.from("tasks").select("created_at").eq("tenant_id", TENANT_ID).eq("principal_id", pid).order("created_at", { ascending: false }).limit(1).maybeSingle();
    console.log(`  ${name}: min=${minRow?.created_at} | max=${maxRow?.created_at}`);
  }
})();
