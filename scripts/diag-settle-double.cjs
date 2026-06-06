// 정산정보 측측 2측 측측 측측 — DB 측측측 + 측측 패턴 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  const SAMPLES = ["A-260605-005", "YS-260605-001"];
  for (const tn of SAMPLES) {
    console.log(`\n=== ${tn} ===`);
    const { data: t } = await sb.from("tasks")
      .select(`id, task_no, status, product_price, extra_fee, travel_fee, total_amount, principals:principal_id(code),
               task_items(id, qty, unit_price, subtotal, received_amount, order_type,
                          work_types(name), appliance_types(name)),
               payments(calc_method, engineer_amount, principal_amount, owner_amount, is_balanced, status, computed_at)`)
      .eq("task_no", tn).maybeSingle();
    if (!t) { console.log("  (측측)"); continue; }
    console.log(`  principal=${t.principals?.code} status=${t.status}`);
    console.log(`  TASK columns:  product=${fmt(t.product_price)}  extra_fee=${fmt(t.extra_fee)}  travel=${fmt(t.travel_fee)}  total=${fmt(t.total_amount)}`);
    console.log(`  task_items:`);
    let sumUnit = 0, sumSub = 0, sumRecv = 0;
    for (const it of (t.task_items||[])) {
      const u = Number(it.unit_price)||0, s = Number(it.subtotal)||0, r = Number(it.received_amount)||0;
      sumUnit += u; sumSub += s; sumRecv += r;
      console.log(`    [${it.order_type||"?"}] ${it.appliance_types?.name||"?"}×${it.qty} unit=${fmt(u)} subtotal=${fmt(s)} received=${fmt(r)}  (${it.work_types?.name||"?"})`);
    }
    console.log(`    합계:                                  unit=${fmt(sumUnit)} subtotal=${fmt(sumSub)} received=${fmt(sumRecv)}`);
    const pmt = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    console.log(`  PAYMENT: calc=${pmt?.calc_method} principal=${fmt(pmt?.principal_amount)} engineer=${fmt(pmt?.engineer_amount)} owner=${fmt(pmt?.owner_amount)} sum=${fmt((pmt?.principal_amount||0)+(pmt?.engineer_amount||0)+(pmt?.owner_amount||0))} is_balanced=${pmt?.is_balanced}`);
    // 측측 측측 base
    const distSum = (Number(pmt?.principal_amount)||0) + (Number(pmt?.engineer_amount)||0) + (Number(pmt?.owner_amount)||0);
    console.log(`  분배 base vs:`);
    console.log(`    분배합 ${fmt(distSum)}  ↔  received(items) ${fmt(sumRecv)}  ↔  total ${fmt(t.total_amount)}  ↔  product+extra ${fmt((t.product_price||0)+(t.extra_fee||0))}`);
  }

  // 측측 패턴 측측: 완료 + 견적 0 (product_price=0 AND total_amount > 0) AND received > 0
  console.log("\n\n=== 측측 패턴 측측 카운트 (완료 + product_price=0 + total > 0) ===");
  const { data: pat, count } = await sb.from("tasks")
    .select("id, task_no, principals:principal_id(code), product_price, extra_fee, total_amount", { count: "exact" })
    .eq("status", "완료")
    .eq("product_price", 0)
    .gt("total_amount", 0)
    .order("completed_at", { ascending: false });
  console.log(`  측측 측측: ${count}건`);
  // principal 측 측측
  const byP = {};
  for (const t of (pat||[])) {
    const k = t.principals?.code || "?";
    byP[k] = (byP[k]||0) + 1;
  }
  for (const [k, v] of Object.entries(byP).sort((a,b)=>b[1]-a[1])) {
    console.log(`    ${k}: ${v}건`);
  }
  console.log(`  최측 10건:`);
  for (const t of (pat||[]).slice(0, 10)) {
    console.log(`    ${t.task_no} (${t.principals?.code}) product=${fmt(t.product_price)} extra=${fmt(t.extra_fee)} total=${fmt(t.total_amount)}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
