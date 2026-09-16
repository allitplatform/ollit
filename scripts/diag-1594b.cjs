const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
(async () => {
  // principals 측 catch
  const { data: ps } = await sb.from("principals").select("id, code, name");
  console.log("principals:");
  for (const p of (ps || [])) console.log(`  · ${p.code.padEnd(10)} ${p.name} | ${p.id}`);
  
  // 측 catch 김 측 catch (전체 — 측 catch X)
  const { data: all } = await sb.from("tasks").select("id, task_no, customer_name, district, scheduled_at, scheduled_date, requested_date, principal_id").ilike("customer_name", "김%").limit(200);
  console.log(`\n측 김 측 catch 측: ${all?.length || 0}건`);
  for (const k of (all || []).slice(0, 30)) console.log(`  · ${k.task_no} | "${k.customer_name}" | district=${k.district} | scheduled_date=${k.scheduled_date}`);
})();
