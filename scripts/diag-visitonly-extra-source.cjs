// visit_only 2건 측 extra_fee=30K 측 어디 측 측측 측측 — task_changes audit 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const TARGETS = ["A-260603-005","A-260606-006"];
  for (const tn of TARGETS) {
    const { data: t } = await sb.from("tasks").select("id, task_no, completed_at").eq("task_no",tn).maybeSingle();
    console.log(`\n=== ${tn} ${t.task_no} (id=${t.id}) ===`);
    console.log(`  completed_at: ${t.completed_at}`);

    const { data: ch } = await sb.from("task_changes")
      .select("created_at, change_type, before_value, after_value")
      .eq("task_id", t.id)
      .order("created_at", { ascending: true });

    console.log(`  audit ${(ch||[]).length}건:`);
    for (const c of (ch||[])) {
      const before = JSON.stringify(c.before_value)?.slice(0, 100);
      const after  = JSON.stringify(c.after_value)?.slice(0, 100);
      console.log(`    ${c.created_at?.slice(0,19)}  ${c.change_type}`);
      console.log(`      before: ${before}`);
      console.log(`      after:  ${after}`);
    }
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
