// 김현동 최근 측측 (오늘 측측 → 측측 측측)
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const KIM_ID = "77777777-7777-7777-7777-7777777e0011";

(async () => {
  const { data } = await sb.from("tasks")
    .select("task_no, status, scheduled_at, completed_at")
    .eq("assigned_engineer_id", KIM_ID)
    .order("scheduled_at", { ascending: false })
    .limit(15);
  console.log("\n=== 김현동 측측 측측 (scheduled_at desc) ===");
  for (const t of (data||[])) {
    console.log(`  ${t.task_no} ${t.status}  sched=${t.scheduled_at}  done=${t.completed_at || "—"}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
