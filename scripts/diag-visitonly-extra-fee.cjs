// visit_only extra_fee > 0 측측 측측 + dry-run 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  // 1) visit_only + extra_fee > 0 측측
  console.log("=== [1] visit_only AND extra_fee > 0 전체 ===");
  const { data: vAll } = await sb.from("tasks")
    .select(`id, task_no, customer_name, status, total_amount, product_price, extra_fee, extra_fee_at, travel_fee,
             extra_reason, completed_at, principals:principal_id(code),
             category_data,
             payments(engineer_amount, principal_amount, owner_amount, calc_method, is_balanced, status, engineer_remitted_at, engineer_remit_confirmed_at)`)
    .eq("status","visit_only")
    .gt("extra_fee", 0);

  console.log(`측측: ${(vAll||[]).length}건\n`);
  for (const t of (vAll||[])) {
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    console.log(`─── ${t.task_no} (${t.customer_name}) ${t.principals?.code} ───`);
    console.log(`  completed: ${t.completed_at}`);
    console.log(`  product=${fmt(t.product_price)} extra=${fmt(t.extra_fee)} travel=${fmt(t.travel_fee)} total=${fmt(t.total_amount)}`);
    console.log(`  extra_reason: ${t.extra_reason || "(측측)"}  extra_fee_at: ${t.extra_fee_at || "(측측)"}`);
    console.log(`  category_data.visitOnly: ${JSON.stringify(t.category_data?.visitOnly || {})}`);
    console.log(`  category_data 측 측측 측측 측측 (extra/extraFee/extraReason 측):`);
    if (t.category_data?.extraFee !== undefined) console.log(`    extraFee=${t.category_data.extraFee}`);
    if (t.category_data?.extraReason) console.log(`    extraReason=${t.category_data.extraReason}`);
    if (t.category_data?.extra_fee !== undefined) console.log(`    extra_fee=${t.category_data.extra_fee}`);
    console.log(`  payment: eng=${fmt(p?.engineer_amount)} principal=${fmt(p?.principal_amount)} owner=${fmt(p?.owner_amount)} calc=${p?.calc_method} is_balanced=${p?.is_balanced}`);
    console.log(`  remit: remitted_at=${p?.engineer_remitted_at || "—"} confirmed_at=${p?.engineer_remit_confirmed_at || "—"}\n`);
  }

  // 2) BEFORE snap 측측 (적용 측측측 X — 측측 측측측)
  console.log("\n=== [2] DRY-RUN 측측 효과 측측 (UPDATE 측 SELECT 측측) ===");
  console.log("측측 측측: tasks.extra_fee = 0 → tasks.total_amount = product + 0 + travel = travel (= 30K)");
  console.log("측측 measure compute_payment 측측: visit_only + calc='출장비_30K' → engineer = travel = 30K, owner/principal = 0");
  console.log();
  for (const t of (vAll||[])) {
    const newTotal = (Number(t.product_price)||0) + 0 + (Number(t.travel_fee)||0);
    const newEng = newTotal;
    const newOwner = 0;
    const newPrincipal = 0;
    const balanced = (newEng + newOwner + newPrincipal) === newTotal;
    console.log(`  ${t.task_no}:`);
    console.log(`    total: ${fmt(t.total_amount)} → ${fmt(newTotal)}`);
    console.log(`    eng:   ${fmt((Array.isArray(t.payments)?t.payments[0]:t.payments)?.engineer_amount)} → ${fmt(newEng)} (측측 측측)`);
    console.log(`    owner: ${fmt((Array.isArray(t.payments)?t.payments[0]:t.payments)?.owner_amount)} → ${fmt(newOwner)}`);
    console.log(`    principal: ${fmt((Array.isArray(t.payments)?t.payments[0]:t.payments)?.principal_amount)} → ${fmt(newPrincipal)}`);
    console.log(`    is_balanced: ${balanced ? "true ✓" : "false ⚠️"}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
