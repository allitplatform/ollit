// 진단 — 재배정 요청 + 취소요청 task 현황 (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 1) status='취소요청' / '재배정요청' task
  const { data: statusRows } = await sb.from("tasks")
    .select("task_no, status, assigned_engineer_id, category_data, updated_at")
    .in("status", ["취소요청", "재배정요청"])
    .order("updated_at", { ascending: false })
    .limit(20);
  console.log("[1] status IN ('취소요청','재배정요청'):", (statusRows || []).length, "건");
  for (const r of (statusRows || [])) {
    console.log(`  ${r.task_no} | ${r.status} | engineer=${(r.assigned_engineer_id||"").slice(0,8)} | updated=${r.updated_at}`);
    console.log(`    category_data:`, JSON.stringify(r.category_data));
  }

  // 2) category_data 측 reassignRequest 키 측 catch task — status 측 측 X
  //    (Mig 056 spec: status 변경 X, category_data.reassignRequest 측 catch 측 catch)
  //    PostgREST 측 catch jsonb ? 연산자 측 X 측 catch — service_role 측 catch service 측 catch raw SQL 측 측 catch X.
  //    측 catch 측 catch range 측 catch 측 catch 측 catch.
  console.log("\n[2] category_data.reassignRequest 측 catch task (전체 fetch 측 catch in-memory filter):");
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data: page } = await sb.from("tasks")
      .select("task_no, status, assigned_engineer_id, category_data, updated_at")
      .not("category_data", "is", null)
      .range(from, from + 999);
    if (!page || page.length === 0) break;
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const withReassign = rows.filter(r => r.category_data && r.category_data.reassignRequest);
  console.log(`  측 catch ${rows.length}건 측 catch, reassignRequest 측 catch ${withReassign.length}건`);
  for (const r of withReassign.slice(0, 20)) {
    const req = r.category_data.reassignRequest;
    console.log(`  ${r.task_no} | status=${r.status} | engineer=${(r.assigned_engineer_id||"").slice(0,8)} | requestedAt=${req.requestedAt}`);
    console.log(`    reason: ${req.reason}`);
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
