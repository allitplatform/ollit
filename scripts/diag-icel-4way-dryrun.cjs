// ICEL 이경화 YS-260427-061 — 스탠드→4way 정정 드라이런 (SELECT만, UPDATE 금지)
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TASK_NO = "YS-260427-061";

function pad(s, n) { s = String(s ?? ""); return s.length >= n ? s : s + " ".repeat(n - s.length); }

(async () => {
  // [A] task 현재 상태
  const { data: tasks } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, completed_at, scheduled_at, product_price, extra_fee, travel_fee, principal_id, assigned_engineer_id, category_data")
    .eq("task_no", TASK_NO);
  const t = tasks?.[0];
  if (!t) { console.error("task NOT FOUND"); process.exit(1); }

  const { data: principals } = await sb.from("principals").select("id, code").eq("id", t.principal_id);
  const principalCode = principals?.[0]?.code;
  const { data: users } = await sb.from("users").select("id, code, name, refrigerant_rate").eq("id", t.assigned_engineer_id);
  const eng = users?.[0];

  console.log("\n" + "=".repeat(140));
  console.log(`[A] YS-260427-061 task 현재 상태`);
  console.log("=".repeat(140));
  console.log(`  task_no       : ${t.task_no}`);
  console.log(`  customer      : ${t.customer_name}`);
  console.log(`  원청          : ${principalCode}`);
  console.log(`  배정 기사     : ${eng?.name} (${eng?.code}, 냉매율=${eng?.refrigerant_rate}%)`);
  console.log(`  status        : ${t.status}`);
  console.log(`  scheduled_at  : ${t.scheduled_at}`);
  console.log(`  completed_at  : ${t.completed_at}`);
  console.log(`  product_price : ₩${Number(t.product_price||0).toLocaleString()}`);
  console.log(`  extra_fee     : ₩${Number(t.extra_fee||0).toLocaleString()}`);
  console.log(`  travel_fee    : ₩${Number(t.travel_fee||0).toLocaleString()}`);
  console.log(`  category_data : ${JSON.stringify(t.category_data || {}).slice(0,200)}`);

  // task_items 현재 상태
  const { data: items } = await sb.from("task_items")
    .select("id, task_id, work_type_id, appliance_type_id, qty, unit_price, subtotal, is_canceled, order_type, customer_paid_amount, net_amount")
    .eq("task_id", t.id);

  const wtIds = [...new Set((items||[]).map(i => i.work_type_id).filter(Boolean))];
  const atIds = [...new Set((items||[]).map(i => i.appliance_type_id).filter(Boolean))];
  const { data: wts } = await sb.from("work_types").select("id, name, code, service_type_id").in("id", wtIds);
  const { data: ats } = await sb.from("appliance_types").select("id, name, code").in("id", atIds);
  const stIds = [...new Set((wts||[]).map(w => w.service_type_id).filter(Boolean))];
  const { data: sts } = await sb.from("service_types").select("id, name, code").in("id", stIds);

  const wtMap = new Map((wts||[]).map(w => [w.id, { ...w, service: sts?.find(s => s.id === w.service_type_id) }]));
  const atMap = new Map((ats||[]).map(a => [a.id, a]));

  console.log("\n  ─── task_items 현재 ───");
  for (const i of (items||[])) {
    const wt = wtMap.get(i.work_type_id);
    const at = atMap.get(i.appliance_type_id);
    console.log(`    item_id=${i.id?.slice(0,8)}…`);
    console.log(`      work_type     : ${wt?.name} (${wt?.code}) — service=${wt?.service?.code}`);
    console.log(`      appliance     : ${at?.name} (${at?.code})`);
    console.log(`      qty           : ${i.qty}`);
    console.log(`      unit_price    : ₩${Number(i.unit_price||0).toLocaleString()}`);
    console.log(`      subtotal      : ₩${Number(i.subtotal||0).toLocaleString()} (GENERATED)`);
    console.log(`      is_canceled   : ${i.is_canceled}`);
    console.log(`      order_type    : ${i.order_type}`);
    console.log(`      paid          : ₩${Number(i.customer_paid_amount||0).toLocaleString()} / net=₩${Number(i.net_amount||0).toLocaleString()}`);
  }

  // [B] payments 현재
  const { data: pays } = await sb.from("payments")
    .select("engineer_amount, principal_amount, owner_amount, calc_method, policy_key, settled_at, track, product_price, extra_fee, travel_fee")
    .eq("task_id", t.id);
  const pay = pays?.[0];
  console.log("\n" + "=".repeat(140));
  console.log(`[B] payments 현재`);
  console.log("=".repeat(140));
  if (pay) {
    console.log(`  engineer_amount  : ₩${Number(pay.engineer_amount||0).toLocaleString()}`);
    console.log(`  principal_amount : ₩${Number(pay.principal_amount||0).toLocaleString()}`);
    console.log(`  owner_amount     : ₩${Number(pay.owner_amount||0).toLocaleString()}`);
    console.log(`  calc_method      : ${pay.calc_method}`);
    console.log(`  policy_key       : ${pay.policy_key}`);
    console.log(`  track            : ${pay.track}`);
    console.log(`  settled_at       : ${pay.settled_at || "NULL ✅ (송금 전)"}`);
    console.log(`  product_price    : ₩${Number(pay.product_price||0).toLocaleString()}`);
  } else {
    console.log(`  payments 행 없음`);
  }

  // [C] 정정 목표 ID 조회
  console.log("\n" + "=".repeat(140));
  console.log(`[C] 정정 목표값 — work_type/appliance_type id 조회`);
  console.log("=".repeat(140));

  // 세척 service id
  const { data: cleanSt } = await sb.from("service_types").select("id, name, code").eq("code", "cleaning");
  console.log(`  service_types(code=cleaning): ${JSON.stringify(cleanSt)}`);

  // 4way appliance — code 후보
  const { data: app4 } = await sb.from("appliance_types").select("id, name, code").or("code.ilike.%4way%,name.ilike.%4way%,name.ilike.%4Way%,name.ilike.%포웨이%,name.ilike.%4방향%");
  console.log(`  appliance_types(4way 후보): ${JSON.stringify(app4)}`);

  // 세척_4way work_type
  let wt4Way = null;
  if (cleanSt?.[0]?.id) {
    const { data: wt4 } = await sb.from("work_types").select("id, name, code, service_type_id, appliance_type_id").eq("service_type_id", cleanSt[0].id);
    console.log(`  work_types(service=cleaning) 전체:`);
    for (const w of (wt4||[])) console.log(`    - ${w.name} (${w.code}) — appliance_type_id=${w.appliance_type_id?.slice(0,8)}…`);
    // 4way 키워드 매칭
    wt4Way = (wt4||[]).find(w => /4way|4Way|포웨이|4방향/.test(w.name) || /4way/i.test(w.code));
  }
  console.log(`  → 매칭 work_type(세척_4way 후보): ${wt4Way ? JSON.stringify({id: wt4Way.id, name: wt4Way.name, code: wt4Way.code}) : "찾지 못함"}`);

  // [D] usol_n 4way 단가 샘플
  console.log("\n" + "=".repeat(140));
  console.log(`[D] usol_n 4way 단가 샘플 (같은 시기 발주)`);
  console.log("=".repeat(140));

  const fourWayApplianceId = (app4||[]).find(a => /4way|4Way|포웨이|4방향/.test(a.name) || /4way/i.test(a.code))?.id;
  if (fourWayApplianceId) {
    // usol_n + 4way appliance 사용한 task_items 샘플
    const { data: usolNTasks } = await sb.from("tasks").select("id").eq("principal_id", t.principal_id);
    const usolNTaskIds = (usolNTasks||[]).map(x => x.id);
    const { data: sampleItems } = await sb.from("task_items")
      .select("id, task_id, qty, unit_price, work_type_id, appliance_type_id, order_type")
      .eq("appliance_type_id", fourWayApplianceId)
      .in("task_id", usolNTaskIds)
      .limit(20);

    if (sampleItems?.length) {
      const { data: sampleTasks } = await sb.from("tasks").select("id, task_no, customer_name, scheduled_at, product_price")
        .in("id", [...new Set(sampleItems.map(s => s.task_id))]);
      const stMap = new Map((sampleTasks||[]).map(x => [x.id, x]));
      console.log(`  unit_price 분포:`);
      const priceCount = {};
      for (const s of sampleItems) {
        const p = s.unit_price || 0;
        priceCount[p] = (priceCount[p] || 0) + 1;
      }
      for (const [p, c] of Object.entries(priceCount).sort((a,b) => Number(b[0])-Number(a[0]))) {
        console.log(`    ₩${Number(p).toLocaleString()} : ${c}건`);
      }
      console.log(`\n  최근 샘플 10개:`);
      const sorted = sampleItems.map(s => ({ ...s, _t: stMap.get(s.task_id) })).sort((a,b) => (b._t?.scheduled_at||"").localeCompare(a._t?.scheduled_at||""));
      console.log(`    ${pad("task_no",18)} ${pad("고객",10)} ${pad("scheduled",12)} ${pad("qty",4)} ${pad("unit_price",12)} ${pad("order_type",10)}`);
      for (const s of sorted.slice(0,10)) {
        console.log(`    ${pad(s._t?.task_no,18)} ${pad(s._t?.customer_name||"?",10)} ${pad(s._t?.scheduled_at?.slice(0,10)||"?",12)} ${pad(s.qty,4)} ${pad("₩"+Number(s.unit_price).toLocaleString(),12)} ${pad(s.order_type||"?",10)}`);
      }
    } else {
      console.log(`  usol_n + 4way appliance 사용한 task_items 없음`);
    }
  }

  // 추가 — usol_n 세척 정책 단가 (commission_policies)
  console.log("\n  ─── commission_policies (usol_n + cleaning + 4way 후보) ───");
  const { data: pols } = await sb.from("commission_policies")
    .select("id, principal_code, service_code, appliance_code, calc_method, policy_key, base_amount, engineer_rate, principal_rate")
    .eq("principal_code", "usol_n")
    .eq("service_code", "cleaning");
  for (const p of (pols||[])) {
    console.log(`    appliance=${p.appliance_code}, calc=${p.calc_method}, key=${p.policy_key}, base=${p.base_amount}, eng_rate=${p.engineer_rate}, prin_rate=${p.principal_rate}`);
  }

  // [E] 정정 시 예상 — owner 계산은 SUM(subtotal) 기반
  console.log("\n" + "=".repeat(140));
  console.log(`[E] 정정 시 영향 예상`);
  console.log("=".repeat(140));
  console.log(`  현재 product_price (task) = ₩${Number(t.product_price||0).toLocaleString()}`);
  console.log(`  현재 task_items SUM(subtotal) = ₩${(items||[]).reduce((s,i)=>s+(i.subtotal||0),0).toLocaleString()}`);
  console.log(`  현재 payments.product_price = ₩${Number(pay?.product_price||0).toLocaleString()}`);
  console.log(``);
  console.log(`  ⚠️ 4way 단가는 위 [D] 샘플 확인 후 사장님 확정 필요.`);
  console.log(`     unit_price 결정되면 — qty=2 유지 시 product_price = unit_price × 2.`);
  console.log(`     compute_payment v16 → usol_n 분기: owner = SUM(subtotal) + extra + travel - eng - prin`);
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });
