// 카운트박스 quickFilter 측 vs 전체 측 한 측 측 task_items 측 측 측 측 측.
//   "전체" 측 appliance 정상, quickFilter 측 (—) — 측 측 측 측 측 측.
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const SELECT = `id, task_no, customer_name, district,
  status,
  task_items (
    id, qty, unit_price, subtotal, description, order_type,
    work_types ( id, name ),
    appliance_types ( id, name )
  )`;

(async () => {
  // 1) confirmed status (대기 박스 클릭 시) 측 측 측
  const { data: confirmed } = await sb.from("tasks")
    .select(SELECT)
    .eq("status", "확정")
    .order("received_at", { ascending: false })
    .limit(8);

  console.log("\n=== status='확정' (대기 박스) ===");
  for (const t of (confirmed || [])) {
    const items = t.task_items || [];
    console.log(`  ${t.customer_name} / ${t.task_no}: items=${items.length}`);
    for (const it of items) {
      const ap = it.appliance_types?.name || "?";
      const wt = it.work_types?.name || "?";
      console.log(`    [${it.order_type || "?"}] ${ap} × ${it.qty} (work_type=${wt})`);
    }
  }

  // 2) 측 측 측 fetch — 측 측 측 측 측 측 측 측 측 측 측?
  console.log("\n=== 전체 (status 측 측) — 측 측 측 측 측 측 측 ===");
  const { data: all } = await sb.from("tasks")
    .select(SELECT)
    .eq("status", "확정")
    .limit(2);
  console.log(JSON.stringify(all?.[0]?.task_items, null, 2));
})().catch(e => { console.error("FATAL", e); process.exit(1); });
