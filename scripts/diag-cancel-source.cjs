const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const PID="22222222-2222-2222-2222-222222222006";
(async()=>{
  // 1) 5/22 22:23 시각 일괄 변경 — 그 시각 status_history 전체
  const{data:bulkH}=await sb.from("status_history").select("*, tasks!inner(task_no, customer_name, principal_id)").gte("changed_at","2026-05-22T22:23:00Z").lte("changed_at","2026-05-22T22:24:00Z").eq("tasks.principal_id",PID);
  console.log(`[5/22 22:23 KST 일괄 status 변경] usol_n: ${(bulkH||[]).length}건`);
  for(const h of (bulkH||[])){
    console.log(`  ${h.tasks.task_no} | ${h.tasks.customer_name} | ${h.from_status}→${h.to_status} | by=${h.changed_by||"NULL"}`);
  }

  // 2) 5/26 15:02 updated_at 일괄 — 그 시각 updated tasks
  const{data:bulkU}=await sb.from("tasks").select("task_no,customer_name,status,updated_at,cancel_engineer_comp_kind,cancel_engineer_comp_amount").eq("principal_id",PID).gte("updated_at","2026-05-26T15:02:00Z").lte("updated_at","2026-05-26T15:03:00Z");
  console.log(`\n[5/26 15:02 KST 일괄 UPDATE] usol_n: ${(bulkU||[]).length}건`);
  for(const t of (bulkU||[])){
    console.log(`  ${t.task_no} | ${t.customer_name} | status=${t.status} | cancel_kind=${t.cancel_engineer_comp_kind||"NULL"} | amount=${t.cancel_engineer_comp_amount||0}`);
  }

  // 3) 김민정 5/25 12:13 — 같은 시각 다른 변경?
  const{data:may25}=await sb.from("status_history").select("*, tasks!inner(task_no, customer_name, principal_id)").gte("changed_at","2026-05-25T12:13:00Z").lte("changed_at","2026-05-25T12:14:00Z").eq("tasks.principal_id",PID);
  console.log(`\n[5/25 12:13 일괄] usol_n: ${(may25||[]).length}건`);
  for(const h of (may25||[])){
    console.log(`  ${h.tasks.task_no} | ${h.tasks.customer_name} | ${h.from_status}→${h.to_status}`);
  }
})().catch(e=>{console.error("FATAL",e.message,e.stack);process.exit(1);});
