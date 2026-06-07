// SELECT only — YS-260605-001 측 측측 + YS-N-* + usol_h 4건 측측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  // [1] 남양주 측 측측
  console.log("\n=== [1] YS-260605-001 측 측측 ===");
  const { data: t1 } = await sb.from("tasks").select(`
    id, task_no, customer_name, address, principal_id,
    principals:principal_id(code, name),
    scheduled_at, completed_at, product_price, extra_fee, total_amount,
    task_items(id, qty, unit_price, subtotal, received_amount, order_type,
               work_types(name, service_types(code)),
               appliance_types(name)),
    payments(engineer_amount, principal_amount, owner_amount, is_balanced, calc_method, track, status,
             paid_at, confirmed_at, engineer_remitted_at, engineer_remit_confirmed_at, engineer_remit_confirmed_by)
  `).eq("task_no", "YS-260605-001").maybeSingle();

  if (!t1) { console.log("측측 측측"); return; }
  console.log(`  task: ${t1.task_no} / 측측 ${t1.customer_name}`);
  console.log(`  measure: ${t1.address}`);
  console.log(`  principal: ${t1.principals?.code} (${t1.principals?.name})`);
  console.log(`  product=${fmt(t1.product_price)} extra=${fmt(t1.extra_fee)} total=${fmt(t1.total_amount)}`);
  for (const it of (t1.task_items||[])) {
    console.log(`    [${it.work_types?.service_types?.code}] ${it.appliance_types?.name}×${it.qty} unit=${fmt(it.unit_price)} subtotal=${fmt(it.subtotal)} received=${fmt(it.received_amount)}`);
  }
  const p1 = Array.isArray(t1.payments) ? t1.payments[0] : t1.payments;
  console.log(`  payment: eng=${fmt(p1?.engineer_amount)} principal=${fmt(p1?.principal_amount)} owner=${fmt(p1?.owner_amount)}`);
  console.log(`           calc=${p1?.calc_method} track=${p1?.track} status=${p1?.status} is_balanced=${p1?.is_balanced}`);

  const expected = p1?.engineer_amount === 92000 && p1?.principal_amount === 0 && p1?.owner_amount === 58000 && p1?.is_balanced === true;
  console.log(expected ? "  ✓ 측측측 (92,000 / 0 / 58,000 / true)" : "  ⚠️ 측측측 측측");

  console.log("\n  --- 측측 측측 ---");
  console.log(`  paid_at:                     ${p1?.paid_at || "—"}`);
  console.log(`  confirmed_at:                ${p1?.confirmed_at || "—"}`);
  console.log(`  engineer_remitted_at:        ${p1?.engineer_remitted_at || "—"}`);
  console.log(`  engineer_remit_confirmed_at: ${p1?.engineer_remit_confirmed_at || "—"}`);
  console.log(`  engineer_remit_confirmed_by: ${p1?.engineer_remit_confirmed_by || "—"}`);
  const alreadyRemitted = !!(p1?.engineer_remitted_at || p1?.engineer_remit_confirmed_at || p1?.paid_at);
  if (alreadyRemitted) {
    console.log(`\n  ⚠️ 측측 측측 — 김현동 측측 추가 측측 측측 (이전 82,000 측측 측 92,000 = +10,000)`);
  } else {
    console.log(`\n  ✓ 측측 측측 측 — 측측 측측측 자동 측측`);
  }

  // [2] YS-N-* + usol_h 4건
  console.log("\n\n=== [2] YS-N-* principal_id=usol_h 4건 측측측 ===");
  const TARGETS = ["YS-N-260528-008-R","YS-N-260529-020","YS-N-260529-024-R","YS-N-260601-020-R"];
  for (const tno of TARGETS) {
    const { data: t } = await sb.from("tasks").select(`
      id, task_no, customer_name, address, district,
      principals:principal_id(code),
      scheduled_at, completed_at, assigned_engineer_id,
      total_amount, product_price, extra_fee,
      task_items(id, qty, unit_price, received_amount,
                 work_types(name, service_types(code)),
                 appliance_types(name)),
      payments(engineer_amount, principal_amount, owner_amount, calc_method)
    `).eq("task_no", tno).maybeSingle();
    if (!t) { console.log(`  ${tno}: 측측 측측`); continue; }
    const items = t.task_items || [];
    const svcSet = new Set(items.map(it => it.work_types?.service_types?.code));
    const svcLabel = [...svcSet].map(s => s === "cleaning" ? "세척" : s === "refrigerant" ? "측측" : s).join("+");
    const recvSum = items.reduce((s, it) => s + (Number(it.received_amount)||0), 0);
    const pmt = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    let engName = "?";
    if (t.assigned_engineer_id) {
      const { data: u } = await sb.from("users").select("name").eq("id", t.assigned_engineer_id).maybeSingle();
      engName = u?.name || "?";
    }
    console.log(`\n  ─── ${t.task_no} ───`);
    console.log(`    측측: ${t.customer_name}`);
    console.log(`    측측: ${t.address || "—"}`);
    console.log(`    측측: ${t.district || "—"}`);
    console.log(`    측측: ${engName}`);
    console.log(`    측측: ${t.scheduled_at || "—"}`);
    console.log(`    완료: ${t.completed_at || "—"}`);
    console.log(`    principal: ${t.principals?.code}`);
    console.log(`    측측: ${svcLabel}  (items 측: ${items.length})`);
    for (const it of items) {
      const code = it.work_types?.service_types?.code;
      const svc = code === "cleaning" ? "세척" : code === "refrigerant" ? "측측" : code;
      console.log(`      [${svc}] ${it.appliance_types?.name}×${it.qty} unit=${fmt(it.unit_price)} received=${fmt(it.received_amount)}`);
    }
    console.log(`    측측 received 합: ${fmt(recvSum)}  /  task.total=${fmt(t.total_amount)} product=${fmt(t.product_price)} extra=${fmt(t.extra_fee)}`);
    console.log(`    payment: eng=${fmt(pmt?.engineer_amount)} principal=${fmt(pmt?.principal_amount)} owner=${fmt(pmt?.owner_amount)} calc=${pmt?.calc_method}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
