// received_total 측 측 측측 측측 측측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  for (const tn of ["YS-260605-001","A-260605-005","A-260606-006"]) {
    const { data: r } = await sb.from("tasks").select("task_no, status, completed_at, received_total, total_amount, product_price, extra_fee, travel_fee, principal_id, principals:principal_id(code)")
      .eq("task_no", tn).maybeSingle();
    console.log(`\n=== ${tn} ===`);
    console.log(`  principal: ${r.principals?.code}  status: ${r.status}`);
    console.log(`  completed_at: ${r.completed_at}`);
    console.log(`  total=${r.total_amount}  product=${r.product_price}  extra=${r.extra_fee}  travel=${r.travel_fee}`);
    console.log(`  received_total: ${r.received_total === null ? "NULL" : r.received_total}`);
  }

  // 측측 audit (task_changes)
  console.log("\n=== YS-260605-001 측측 task_changes (측측 5건) ===");
  const { data: tk } = await sb.from("tasks").select("id").eq("task_no","YS-260605-001").maybeSingle();
  const { data: ch } = await sb.from("task_changes").select("created_at, change_type, before_value, after_value, actor_id")
    .eq("task_id", tk.id).order("created_at", { ascending: false }).limit(5);
  for (const c of (ch||[])) {
    console.log(`  ${c.created_at?.slice(0,19)}  ${c.change_type}  before=${JSON.stringify(c.before_value)?.slice(0,80)} after=${JSON.stringify(c.after_value)?.slice(0,80)}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
