// 트리거 활성 상태 + 정책 직접 조회 + 정책 매칭 확인
// 실행: node scripts/diag-refri-60-trg-policy.cjs

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
  // 1) 정책 — refrigerant 만, 3 원청
  console.log("=".repeat(90));
  console.log("[1] commission_policies — refrigerant 만 (usol_h / yongin / crikrin)");
  console.log("=".repeat(90));
  const { data: pols } = await sb.from("commission_policies")
    .select("principal_code, service_code, appliance_code, qty_condition, calc_method, policy_key, engineer_base, engineer_actual_ad, engineer_ad_rate, principal_fee, fee_rate, unit_price_ref, policy_type, formula")
    .in("principal_code", ["usol_h", "yongin", "crikrin"])
    .eq("service_code", "refrigerant")
    .order("principal_code")
    .order("appliance_code");
  for (const p of (pols || [])) {
    console.log(`  ${p.principal_code} / ${p.appliance_code} / qty=${p.qty_condition || '-'}`);
    console.log(`    calc_method=${p.calc_method} policy_key=${p.policy_key}`);
    console.log(`    engineer_base=${p.engineer_base} engineer_actual_ad=${p.engineer_actual_ad} engineer_ad_rate=${p.engineer_ad_rate}`);
    console.log(`    principal_fee=${p.principal_fee} fee_rate=${p.fee_rate} unit_price_ref=${p.unit_price_ref}`);
    console.log(`    policy_type=${p.policy_type} formula=${p.formula}`);
  }

  // 2) calculate_commission RPC — 시그니처 순서를 추정 (앞서 ERR 측 알려준 순서: appliance,extra,principal,qty,service,travel,unit)
  console.log("\n" + "=".repeat(90));
  console.log("[2] calculate_commission 호출 — 알려진 시그니처 alphabetical order");
  console.log("=".repeat(90));
  const probes = [
    { tag: "yongin/refrigerant/2in1 unit=100000 extra=0",      pri: "yongin",  svc: "refrigerant", app: "2in1",  price: 100000, extra: 0 },
    { tag: "yongin/refrigerant/2in1 unit=100000 extra=220000", pri: "yongin",  svc: "refrigerant", app: "2in1",  price: 100000, extra: 220000 },
    { tag: "yongin/refrigerant/투인원 unit=100000 extra=0",     pri: "yongin",  svc: "refrigerant", app: "투인원", price: 100000, extra: 0 },
    { tag: "crikrin/refrigerant/stand unit=0 extra=110000",    pri: "crikrin", svc: "refrigerant", app: "stand", price: 0,      extra: 110000 },
    { tag: "crikrin/refrigerant/스탠드 unit=0 extra=110000",    pri: "crikrin", svc: "refrigerant", app: "스탠드", price: 0,      extra: 110000 },
    { tag: "usol_h/refrigerant/stand unit=80000 extra=100000", pri: "usol_h",  svc: "refrigerant", app: "stand", price: 80000,  extra: 100000 },
  ];
  for (const p of probes) {
    const { data, error } = await sb.rpc("calculate_commission", {
      p_principal_code: p.pri,
      p_service_code: p.svc,
      p_appliance_code: p.app,
      p_unit_price: p.price,
      p_extra_fee: p.extra,
      p_travel_fee: 0,
      p_qty_condition: null,
    });
    console.log(`  ${p.tag}:`);
    console.log(`    ${error ? "ERR " + error.message : JSON.stringify(data)}`);
  }

  // 3) appliance_types 코드 (한글 → code)
  console.log("\n" + "=".repeat(90));
  console.log("[3] appliance_types — 냉매 관련");
  console.log("=".repeat(90));
  const { data: apps } = await sb.from("appliance_types").select("*");
  for (const a of (apps || [])) {
    console.log(`  code=${a.code} name=${a.name}`);
  }

  // 4) service_types / work_types — 냉매충전 / refrigerant
  console.log("\n" + "=".repeat(90));
  console.log("[4] service_types — refrigerant 측");
  console.log("=".repeat(90));
  const { data: svcs } = await sb.from("service_types").select("*").or("code.eq.refrigerant,name.eq.냉매충전");
  for (const s of (svcs || [])) console.log(`  code=${s.code} name=${s.name}`);

  console.log("\n[5] work_types — refrigerant 측 work_types (service_type 측):");
  if (svcs && svcs.length) {
    for (const s of svcs) {
      const { data: wts } = await sb.from("work_types").select("id, name, code, service_type_id").eq("service_type_id", s.id);
      for (const w of (wts || [])) {
        console.log(`  svc=${s.code} → work_type: id=${w.id} code=${w.code} name=${w.name}`);
      }
    }
  }

  // 6) tasks 측 추가 task_items 자동 INSERT 측 의도 확인 — 동일 패턴의 다른 task 측 task_items 측 있는지 sample
  console.log("\n" + "=".repeat(90));
  console.log("[6] 비교 sample — 오늘 등록된 다른 refrigerant task (task_items 측 있나)");
  console.log("=".repeat(90));
  const { data: others } = await sb.from("tasks")
    .select("id, task_no, customer_name, category_data, status, updated_at")
    .gte("created_at", "2026-06-07T00:00:00Z")
    .like("category_data->>workType", "%냉매%")
    .limit(20);
  for (const o of (others || [])) {
    const { data: items } = await sb.from("task_items").select("id, qty, unit_price, work_type_id, appliance_type_id, is_canceled").eq("task_id", o.id);
    console.log(`  ${o.task_no} ${o.customer_name} ${o.status} items=${items?.length || 0}`);
    if (items?.length) {
      for (const it of items.slice(0, 3)) {
        console.log(`    qty=${it.qty} unit_price=${it.unit_price} wt=${it.work_type_id} at=${it.appliance_type_id} cancel=${it.is_canceled}`);
      }
    }
  }
})().catch(e => console.log("FATAL:", e.message, e.stack));
