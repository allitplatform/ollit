// visit_only 2건 task_items + 측측 측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  for (const tn of ["A-260603-005","A-260606-006"]) {
    const { data: t } = await sb.from("tasks").select(`id, task_no, received_at, completed_at, updated_at, category_data,
             principals:principal_id(code),
             task_items(*, work_types(name, service_types(code)), appliance_types(name))`)
      .eq("task_no", tn).maybeSingle();
    console.log(`\n=== ${tn} (${t.principals?.code}) ===`);
    console.log(`  received_at:  ${t.received_at}`);
    console.log(`  completed_at: ${t.completed_at}`);
    console.log(`  updated_at:   ${t.updated_at}`);
    console.log(`  category_data 측측 키: ${Object.keys(t.category_data||{}).join(", ")}`);
    console.log(`  task_items 측 ${(t.task_items||[]).length}측:`);
    for (const it of (t.task_items||[])) {
      console.log(`    work_type=${it.work_types?.name} service=${it.work_types?.service_types?.code} appliance=${it.appliance_types?.name || "(NULL)"} qty=${it.qty} unit=${it.unit_price} subtotal=${it.subtotal} received=${it.received_amount} order_type=${it.order_type}`);
    }
  }

  // 측측 측측 측 visit_only NOT extra_fee>0 측측 (정상)
  console.log(`\n=== 측측 — 측측 visit_only (extra_fee=0): 측측 ===`);
  const { data: normalVisit } = await sb.from("tasks")
    .select(`task_no, completed_at, product_price, extra_fee, travel_fee, total_amount, principals:principal_id(code)`)
    .eq("status","visit_only").eq("extra_fee", 0).limit(5);
  for (const t of (normalVisit||[])) {
    console.log(`  ${t.task_no} (${t.principals?.code}) ${t.completed_at?.slice(0,16)}: product=${t.product_price} extra=${t.extra_fee} travel=${t.travel_fee} total=${t.total_amount}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
