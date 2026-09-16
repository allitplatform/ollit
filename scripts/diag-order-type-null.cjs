const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const USOL_N = "22222222-2222-2222-2222-222222222006";
(async () => {
  const { data: tIds } = await sb.from("tasks").select("id").eq("principal_id", USOL_N);
  const ids = (tIds || []).map(t => t.id);
  let dist = {};
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from("task_items").select("order_type").in("task_id", ids.slice(i, i + 200));
    for (const r of (data || [])) dist[r.order_type || "(NULL)"] = (dist[r.order_type || "(NULL)"] || 0) + 1;
  }
  console.log("usol_n task_items order_type 분포:");
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) console.log(`  · ${k}: ${v}건`);
})();
