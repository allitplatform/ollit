// fetchAllPrincipalTasks (lib/allPrincipalTasksDb.js) 측 실측 측 측.
//   quickFilter='confirmed' (대기 박스 클릭 측 동일 측 측) 측 측 측 측 측 측 측 측 측.
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const USOL_N = "usol_n";
const PAGE = 1000;

(async () => {
  // 6원청 ID
  const { data: pdata } = await sb.from("principals").select("id, code");
  const otherIds = pdata.filter(p => p.code !== USOL_N).map(p => p.id);

  // 정확히 allPrincipalTasksDb 의 SELECT
  const SELECT = `id, task_no, customer_name, phone, address, district,
    status, assignment_type,
    product_price, extra_fee, travel_fee, total_amount,
    category_data, principal_id,
    recommended_engineer_id, assigned_engineer_id,
    requested_date, scheduled_at, started_at, completed_at, received_at,
    work_memo,
    task_items (
      id, qty, unit_price, subtotal, description, order_type,
      work_types ( id, name ),
      appliance_types ( id, name )
    )`;

  console.log("=== quickFilter='confirmed' 측 측 측 측 측 fetch ===\n");
  const { data } = await sb.from("tasks")
    .select(SELECT)
    .in("principal_id", otherIds)
    .eq("status", "확정")
    .order("received_at", { ascending: false })
    .limit(8);

  for (const t of (data || [])) {
    const items = t.task_items || [];
    console.log(`${t.customer_name || "?"} (${t.task_no}): items=${items.length}`);
    for (const it of items) {
      const ap = it.appliance_types?.name || "(null)";
      const wt = it.work_types?.name || "(null)";
      console.log(`   order_type=${it.order_type || "(null)"} appliance=${ap} work_type=${wt}`);
    }
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
