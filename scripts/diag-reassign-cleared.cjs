// 진단 — 재배정 처리 후 category_data.reassignRequest 키 잔존 여부 (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 1) reassignRequest 키 가진 모든 task — service_role 측 catch 측 catch fetch 측 in-memory filter
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("tasks")
      .select("task_no, customer_name, status, assigned_engineer_id, category_data, updated_at")
      .not("category_data", "is", null)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const withReassign = rows.filter(r => r.category_data && r.category_data.reassignRequest);

  console.log(`[reassignRequest 키 측 catch task] ${withReassign.length}건\n`);
  for (const r of withReassign) {
    const req = r.category_data.reassignRequest;
    const eng = String(r.assigned_engineer_id || "").slice(0, 8);
    console.log(`  ${r.task_no} | ${r.customer_name} | status=${r.status} | eng=${eng} | updated=${r.updated_at}`);
    console.log(`    reassignRequest: reason="${req.reason}" requestedAt=${req.requestedAt}`);
  }

  // 2) 사장님 측 catch 4건 측 catch 측 catch — customer_name 매칭
  console.log("\n[4건 측 catch 측 catch — customer_name 매칭]");
  const targets = ["영등포 벽걸이", "안솔미", "박길현", "조헌준"];
  for (const name of targets) {
    const matched = rows.filter(r => String(r.customer_name || "").includes(name));
    console.log(`  ${name}: ${matched.length}건`);
    for (const r of matched) {
      const hasReassign = !!(r.category_data && r.category_data.reassignRequest);
      console.log(`    ${r.task_no} | status=${r.status} | eng=${String(r.assigned_engineer_id||"").slice(0,8)} | reassignRequest=${hasReassign ? "★남음" : "지워짐"} | updated=${r.updated_at}`);
    }
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
