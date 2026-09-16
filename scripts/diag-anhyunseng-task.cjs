// 원청(anon) 측 안현생(CK-260604-001) task 가져와 task_items/work_types/appliance_types
// embed 가 실제로 뜨는지 확인.
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname,"..",".env"));
L(path.join(__dirname,"..",".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SELECT = `
  *,
  principal_rel:principals!principal_id ( code, name ),
  task_items (
    id, qty, unit_price, subtotal,
    order_type, product_order_id,
    is_canceled, canceled_reason, canceled_at, received_amount,
    work_types ( id, name, service_types ( id, code ) ),
    appliance_types ( id, name )
  )
`;

async function fetchWith(label, key) {
  const sb = createClient(URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await sb.from("tasks").select(SELECT).eq("task_no", "CK-260604-001").maybeSingle();
  console.log(`\n=== ${label} ===`);
  if (error) { console.log("  error:", error.message); return; }
  if (!data) { console.log("  not found"); return; }
  console.log("  task_no:", data.task_no, "/ customer:", data.customer_name);
  console.log("  status:", data.status, "/ principal_id:", data.principal_id);
  console.log("  category_data.workItems:", JSON.stringify((data.category_data?.workItems || []).map(w => ({ workType: w.workType, appliance: w.appliance, orderType: w.orderType })), null, 2));
  console.log("  task_items (raw embed):");
  (data.task_items || []).forEach((it, i) => {
    console.log(`    [${i}]`);
    console.log(`      order_type    : ${JSON.stringify(it.order_type)}`);
    console.log(`      qty           : ${it.qty}`);
    console.log(`      work_types    : ${JSON.stringify(it.work_types)}`);
    console.log(`      appliance_types: ${JSON.stringify(it.appliance_types)}`);
  });
}

(async () => {
  if (SERVICE) await fetchWith("SERVICE ROLE (RLS 우회)", SERVICE);
  if (ANON)    await fetchWith("ANON (원청 PWA 와 동일 RLS)", ANON);
  else         console.log("\nVITE_SUPABASE_ANON_KEY 미설정 — .env 측 확인");
})().catch(e => { console.error("FATAL", e); process.exit(1); });
