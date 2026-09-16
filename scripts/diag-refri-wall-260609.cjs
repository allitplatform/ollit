const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));
L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});

(async()=>{
  // 1) 전체 work_types — refrigerant 측
  const {data: refri} = await sb.from("work_types")
    .select("id, code, name, service_type_id, unit_price, service_types(code, name)")
    .or("code.like.refri%,name.like.%냉매%");
  console.log("=== 냉매 관련 work_types ===");
  for (const r of (refri||[])) {
    console.log(`  ${r.id} · code=${r.code} · name=${r.name} · svc=${r.service_types?.code} · price=${r.unit_price}`);
  }

  // 2) appliance_types — 벽걸이
  const {data: app} = await sb.from("appliance_types").select("id, code, name").or("code.eq.wall,name.eq.벽걸이");
  console.log("\n=== appliance_types (벽걸이) ===");
  for (const a of (app||[])) {
    console.log(`  ${a.id} · code=${a.code} · name=${a.name}`);
  }

  // 3) KA 측 commission_policies — 모든 row
  const {data: ka} = await sb.from("commission_policies")
    .select("policy_key, principal_code, service_code, appliance_code, calc_method, engineer_base, principal_rate, principal_base")
    .eq("principal_code", "KA");
  console.log(`\n=== KA commission_policies (총 ${(ka||[]).length}건) ===`);
  for (const p of (ka||[])) {
    console.log(`  ${p.policy_key} · svc=${p.service_code} · app=${p.appliance_code} · calc=${p.calc_method} · eng_base=${p.engineer_base} · prin_rate=${p.principal_rate} · prin_base=${p.principal_base}`);
  }

  // 4) calculate_commission RPC 측 KA 냉매 측 spec 측정
  const {data: calc, error: calcErr} = await sb.rpc("calculate_commission", {
    p_principal_code: "KA",
    p_service_code:   "refrigerant",
    p_appliance_code: "wall",
    p_unit_price:     70000,
    p_extra_fee:      0,
    p_naver_fee:      0,
    p_qty_cond:       null
  });
  console.log("\n=== calculate_commission(KA, refrigerant, wall, 70000) ===");
  console.log(JSON.stringify(calc || calcErr, null, 2));
})();
