// usol_h 냉매 정책 + 영향 측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  // 1) usol_h 측측 정책
  console.log("=== usol_h 측측 commission_policies ===");
  const { data: pol } = await sb.from("commission_policies")
    .select("principal_code, service_code, appliance_code, calc_method, policy_key, principal_fee, engineer_base, fee_rate, notes")
    .eq("principal_code", "usol_h").eq("service_code", "refrigerant").order("appliance_code");
  for (const p of (pol||[])) {
    console.log(`  ${p.appliance_code} ${p.policy_key} calc=${p.calc_method} principal_fee=${fmt(p.principal_fee)} fee_rate=${p.fee_rate ?? "—"}`);
  }

  // 2) calculate_commission 테스트 — usol_h 측측 벽걸이
  console.log("\n=== calculate_commission 테스트 (벽걸이, unit=70000 vs 0) ===");
  const { data: cc1 } = await sb.rpc("calculate_commission", {
    p_principal_code: "usol_h", p_service_code: "refrigerant", p_appliance_code: "벽걸이",
    p_total_amount: 70000, p_extra_fee: 0, p_travel_fee: 0, p_qty_condition: null
  });
  console.log(`  70000 → ${JSON.stringify(cc1)}`);
  const { data: cc2 } = await sb.rpc("calculate_commission", {
    p_principal_code: "usol_h", p_service_code: "refrigerant", p_appliance_code: "벽걸이",
    p_total_amount: 0, p_extra_fee: 0, p_travel_fee: 0, p_qty_condition: null
  });
  console.log(`  0 → ${JSON.stringify(cc2)}`);

  // 3) 영향 측측 — usol_h 측측 task_items 측 측 engineer 분배 0 측 측 측측
  console.log("\n=== 영향 측측 — usol_h 측측 item engineer_amount=0 ===");
  // usol_h principal_id
  const { data: ph } = await sb.from("principals").select("id").eq("code","usol_h").maybeSingle();
  const usolHId = ph.id;

  // usol_h 완료 task 측 task_items 측 refrigerant + received>0 + (compute_engineer_amount_per_item 측 측 engineer=0)
  // 측 측 측 measure measure 측측 측측: refrigerant item 측 received>0 측측 engineer_amount=0 추정
  //   → per_item RPC 측 호출 후 측 task 측 합산 결과 측 측측측 측측, 측측 측측측 측측 측측.
  const { data: tasks } = await sb.from("tasks")
    .select(`id, task_no, status, total_amount, extra_fee, product_price, assigned_engineer_id,
             task_items(id, qty, unit_price, subtotal, received_amount, order_type,
                        work_types(name, service_types(code)), appliance_types(name)),
             payments(engineer_amount, principal_amount, owner_amount, calc_method)`)
    .eq("principal_id", usolHId)
    .eq("status", "완료");

  let affectedTasks = 0;
  let refriReceivedTotal = 0;
  const perEngineer = {}; // userId → { name, missing }
  // 측측 측측 측측: 측 task 측 측 측측 item 측 received 합 측측 (item-level engineer 측 호출 측측 — 측측 측측 X 측측 measure 측측).
  for (const t of (tasks||[])) {
    const items = t.task_items || [];
    const refriItems = items.filter(it => it.work_types?.service_types?.code === "refrigerant" && Number(it.received_amount||0) > 0);
    if (refriItems.length === 0) continue;
    // 측측 측 측: 측 task 측 측측 item received 합 × 기사 측측 (60% 측 측측 — 사장님 spec)
    const refriRecv = refriItems.reduce((s, it) => s + Number(it.received_amount||0), 0);
    // 기사 rate
    let rate = 60;
    if (t.assigned_engineer_id) {
      const { data: eng } = await sb.from("users").select("name, refrigerant_rate").eq("id", t.assigned_engineer_id).maybeSingle();
      rate = Number(eng?.refrigerant_rate) || 60;
      const k = t.assigned_engineer_id;
      if (!perEngineer[k]) perEngineer[k] = { name: eng?.name || "?", rate, refriRecv: 0, expected: 0 };
      perEngineer[k].refriRecv += refriRecv;
      perEngineer[k].expected += Math.floor(refriRecv * rate / 100);
    }
    affectedTasks++;
    refriReceivedTotal += refriRecv;
  }

  console.log(`  영향 task 측: ${affectedTasks}건`);
  console.log(`  측측 received 합계: ${fmt(refriReceivedTotal)}원`);
  console.log(`\n  기사측 추정 측측 측측 측 (rate × refriRecv):`);
  for (const [uid, v] of Object.entries(perEngineer).sort((a,b)=>b[1].expected-a[1].expected)) {
    console.log(`    ${v.name} (rate=${v.rate}%): refri_recv=${fmt(v.refriRecv)} → 추정 측측 ${fmt(v.expected)}`);
  }

  // 4) 측측 측 측측 정책 측측 (allday/KB 측)
  console.log("\n=== 측측 측측 측측 측측 정책 측측 (회귀 측측) ===");
  const { data: otherPol } = await sb.from("commission_policies")
    .select("principal_code, calc_method, principal_fee")
    .eq("service_code", "refrigerant");
  const byP = {};
  for (const r of (otherPol||[])) {
    if (!byP[r.principal_code]) byP[r.principal_code] = { calc: new Set(), fees: new Set() };
    byP[r.principal_code].calc.add(r.calc_method);
    byP[r.principal_code].fees.add(r.principal_fee);
  }
  for (const [k, v] of Object.entries(byP)) {
    console.log(`  ${k}: calc=${[...v.calc].join(",")}  principal_fee=${[...v.fees].join(",")}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
