// 진단 — 측 catch tasks status distinct + 측 catch (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const dist = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("tasks").select("status").range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const r of data) dist[r.status] = (dist[r.status] || 0) + 1;
    if (data.length < 1000) break;
  }
  console.log("[tasks status distinct]");
  for (const [k, v] of Object.entries(dist).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${k.padEnd(15)}: ${v}`);
  }

  // 안솔미 / 박길현 측 catch — 측 측 측 catch
  console.log("\n[2건 정정 후 측 catch]");
  const { data: t2 } = await sb.from("tasks")
    .select("task_no, customer_name, status, scheduled_at, category_data, updated_at")
    .in("task_no", ["YS-260517-096", "YS-260516-044"]);
  for (const r of (t2 || [])) {
    const reassign = !!(r.category_data && r.category_data.reassignRequest);
    console.log(`  ${r.task_no} | ${r.customer_name} | status=${r.status} | scheduled_at=${r.scheduled_at || "NULL"} | reassignRequest=${reassign ? "★남음" : "지워짐"}`);
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
