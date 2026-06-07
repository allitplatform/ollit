// SELECT only — category_data, task_items, task_changes 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 남양주 task
  const { data: t } = await sb.from("tasks")
    .select("id, task_no, status, category_data, principal_id, principals:principal_id(code, name)")
    .eq("task_no","YS-260605-001").maybeSingle();
  console.log("\n=== YS-260605-001 category_data ===");
  console.log("  principal:", t.principals?.code);
  console.log("  category_data:", JSON.stringify(t.category_data, null, 2));

  // 측측 측측측: A-260605-005, A-260606-006
  for (const tn of ["A-260605-005","A-260606-006"]) {
    const { data: tk } = await sb.from("tasks")
      .select("task_no, status, category_data, principals:principal_id(code)")
      .eq("task_no", tn).maybeSingle();
    console.log(`\n=== ${tn} category_data ===`);
    console.log("  principal:", tk.principals?.code);
    console.log("  status:", tk.status);
    console.log("  category_data:", JSON.stringify(tk.category_data, null, 2)?.slice(0, 300));
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
