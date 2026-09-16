// 진단 — UsolNAssignList 측 측 측 측 측 측 측 측 측 (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const USOL_N_PID = "22222222-2222-2222-2222-222222222006";

(async () => {
  // UsolNAssignList fetch range
  const { data: rows } = await sb.from("tasks")
    .select("task_no, customer_name, status, assigned_engineer_id, scheduled_at, category_data")
    .eq("principal_id", USOL_N_PID)
    .in("status", ["미배정", "약속대기", "배정"])
    .order("received_at", { ascending: false })
    .limit(20);

  // 측 catch 측 catch 측 catch
  const engineerIds = [...new Set((rows || []).map(r => r.assigned_engineer_id).filter(Boolean))];
  const { data: users } = await sb.from("users").select("id, code, name").in("id", engineerIds);
  const userMap = new Map((users || []).map(u => [u.id, u]));

  console.log(`[UsolNAssignList 측 catch range — usol_n status IN ['미배정','약속대기','배정']] ${(rows || []).length}건\n`);

  let withEng = 0, withoutEng = 0, needSchedule = 0;
  for (const r of (rows || [])) {
    const eng = r.assigned_engineer_id ? userMap.get(r.assigned_engineer_id) : null;
    const needSched = r.status === "배정" && !r.scheduled_at;
    if (r.assigned_engineer_id) withEng++; else withoutEng++;
    if (needSched) needSchedule++;
    console.log(`  ${r.task_no} | ${r.customer_name} | status=${r.status} | sched=${r.scheduled_at ? "✓" : "—"} | eng=${eng ? `${eng.code} ${eng.name}` : "(미배정)"}`);
  }

  console.log(`\n[측 catch]`);
  console.log(`  측 측 측 측 측 측 측 측 (eng 측 X)        : ${withoutEng}`);
  console.log(`  측 측 측 측 측 측 측 측 측 X (일정 협의): ${needSchedule}`);
  console.log(`  측 측 측 측 측 측 측 측 측 measurement (task_items.assigned_engineer_id 측 X): ${withEng - needSchedule}`);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
