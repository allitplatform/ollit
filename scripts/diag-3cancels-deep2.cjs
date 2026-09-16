const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});

const TASK_NOS=["YS-260518-075","YS-260517-027","YS-260507-023","YS-260514-056"];

(async()=>{
  // task_changes 컬럼 확인
  const{data:tcSample,error:e0}=await sb.from("task_changes").select("*").limit(1);
  if(e0)console.log("task_changes 조회 실패:",e0);
  else if(tcSample?.length>0)console.log("task_changes 컬럼:",Object.keys(tcSample[0]).join(", "));
  else console.log("task_changes 빈 테이블");

  console.log("\n"+"=".repeat(110));
  console.log("[A/B/C] 각 task — full dump + task_changes + status_history");
  console.log("=".repeat(110));
  for(const tn of TASK_NOS){
    const{data:t}=await sb.from("tasks").select("*").eq("task_no",tn).single();
    if(!t){console.log(`\n  ${tn}: NOT FOUND`);continue;}
    console.log(`\n[${tn}] ${t.customer_name} | status=${t.status}`);
    console.log(`  scheduled=${t.scheduled_at?.slice(0,16)} | started=${t.started_at?.slice(0,16)||"NULL"} | completed=${t.completed_at?.slice(0,16)||"NULL"}`);
    console.log(`  created=${t.created_at?.slice(0,19)} | updated=${t.updated_at?.slice(0,19)}`);
    console.log(`  external_order_no=${t.external_order_no} | product_price=${t.product_price}`);
    console.log(`  partial_reason=${t.partial_reason||"NULL"} | cancel_engineer_comp_kind=${t.cancel_engineer_comp_kind||"NULL"} | amount=${t.cancel_engineer_comp_amount||0}`);

    // task_changes — 모든 컬럼 dump
    const{data:changes,error:cErr}=await sb.from("task_changes").select("*").eq("task_id",t.id);
    if(cErr) console.log(`  task_changes 조회 실패: ${cErr.message}`);
    else {
      console.log(`  task_changes: ${(changes||[]).length}건`);
      for(const c of (changes||[])) console.log(`    ${JSON.stringify(c)}`);
    }

    // status_history
    const{data:hist}=await sb.from("status_history").select("*").eq("task_id",t.id);
    console.log(`  status_history: ${(hist||[]).length}건`);
    for(const h of (hist||[])) console.log(`    ${JSON.stringify(h)}`);

    // payments
    const{data:pays}=await sb.from("payments").select("*").eq("task_id",t.id);
    console.log(`  payments: ${(pays||[]).length}건`);
    for(const p of (pays||[])){
      console.log(`    eng=${p.engineer_amount} | prin=${p.principal_amount} | own=${p.owner_amount} | settled=${p.settled_at} | calc=${p.calc_method}`);
    }
  }
})().catch(e=>{console.error("FATAL",e.message,e.stack);process.exit(1);});
