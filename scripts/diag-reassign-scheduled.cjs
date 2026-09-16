// 진단 — reassignRequest 측 catch task 측 catch scheduled_at + status (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("tasks")
      .select("task_no, customer_name, status, assigned_engineer_id, scheduled_at, requested_date, requested_time, category_data, updated_at")
      .not("category_data", "is", null)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const withReassign = rows.filter(r => r.category_data && r.category_data.reassignRequest);
  console.log(`[reassignRequest 측 catch task] ${withReassign.length}건\n`);
  for (const r of withReassign) {
    const sched = r.scheduled_at === null ? "(NULL)" : r.scheduled_at;
    const reqD = r.requested_date || "—";
    const reqT = r.requested_time || "—";
    console.log(`  ${r.task_no} | ${r.customer_name} | status=${r.status} | scheduled_at=${sched}`);
    console.log(`    requested_date=${reqD} / requested_time=${reqT}`);
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
