// task_items 재확인 + 정책 매칭 시뮬레이션 (calculate_commission 우회)
// 실행: node scripts/diag-refri-60-items-recheck.cjs

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

const TASKS = [
  { kw: "용산구4527", id: "a4dc2dca-d42a-41b7-b976-946b04e31511", task_no: "YS-260526-002" },
  { kw: "강북구9810", id: "7e03a275-f638-4199-9a40-7ef810e79b76", task_no: "A-260608-003" },
  { kw: "강남구6429", id: "be31c04b-9283-4ca2-ae3e-546db7010fc5", task_no: "CK-260608-001" },
];

(async () => {
  for (const T of TASKS) {
    console.log("\n" + "=".repeat(90));
    console.log(`▶ ${T.kw} ${T.task_no} (id=${T.id})`);
    console.log("=".repeat(90));

    // 1) task_items 직접 조회 — 모든 컬럼
    const { data: items, error: err1 } = await sb.from("task_items").select("*").eq("task_id", T.id);
    if (err1) console.log("  ERR " + err1.message);
    console.log(`  task_items.count = ${items?.length || 0}`);
    for (const it of (items || [])) {
      // FK 추적
      const { data: wt } = it.work_type_id ? await sb.from("work_types").select("code, name, service_type_id").eq("id", it.work_type_id).single() : { data: null };
      const { data: svc } = wt?.service_type_id ? await sb.from("service_types").select("code, name").eq("id", wt.service_type_id).single() : { data: null };
      const { data: at } = it.appliance_type_id ? await sb.from("appliance_types").select("code, name").eq("id", it.appliance_type_id).single() : { data: null };
      console.log(`  · id=${it.id}`);
      console.log(`    qty=${it.qty} unit_price=${it.unit_price} subtotal=${it.subtotal}`);
      console.log(`    received_amount=${it.received_amount} order_type=${it.order_type} is_canceled=${it.is_canceled}`);
      console.log(`    work_type:    id=${it.work_type_id} → ${wt?.code} / ${wt?.name}`);
      console.log(`    service_type: ${svc?.code} (${svc?.name})`);
      console.log(`    appliance:    id=${it.appliance_type_id} → ${at?.code} / ${at?.name}`);
      console.log(`    created_at=${it.created_at} updated_at=${it.updated_at}`);
    }
  }

  // 2) 정책 매칭 시뮬레이션 — 정책 row 직접 조회 (calculate_commission 안 통해)
  console.log("\n" + "=".repeat(90));
  console.log("[정책 매칭 시뮬레이션 — service_code='refrigerant']");
  console.log("=".repeat(90));
  const targets = [
    { tag: "용산구4527", pri: "usol_h",  app: "wall",  unit: 80000,  extra: 100000, rate: 60 },
    { tag: "강북구9810", pri: "yongin",  app: "2in1",  unit: 100000, extra: 220000, rate: 60 },
    { tag: "강남구6429", pri: "crikrin", app: "wall",  unit: 0,      extra: 110000, rate: 60 },
  ];
  for (const t of targets) {
    const { data: pol } = await sb.from("commission_policies")
      .select("*")
      .eq("principal_code", t.pri)
      .eq("service_code", "refrigerant")
      .eq("appliance_code", t.app)
      .single();
    if (!pol) { console.log(`  ${t.tag}: 정책 없음 (${t.pri}/${t.app})`); continue; }
    console.log(`\n  ${t.tag} (${t.pri}/refrigerant/${t.app}, unit=${t.unit} extra=${t.extra}, rate=${t.rate}%):`);
    console.log(`    정책: calc_method=${pol.calc_method} fee_rate=${pol.fee_rate} principal_fee=${pol.principal_fee}`);

    // calc_method 별 수동 계산
    let engBefore, prinBefore, ownerBefore;
    let engAfter,  prinAfter,  ownerAfter;
    const total = t.unit + t.extra;
    if (pol.calc_method === "비율_견적금액") {
      // crikrin: fee_rate (e.g. 0.2). principal = total × fee_rate. engineer = total - principal.
      // refrigerant 측 v18 측 v_is_ratio = true → extra 적용 → re-call → total = unit + extra.
      const prin = Math.floor(total * Number(pol.fee_rate));
      prinAfter = prin;
      // refrigerant rate: engineer = total × rate / 100
      engAfter = Math.floor(total * t.rate / 100);
      ownerAfter = total - engAfter - prinAfter;
    } else if (pol.calc_method === "직영_50_50") {
      // usol_h: principal=0 (principal_fee=0). engineer = total × 50% by default, but refrigerant override: × rate%.
      prinAfter = 0;
      engAfter = Math.floor(total * t.rate / 100);
      ownerAfter = total - engAfter - prinAfter;
    } else if (pol.calc_method === "정액") {
      // yongin: principal = principal_fee (10,000). engineer = unit_price × rate% (extra NOT applied since not v_is_ratio).
      // v18 분기:
      //   - v_is_ratio = false → v_item_extra = 0 → no re-call
      //   - v_calc_result.total = unit (first call)
      //   - refrigerant override: v_eng = total_calc × rate / 100 = unit × 0.6
      prinAfter = Number(pol.principal_fee);
      engAfter = Math.floor(t.unit * t.rate / 100); // ← extra 제외!
      ownerAfter = total - engAfter - prinAfter;
    }
    console.log(`    수동 계산: engineer=${engAfter?.toLocaleString()} principal=${prinAfter?.toLocaleString()} owner=${ownerAfter?.toLocaleString()}`);
  }
})().catch(e => console.log("FATAL:", e.message, e.stack));
