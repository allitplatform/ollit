const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // ilike 측 김태원 측 catch — service_role 측 catch 측 catch
  const { data: d1 } = await sb.from("tasks").select("id, task_no, customer_name, scheduled_at, scheduled_date, scheduled_time, requested_date, requested_time, principal_id").or("customer_name.ilike.%김태원%,customer_name.ilike.%김 태원%");
  console.log("김태원 측 catch:", d1?.length || 0);
  for (const r of (d1 || [])) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`task_no: ${r.task_no} | customer: "${r.customer_name}"`);
    console.log(`id: ${r.id}`);
    console.log(`principal_id: ${r.principal_id}`);
    console.log(`scheduled_at: ${r.scheduled_at}`);
    console.log(`scheduled_date: ${r.scheduled_date}`);
    console.log(`requested_date: ${r.requested_date}`);
  }

  // task_no 측 catch \d{6}- 측 catch "?15-94" 측 X 측 X — task_no 측 catch "151594" 측 catch
  console.log("\n\n측 task_no 측 catch \d{6} = ABCXYZ 측 catch CD='15', EF='94' 측 X catch 측 catch:");
  const { data: all } = await sb.from("tasks").select("task_no, customer_name").limit(2000);
  const weird = (all || []).filter(r => {
    const m = String(r.task_no || "").match(/(\d{6})-/);
    if (!m) return false;
    const yymmdd = m[1];
    return yymmdd.slice(2, 4) === "15" && yymmdd.slice(4, 6) === "94";
  });
  console.log(`측 catch: ${weird.length}건`);
  for (const w of weird.slice(0, 10)) console.log(`  · ${w.task_no} | ${w.customer_name}`);
})();
