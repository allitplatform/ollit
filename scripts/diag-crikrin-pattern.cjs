// crikrin 전건 — product_price=0 + extra_fee>0 패턴 검출 (= 강남구6429 동일 비정상 접수)
const fs = require("fs"), path = require("path");
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  // crikrin principal id
  const { data: prin } = await sb.from("principals").select("id").eq("code", "crikrin").single();

  // crikrin 전건
  const { data: tasks } = await sb.from("tasks")
    .select("id, task_no, status, customer_name, address, product_price, extra_fee, travel_fee, created_at, category_data, assigned_engineer_id")
    .eq("principal_id", prin.id)
    .order("created_at", { ascending: false });

  console.log(`=`.repeat(95));
  console.log(`crikrin 전건: ${tasks?.length || 0}건`);
  console.log(`=`.repeat(95));

  // 패턴 1: product_price=0 + extra_fee>0
  const pat1 = (tasks || []).filter(t => Number(t.product_price) === 0 && Number(t.extra_fee) > 0);
  console.log(`\n[패턴 1] product_price=0 + extra_fee>0: ${pat1.length}건`);

  // 측 task 측 task_items + payments 측 측 측
  for (const t of pat1) {
    const { data: items } = await sb.from("task_items").select("id, qty, unit_price, subtotal, received_amount, appliance_type_id, work_type_id, is_canceled").eq("task_id", t.id);
    const { data: pays } = await sb.from("payments").select("engineer_amount, principal_amount, owner_amount, calc_method, policy_key").eq("task_id", t.id);
    const active = (items || []).filter(it => !it.is_canceled);
    console.log(`\n  · ${t.task_no} ${t.customer_name} ${t.status}  created=${t.created_at?.slice(0,10)}`);
    console.log(`    addr=${t.address}`);
    console.log(`    product=${t.product_price} extra=${t.extra_fee} travel=${t.travel_fee}`);
    console.log(`    task_items active=${active.length}건, 전건=${items?.length || 0}건`);
    for (const it of active) {
      console.log(`      qty=${it.qty} unit_price=${it.unit_price} subtotal=${it.subtotal} received=${it.received_amount} appliance_id=${it.appliance_type_id}`);
    }
    if (pays && pays.length) {
      for (const p of pays) {
        console.log(`    payment: eng=${p.engineer_amount} prin=${p.principal_amount} own=${p.owner_amount} calc=${p.calc_method} key=${p.policy_key}`);
      }
    } else {
      console.log(`    payment: (없음)`);
    }
    // category_data.workItems 측 quote 확인
    const wi = t.category_data?.workItems?.[0];
    if (wi) console.log(`    cat.workItems[0]: workType=${wi.workType} appliance=${wi.appliance || '(빈값)'} qty=${wi.qty} quote=${wi.quote || '(없음)'}`);
  }

  // 패턴 2: 측 task_items.unit_price=0 + 측 task.product_price>0 (정합 깨짐 — 측 측 측)
  console.log(`\n` + `=`.repeat(95));
  console.log(`[패턴 2] task_items.unit_price=0 + 측 task.product_price>0 측 측 측 (정합 측 측)`);
  console.log(`=`.repeat(95));
  let pat2Count = 0;
  for (const t of (tasks || [])) {
    const { data: items } = await sb.from("task_items").select("qty, unit_price, subtotal, is_canceled").eq("task_id", t.id);
    const active = (items || []).filter(it => !it.is_canceled);
    if (active.length === 0) continue;
    const allZeroUnit = active.every(it => Number(it.unit_price || 0) === 0);
    if (allZeroUnit && (Number(t.product_price) > 0 || Number(t.extra_fee) > 0)) {
      pat2Count++;
      if (pat2Count <= 10) {
        console.log(`  ${t.task_no} ${t.customer_name} product=${t.product_price} extra=${t.extra_fee} unit_price=0 active=${active.length}`);
      }
    }
  }
  console.log(`  총 ${pat2Count}건 (10건만 표시)`);

  // 패턴 3: appliance_type_id IS NULL task_items
  console.log(`\n` + `=`.repeat(95));
  console.log(`[패턴 3] appliance_type_id IS NULL (= 강남구6429 자체 패턴)`);
  console.log(`=`.repeat(95));
  let pat3Count = 0;
  for (const t of (tasks || [])) {
    const { data: items } = await sb.from("task_items").select("id, appliance_type_id, is_canceled").eq("task_id", t.id);
    const active = (items || []).filter(it => !it.is_canceled);
    const nullAppliance = active.filter(it => !it.appliance_type_id);
    if (nullAppliance.length > 0) {
      pat3Count++;
      console.log(`  ${t.task_no} ${t.customer_name} ${t.status} — appliance_id NULL ${nullAppliance.length}건/${active.length}건`);
    }
  }
  console.log(`  총 ${pat3Count}건`);
})().catch(e => console.log("FATAL:", e.message, e.stack));
