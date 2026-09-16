// 진단 — YS-N-260526-046 윤다희 + usol_n 측 catch assigned_engineer_id NULL 측 catch (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const USOL_N_PID = "22222222-2222-2222-2222-222222222006";

(async () => {
  // B. 윤다희 YS-N-260526-046
  const { data: yd } = await sb.from("tasks")
    .select("task_no, customer_name, status, assigned_engineer_id, scheduled_at, started_at, completed_at, received_at, category_data")
    .eq("task_no", "YS-N-260526-046")
    .maybeSingle();
  if (yd) {
    console.log("[B. YS-N-260526-046 윤다희]");
    console.log("  customer_name        :", yd.customer_name);
    console.log("  status               :", yd.status);
    console.log("  assigned_engineer_id :", yd.assigned_engineer_id);
    console.log("  scheduled_at         :", yd.scheduled_at);
    console.log("  started_at           :", yd.started_at);
    console.log("  completed_at         :", yd.completed_at);
    console.log("  received_at          :", yd.received_at);
    // engineer name
    if (yd.assigned_engineer_id) {
      const { data: u } = await sb.from("users").select("code, name").eq("id", yd.assigned_engineer_id).maybeSingle();
      console.log("  engineer             :", u ? `${u.code} ${u.name}` : "(측 catch 측 X)");
    }
  } else {
    console.log("[B] task 측 X");
  }

  // D. usol_n 측 catch assigned_engineer_id NULL
  let rows = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("tasks")
      .select("task_no, status, assigned_engineer_id")
      .eq("principal_id", USOL_N_PID)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const noEngineer = rows.filter(r => !r.assigned_engineer_id);
  console.log(`\n[D. usol_n 측 catch assigned_engineer_id IS NULL] ${noEngineer.length}건 (전체 ${rows.length}건 측 catch)`);
  const dist = {};
  for (const r of noEngineer) dist[r.status] = (dist[r.status] || 0) + 1;
  for (const [k, v] of Object.entries(dist).sort((a,b)=>b[1]-a[1])) {
    console.log(`  ${k.padEnd(15)}: ${v}`);
  }
  if (noEngineer.length > 0 && noEngineer.length <= 10) {
    console.log("\n  측 catch:");
    for (const r of noEngineer) console.log(`    ${r.task_no} | ${r.status}`);
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
