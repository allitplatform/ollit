// 진단 — usol_n 활성 작업의 status='배정' 원인 추적 (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const USOL_N_PID = "22222222-2222-2222-2222-222222222006";

(async () => {
  // D) status='배정' AND assigned_engineer_id IS NULL — 활성 usol_n
  const { data: dRows } = await sb.from("tasks")
    .select("id, task_no, status, assigned_engineer_id")
    .eq("principal_id", USOL_N_PID)
    .eq("status", "배정")
    .is("assigned_engineer_id", null)
    .range(0, 999);
  console.log(`[D] usol_n + status='배정' + engineer IS NULL: ${(dRows||[]).length}건`);
  for (const r of (dRows||[]).slice(0,5)) console.log(`    ${r.task_no}`);

  // E) 활성 usol_n 58건 — created_at 분포로 import 시점 추정
  const { data: active } = await sb.from("tasks")
    .select("id, task_no, status, assigned_engineer_id, created_at, updated_at, assigned_at, external_order_no")
    .eq("principal_id", USOL_N_PID)
    .in("status", ["미배정","약속대기","배정","확정","진행중"])
    .order("created_at", { ascending: true })
    .range(0, 999);
  const a = active || [];
  console.log(`\n[E] 활성 usol_n 작업: ${a.length}건`);
  if (a.length > 0) {
    console.log(`    가장 오래된: ${a[0].created_at}  (${a[0].task_no})`);
    console.log(`    가장 최근:   ${a[a.length-1].created_at}  (${a[a.length-1].task_no})`);
    // created_at YYYY-MM-DD 별 카운트
    const byDate = {};
    for (const t of a) {
      const d = (t.created_at || "").slice(0,10);
      byDate[d] = (byDate[d] || 0) + 1;
    }
    console.log(`    created_at 일자별:`, JSON.stringify(byDate));
  }

  // F) 최근 created 5건 — status_history 추적
  const { data: recent } = await sb.from("tasks")
    .select("id, task_no, status, created_at, assigned_at, assigned_engineer_id")
    .eq("principal_id", USOL_N_PID)
    .order("created_at", { ascending: false })
    .limit(5);
  console.log(`\n[F] 가장 최근 usol_n 5건 — created_at vs assigned_at:`);
  for (const t of (recent||[])) {
    console.log(`    ${t.task_no} | status=${t.status} | created=${t.created_at} | assigned_at=${t.assigned_at || "NULL"} | eng=${t.assigned_engineer_id ? "있음" : "NULL"}`);
    const { data: hist } = await sb.from("status_history")
      .select("from_status, to_status, changed_at")
      .eq("task_id", t.id)
      .order("changed_at", { ascending: true });
    if (!hist || hist.length === 0) {
      console.log(`        status_history: (없음 — INSERT 시점부터 현재 status 유지)`);
    } else {
      for (const h of hist) console.log(`        ${h.changed_at} | ${h.from_status} → ${h.to_status}`);
    }
  }

  // G) 윤다희 status_history
  const { data: yd } = await sb.from("tasks")
    .select("id, task_no, status, created_at, assigned_at, scheduled_at, assigned_engineer_id")
    .eq("task_no", "YS-N-260526-046")
    .single();
  console.log(`\n[G] 윤다희 YS-N-260526-046:`);
  if (yd) {
    console.log(`    status=${yd.status} | created=${yd.created_at} | assigned_at=${yd.assigned_at} | scheduled=${yd.scheduled_at || "NULL"} | eng=${yd.assigned_engineer_id}`);
    const { data: hist } = await sb.from("status_history")
      .select("from_status, to_status, changed_at, changed_by")
      .eq("task_id", yd.id)
      .order("changed_at", { ascending: true });
    console.log(`    status_history: ${(hist||[]).length}건`);
    for (const h of (hist||[])) console.log(`        ${h.changed_at} | ${h.from_status} → ${h.to_status} | by=${h.changed_by || "?"}`);
  }
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
