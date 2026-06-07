// usol_h 세척 정책 + 측측 측측측 + 측측 측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  // 1) usol_h cleaning 정책
  console.log("=== usol_h cleaning commission_policies ===");
  const { data: pol } = await sb.from("commission_policies")
    .select("appliance_code, policy_key, calc_method, principal_fee, engineer_base, fee_rate, notes")
    .eq("principal_code","usol_h").eq("service_code","cleaning").order("appliance_code");
  for (const p of (pol||[])) {
    console.log(`  ${p.appliance_code} key=${p.policy_key} calc=${p.calc_method} principal_fee=${fmt(p.principal_fee)} eng_base=${fmt(p.engineer_base)} fee_rate=${p.fee_rate ?? "—"}`);
  }

  // 2) usol_n cleaning 정책 (비교)
  console.log("\n=== usol_n cleaning commission_policies (비교) ===");
  const { data: polN } = await sb.from("commission_policies")
    .select("appliance_code, policy_key, calc_method, principal_fee, engineer_base, fee_rate")
    .eq("principal_code","usol_n").eq("service_code","cleaning").order("appliance_code");
  for (const p of (polN||[])) {
    console.log(`  ${p.appliance_code} calc=${p.calc_method} principal_fee=${fmt(p.principal_fee)} eng_base=${fmt(p.engineer_base)} fee_rate=${p.fee_rate ?? "—"}`);
  }

  // 3) YS-260605-001 측 세척 항목 측측 측측
  console.log("\n=== YS-260605-001 세척 item 측측 ===");
  const { data: t } = await sb.from("tasks").select(`id, task_no, product_price, extra_fee,
    task_items(id, qty, unit_price, subtotal, received_amount, order_type,
               work_types(name, service_types(code)),
               appliance_types(name))`)
    .eq("task_no","YS-260605-001").maybeSingle();
  console.log(`  task: product=${fmt(t.product_price)} extra=${fmt(t.extra_fee)}`);
  for (const it of (t.task_items||[])) {
    const code = it.work_types?.service_types?.code;
    if (code === "cleaning") {
      console.log(`  세척: appliance=${it.appliance_types?.name} qty=${it.qty} unit=${fmt(it.unit_price)} subtotal=${fmt(it.subtotal)} received=${fmt(it.received_amount)} order_type=${it.order_type}`);
    }
  }

  // 4) 측측 측측 — usol_h 세척 완료 측측 (received > 0 측 측측측)
  console.log("\n=== usol_h 세척 완료 측측 (cleaning item received 측 측측) ===");
  const { data: ph } = await sb.from("principals").select("id").eq("code","usol_h").maybeSingle();
  const { data: doneTasks } = await sb.from("tasks")
    .select(`id, task_no, status, total_amount, product_price, extra_fee,
             task_items(id, qty, unit_price, subtotal, received_amount, order_type,
                        work_types(name, service_types(code))),
             payments(engineer_amount, principal_amount, owner_amount, calc_method, is_balanced)`)
    .eq("principal_id", ph.id).eq("status","완료");

  let count = 0, totalCleanRecv = 0, totalEstFee = 0;
  for (const tk of (doneTasks||[])) {
    const items = tk.task_items||[];
    const cleans = items.filter(it => it.work_types?.service_types?.code === "cleaning");
    if (cleans.length === 0) continue;
    // received 합 vs subtotal 합 (추가금 측측)
    const recvSum = cleans.reduce((s, it) => s + (Number(it.received_amount)||0), 0);
    const subSum = cleans.reduce((s, it) => s + ((Number(it.qty)||1) * (Number(it.unit_price)||0)), 0);
    const extra = Math.max(0, recvSum - subSum);
    if (extra > 0 || subSum === 0) {
      // 측측 측측 (추가금 추정 OR 측측 측측)
      const pmt = Array.isArray(tk.payments) ? tk.payments[0] : tk.payments;
      const estPrincipal = Math.floor(extra * 0.15);
      console.log(`  ${tk.task_no} product=${fmt(tk.product_price)} extra=${fmt(tk.extra_fee)} | clean recv=${fmt(recvSum)} sub=${fmt(subSum)} extra(추정)=${fmt(extra)} | est principal=${fmt(estPrincipal)} | cur engineer=${fmt(pmt?.engineer_amount)} principal=${fmt(pmt?.principal_amount)} owner=${fmt(pmt?.owner_amount)}`);
      count++;
      totalCleanRecv += recvSum;
      totalEstFee += estPrincipal;
    }
  }
  console.log(`\n측측 측측 측측: ${count}건`);
  console.log(`측 세척 received: ${fmt(totalCleanRecv)}원, 측 측측 측측 (FLOOR(extra*15%)): ${fmt(totalEstFee)}원`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
