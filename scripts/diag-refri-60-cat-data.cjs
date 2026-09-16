// 3건 task 의 category_data + 정책 매칭 확인 + engineer rate 갱신 시점
//
// 실행: node scripts/diag-refri-60-cat-data.cjs

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
  { kw: "용산구4527", id: "a4dc2dca-d42a-41b7-b976-946b04e31511", task_no: "YS-260526-002", principal: "usol_h",  expEng: 108000, actEng: 108000 },
  { kw: "강북구9810", id: "7e03a275-f638-4199-9a40-7ef810e79b76", task_no: "A-260608-003",  principal: "yongin",  expEng: null,  actEng: 60000  },
  { kw: "강남구6429", id: "be31c04b-9283-4ca2-ae3e-546db7010fc5", task_no: "CK-260608-001", principal: "crikrin", expEng: null,  actEng: 0      },
];

(async () => {
  // 1) 3건 category_data + 핵심 필드
  console.log("=".repeat(90));
  console.log("[1] 3건 category_data 확인");
  console.log("=".repeat(90));
  for (const T of TASKS) {
    const { data: t } = await sb.from("tasks").select("category_data, status, product_price, extra_fee, travel_fee, assigned_engineer_id, created_at, updated_at").eq("id", T.id).single();
    console.log(`\n▶ ${T.kw} ${T.task_no}`);
    console.log(`  product=${t.product_price} extra=${t.extra_fee} travel=${t.travel_fee} total=${(t.product_price||0)+(t.extra_fee||0)+(t.travel_fee||0)}`);
    console.log(`  created_at=${t.created_at}  updated_at=${t.updated_at}`);
    console.log(`  category_data:`);
    console.log(JSON.stringify(t.category_data, null, 2).split("\n").map(l => "    " + l).join("\n"));
  }

  // 2) 정책 — refrigerant 만 (가능한 컬럼명 시도)
  console.log("\n" + "=".repeat(90));
  console.log("[2] 정책 매칭 — refrigerant (usol_h / yongin / crikrin)");
  console.log("=".repeat(90));

  // 정책 테이블명/컬럼명 후보 — 사용 가능 컬럼만 select
  const policyTableNames = ["commission_policies", "commissions"];
  for (const tbl of policyTableNames) {
    const { data, error } = await sb.from(tbl).select("*").limit(5);
    if (error) {
      console.log(`  ${tbl}: ${error.message}`);
      continue;
    }
    if (data && data.length) {
      console.log(`\n  ${tbl} 샘플 1건 컬럼:`);
      console.log(`    ${Object.keys(data[0]).join(", ")}`);
    } else {
      console.log(`  ${tbl}: 0건`);
    }
  }

  // 3) calculate_commission 직접 호출 — 정책 매칭 확인
  console.log("\n" + "=".repeat(90));
  console.log("[3] calculate_commission RPC 호출 — yongin/crikrin refrigerant + extra");
  console.log("=".repeat(90));

  const probes = [
    { tag: "yongin refrigerant stand 100,000 + 0 extra",  pri: "yongin",  svc: "refrigerant", app: "stand", price: 100000, extra: 0 },
    { tag: "yongin refrigerant stand 100,000 + 220,000",  pri: "yongin",  svc: "refrigerant", app: "stand", price: 100000, extra: 220000 },
    { tag: "yongin refrigerant 2in1 100,000 + 0",         pri: "yongin",  svc: "refrigerant", app: "2in1",  price: 100000, extra: 0 },
    { tag: "yongin refrigerant 2in1 100,000 + 220,000",   pri: "yongin",  svc: "refrigerant", app: "2in1",  price: 100000, extra: 220000 },
    { tag: "crikrin refrigerant stand 0 + 110,000",       pri: "crikrin", svc: "refrigerant", app: "stand", price: 0,      extra: 110000 },
    { tag: "crikrin refrigerant stand 100,000 + 10,000",  pri: "crikrin", svc: "refrigerant", app: "stand", price: 100000, extra: 10000 },
    { tag: "usol_h refrigerant stand 80,000 + 100,000",   pri: "usol_h",  svc: "refrigerant", app: "stand", price: 80000,  extra: 100000 },
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
    if (error) {
      console.log(`  ${p.tag}: ERR ${error.message}`);
    } else {
      console.log(`  ${p.tag}: ${JSON.stringify(data)}`);
    }
  }

  // 4) 유근학 refrigerant_rate 갱신 시점 — users 테이블 audit (가능 시)
  console.log("\n" + "=".repeat(90));
  console.log("[4] 유근학 (assigned_engineer) 정보");
  console.log("=".repeat(90));
  const { data: eng } = await sb.from("users").select("*").eq("id", "77777777-7777-7777-7777-7777777e0016").single();
  console.log(`  name=${eng?.name} refrigerant_rate=${eng?.refrigerant_rate} updated_at=${eng?.updated_at} role=${eng?.role}`);

  // (5/6 단계 — compute_payment 호출은 DB mutate 라 진단 단계서 생략.
  //  원인 확정 후 사장님 OK 측 별도 단계서 실행 예정.)
})().catch(e => console.log("FATAL:", e.message, e.stack));
