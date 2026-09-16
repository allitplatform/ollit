// 2026-06-09 — 월계동9401 (A-260609-004) 종류 정정 진단.
const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));
L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});

(async()=>{
  // 1) task
  const {data: tasks} = await sb.from("tasks")
    .select("id, task_no, customer_name, status, product_price, extra_fee, travel_fee, total_amount, principal_id, category_data, assigned_engineer_id, completed_at")
    .eq("task_no", "A-260609-004").maybeSingle();
  console.log("=== tasks ===");
  console.log(JSON.stringify(tasks, null, 2));

  // 2) principal
  const {data: pr} = await sb.from("principals").select("id, code, name").eq("id", tasks.principal_id).maybeSingle();
  console.log("\n=== principal ===");
  console.log(JSON.stringify(pr, null, 2));

  // 3) task_items
  const {data: items} = await sb.from("task_items")
    .select("id, task_id, work_type_id, appliance_type_id, qty, unit_price, subtotal, naver_settled_at, engineer_settled_at, is_canceled, order_type, work_types(code, name, service_types(code))")
    .eq("task_id", tasks.id);
  console.log("\n=== task_items ===");
  console.log(JSON.stringify(items, null, 2));

  // 4) payments
  const {data: pay} = await sb.from("payments")
    .select("id, task_id, policy_key, calc_method, product_price, extra_fee, travel_fee, engineer_amount, principal_amount, owner_amount, status, track, computed_at")
    .eq("task_id", tasks.id);
  console.log("\n=== payments ===");
  console.log(JSON.stringify(pay, null, 2));

  // 5) 사장님 명시 work_type 확인 (냉매_벽걸이)
  const {data: refriWall} = await sb.from("work_types")
    .select("id, code, name, service_type_id, unit_price, service_types(code)")
    .eq("id", "5460ac23-00000000-0000-0000-000000000000").maybeSingle();
  if (!refriWall) {
    // UUID 정확치 않을 수도 — code 측 검색
    const {data: alt} = await sb.from("work_types")
      .select("id, code, name, service_type_id, unit_price, service_types(code)")
      .ilike("code", "refri_wall").maybeSingle();
    console.log("\n=== 냉매_벽걸이 work_type (code='refri_wall') ===");
    console.log(JSON.stringify(alt, null, 2));
  } else {
    console.log("\n=== 냉매_벽걸이 work_type ===");
    console.log(JSON.stringify(refriWall, null, 2));
  }

  // 6) 옛 visit work_type 확인
  const {data: visitWt} = await sb.from("work_types")
    .select("id, code, name, service_type_id, unit_price")
    .eq("id", "fb2764f3-cfd1-435d-bada-8f6eead40d37").maybeSingle();
  console.log("\n=== 현재 task_item 측 work_type (visit) ===");
  console.log(JSON.stringify(visitWt, null, 2));

  // 7) KA 측 commission_policies (냉매_벽걸이) 정합 — calc_method 측 spec
  const {data: kaPol} = await sb.from("commission_policies")
    .select("policy_key, principal_code, service_code, appliance_code, calc_method, engineer_base, principal_rate")
    .eq("principal_code", "KA")
    .eq("service_code", "refrigerant");
  console.log("\n=== KA 냉매 commission_policies ===");
  console.log(JSON.stringify(kaPol, null, 2));
})();
