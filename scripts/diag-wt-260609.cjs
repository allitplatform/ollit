const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));
L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});

(async()=>{
  // 1) 모든 work_types — refrigerant 측
  const {data: refri} = await sb.from("work_types")
    .select("id, code, name, service_type_id, unit_price, service_types(code, name)");
  console.log(`=== 전체 work_types (${(refri||[]).length}건) ===`);
  // 측 → refri_ 측 또는 name 측 냉매 포함
  const refriOnly = (refri||[]).filter(r => r.code?.startsWith("refri") || /냉매/.test(r.name||""));
  for (const r of refriOnly) {
    console.log(`  ${r.id} · code=${r.code} · name=${r.name} · svc=${r.service_types?.code} · price=${r.unit_price}`);
  }
  // 사장님 명시 5460ac23
  console.log("\n  사장님 명시 5460ac23:");
  const lookup = (refri||[]).find(r => r.id?.startsWith("5460ac23"));
  console.log(lookup ? `    ${JSON.stringify(lookup, null, 2)}` : "    MATCH 없음");

  // 2) commission_policies 측 KA 측 전체
  const {data: pol} = await sb.from("commission_policies").select("*").limit(200);
  console.log(`\n=== commission_policies (${(pol||[]).length}건) ===`);
  const codes = [...new Set((pol||[]).map(p => p.principal_code))].sort();
  console.log(`  principal_code 분포: ${codes.join(", ")}`);
  // 측측 KA 측 측
  const ka = (pol||[]).filter(p => p.principal_code === "KA");
  console.log(`  KA: ${ka.length}건`);
  ka.forEach(p => console.log(`    ${p.policy_key} · svc=${p.service_code} · app=${p.appliance_code} · calc=${p.calc_method}`));
  // 또 column 측 spec
  if (pol && pol[0]) {
    console.log("\n  columns:", Object.keys(pol[0]).join(", "));
  }

  // 3) calculate_commission 정확 RPC spec
  const {data: calc, error: calcErr} = await sb.rpc("calculate_commission", {
    p_principal_code: "KA",
    p_service_code:   "refrigerant",
    p_appliance_code: "wall",
    p_quoted_amount:  70000,
    p_extra_amount:   0,
    p_naver_fee:      0,
    p_qty_condition:  null
  });
  console.log("\n=== calculate_commission(KA, refrigerant, wall, 70000) — corrected args ===");
  console.log(JSON.stringify(calc || calcErr, null, 2));
})();
