// 진단 — usol_n 작업 중 assigned_engineer_id IS NULL (read-only)
// "기사 미배정" 기준 카운트 vs 현재 isUsolNActionNeeded 카운트 비교
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const USOL_N_PID = "22222222-2222-2222-2222-222222222006";
const EXCLUDED = ["취소", "완료", "visit_only"];

(async () => {
  // A) 기사 미배정 기준 — assigned_engineer_id IS NULL AND status NOT IN (취소/완료/visit_only)
  const { data: nullEng, error: e1 } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, assigned_engineer_id, scheduled_at, category_data")
    .eq("principal_id", USOL_N_PID)
    .is("assigned_engineer_id", null)
    .not("status", "in", `(${EXCLUDED.join(",")})`)
    .range(0, 999);
  if (e1) { console.error("FATAL A:", e1); process.exit(1); }
  const tasksNull = nullEng || [];
  console.log(`[A] usol_n + assigned_engineer_id IS NULL + status NOT IN (취소,완료,visit_only): ${tasksNull.length}건`);
  const byStatusA = {};
  for (const t of tasksNull) byStatusA[t.status] = (byStatusA[t.status] || 0) + 1;
  console.log("    status 분포:", JSON.stringify(byStatusA));

  // B) 현재 카드 기준 — isUsolNActionNeeded (status IN 미배정/약속대기/배정 OR reassignRequest 있고 활성)
  const { data: actStatus } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, assigned_engineer_id, scheduled_at, category_data")
    .eq("principal_id", USOL_N_PID)
    .in("status", ["미배정", "약속대기", "배정", "확정", "진행중"])
    .range(0, 999);
  const tasksB = actStatus || [];
  const actionNeeded = tasksB.filter(t => {
    if (["취소","완료","visit_only"].includes(t.status)) return false;
    if (["미배정","약속대기","배정"].includes(t.status)) return true;
    const cat = t.category_data || {};
    return !!(cat?.reassignRequest?.requestedAt);
  });
  console.log(`\n[B] 현재 카드(isUsolNActionNeeded): ${actionNeeded.length}건`);
  const byStatusB = {};
  for (const t of actionNeeded) byStatusB[t.status] = (byStatusB[t.status] || 0) + 1;
  console.log("    status 분포:", JSON.stringify(byStatusB));

  // C) 차집합 — A에는 있고 B에는 없는 / B에는 있고 A에는 없는
  const setA = new Set(tasksNull.map(t => t.id));
  const setB = new Set(actionNeeded.map(t => t.id));
  const onlyA = tasksNull.filter(t => !setB.has(t.id));
  const onlyB = actionNeeded.filter(t => !setA.has(t.id));
  console.log(`\n[C] A만(기사 NULL인데 카드 미포함): ${onlyA.length}건  /  B만(카드엔 있는데 기사 배정됨): ${onlyB.length}건`);

  // D) 윤다희 (YS-N-260526-046) 단일 조회 — status / engineer / scheduled_at
  const { data: yd } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, assigned_engineer_id, scheduled_at, category_data")
    .eq("task_no", "YS-N-260526-046");
  console.log(`\n[D] 윤다희 YS-N-260526-046:`);
  for (const t of (yd || [])) {
    console.log(`    status=${t.status} | engineer_id=${t.assigned_engineer_id || "NULL"} | scheduled_at=${t.scheduled_at || "NULL"}`);
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
