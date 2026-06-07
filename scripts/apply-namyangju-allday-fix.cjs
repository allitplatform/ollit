// YS-260605-001 measure usol_h → allday 측측 + 측측 측측 + compute_payment 측측측 + verify
//   백업 측 측측 측측 (ys-260605-001-backup-2026-06-06T16-04-51.json)
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

const TASK_NO = "YS-260605-001";

(async () => {
  // 1) task + items + payment fetch (before snap)
  const { data: t } = await sb.from("tasks").select(`*, task_items(*), payments(*)`).eq("task_no", TASK_NO).maybeSingle();
  if (!t) { console.error("측측 측측"); process.exit(1); }
  const before = Array.isArray(t.payments) ? t.payments[0] : t.payments;

  // principal ids
  const { data: principals } = await sb.from("principals").select("id, code");
  const idByCode = new Map(principals.map(p => [p.code, p.id]));
  const alldayId = idByCode.get("allday");

  // service code lookup for items
  const itemSvcByItemId = new Map();
  for (const it of (t.task_items||[])) {
    const { data: wt } = await sb.from("work_types").select("name, service_types(code)").eq("id", it.work_type_id).maybeSingle();
    itemSvcByItemId.set(it.id, wt?.service_types?.code);
  }

  console.log("\n=== BEFORE ===");
  console.log(`  principal_id: ${t.principal_id} (usol_h)`);
  console.log(`  product=${fmt(t.product_price)} extra=${fmt(t.extra_fee)} total=${fmt(t.total_amount)}`);
  for (const it of (t.task_items||[])) {
    console.log(`    [${itemSvcByItemId.get(it.id)}] unit=${fmt(it.unit_price)} qty=${it.qty} subtotal=${fmt(it.subtotal)} received=${fmt(it.received_amount)}`);
  }
  console.log(`  payment: eng=${fmt(before?.engineer_amount)} principal=${fmt(before?.principal_amount)} owner=${fmt(before?.owner_amount)}`);
  console.log(`           track=${before?.track} calc=${before?.calc_method} is_balanced=${before?.is_balanced}`);
  console.log(`           paid_at=${before?.paid_at || "—"} confirmed_at=${before?.confirmed_at || "—"}`);
  console.log(`           engineer_remitted_at=${before?.engineer_remitted_at || "—"}`);
  console.log(`           engineer_remit_confirmed_at=${before?.engineer_remit_confirmed_at || "—"}`);

  // 2) UPDATE tasks (principal_id, product_price, extra_fee)
  console.log("\n=== Step 1-3: UPDATE tasks ===");
  const { error: u1 } = await sb.from("tasks").update({
    principal_id: alldayId,
    product_price: 140000,
    extra_fee: 10000,
  }).eq("id", t.id);
  if (u1) { console.error("tasks UPDATE 측측:", u1); process.exit(1); }
  console.log("  ✓ principal_id=allday, product=140000, extra=10000");

  // 3) UPDATE task_items (cleaning + refri)
  console.log("\n=== Step 4-5: UPDATE task_items ===");
  for (const it of (t.task_items||[])) {
    const { error: u2 } = await sb.from("task_items").update({
      unit_price: 70000,
      // subtotal 측 GENERATED — unit_price × qty 자동 측측
    }).eq("id", it.id);
    if (u2) { console.error(`task_items UPDATE 측측 (${it.id}):`, u2); process.exit(1); }
    console.log(`  ✓ ${itemSvcByItemId.get(it.id)} item: unit=70000, subtotal=70000`);
  }

  // 4) compute_payment
  console.log("\n=== Step 6: compute_payment ===");
  const { data: cpRes, error: cpErr } = await sb.rpc("compute_payment", { p_task_id: t.id });
  if (cpErr) { console.error("compute_payment 측측:", cpErr); process.exit(1); }
  console.log(`  ✓ compute_payment 측측: ${JSON.stringify(cpRes)?.slice(0, 80)}`);

  // 5) AFTER snap + verify
  const { data: tA } = await sb.from("tasks").select(`*, task_items(*), payments(*)`).eq("id", t.id).maybeSingle();
  const after = Array.isArray(tA.payments) ? tA.payments[0] : tA.payments;
  console.log("\n=== AFTER ===");
  console.log(`  principal_id: ${tA.principal_id} (allday)`);
  console.log(`  product=${fmt(tA.product_price)} extra=${fmt(tA.extra_fee)} total=${fmt(tA.total_amount)}`);
  for (const it of (tA.task_items||[])) {
    console.log(`    [${itemSvcByItemId.get(it.id)}] unit=${fmt(it.unit_price)} qty=${it.qty} subtotal=${fmt(it.subtotal)} received=${fmt(it.received_amount)}`);
  }
  console.log(`  payment: eng=${fmt(after?.engineer_amount)} principal=${fmt(after?.principal_amount)} owner=${fmt(after?.owner_amount)}`);
  console.log(`           calc=${after?.calc_method} is_balanced=${after?.is_balanced}`);

  console.log("\n=== DIFF ===");
  const engDiff = (after?.engineer_amount||0) - (before?.engineer_amount||0);
  const ownDiff = (after?.owner_amount||0) - (before?.owner_amount||0);
  console.log(`  engineer: ${fmt(before?.engineer_amount)} → ${fmt(after?.engineer_amount)}  (${engDiff > 0 ? "+" : ""}${fmt(engDiff)})`);
  console.log(`  principal: ${fmt(before?.principal_amount)} → ${fmt(after?.principal_amount)}`);
  console.log(`  owner: ${fmt(before?.owner_amount)} → ${fmt(after?.owner_amount)}  (${ownDiff > 0 ? "+" : ""}${fmt(ownDiff)})`);

  const ok = after?.engineer_amount === 92000 && after?.principal_amount === 0 && after?.owner_amount === 58000 && after?.is_balanced === true;
  console.log(ok ? "\n✓ 측측측 통과 — engineer=92,000 / principal=0 / owner=58,000 / is_balanced=true" : "\n⚠️ 측측측 측측");

  // 6) 측측 측측 측측 측측
  console.log("\n=== 측측 측측 ===");
  const alreadyRemitted = !!(before?.engineer_remitted_at || before?.engineer_remit_confirmed_at || before?.paid_at);
  if (alreadyRemitted) {
    console.log(`  ⚠️ 측측 측측 측측 — 김현동 측측 +${fmt(engDiff)} 측측 측측 측측`);
  } else {
    console.log(`  ✓ 측측 측측 측 — 측측 측측측 자동 측측 (+${fmt(engDiff)})`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
