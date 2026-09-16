// 진단 — 3건 task category_data 측 catch reassignRequest 잔존 여부 (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const { data } = await sb.from("tasks")
    .select("task_no, customer_name, status, assigned_engineer_id, category_data, updated_at")
    .in("task_no", ["YS-260516-044", "YS-260424-114", "YS-260516-134", "YS-260517-096"]);
  for (const r of (data || [])) {
    const hasReassign = !!(r.category_data && r.category_data.reassignRequest);
    const eng = String(r.assigned_engineer_id || "").slice(0, 8);
    console.log(`${r.task_no} | ${r.customer_name} | status=${r.status} | eng=${eng} | reassignRequest=${hasReassign ? "★남음" : "지워짐"} | updated=${r.updated_at}`);
    if (hasReassign) console.log(`  reason=${r.category_data.reassignRequest.reason}`);
  }

  // 김영수 user 확인
  console.log("\n[김영수 user lookup]");
  const { data: users } = await sb.from("users").select("id, code, name").ilike("name", "%김영수%").limit(5);
  for (const u of (users || [])) console.log(`  ${u.code} ${u.name} (${u.id.slice(0,8)})`);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
