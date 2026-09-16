const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  // 김수진 강서로 1way 냉매충전
  const{data}=await sb.from("tasks").select("id,task_no,customer_name,status,scheduled_at,scheduled_confirmed_at,assigned_engineer_id,district,category_data,updated_at").ilike("customer_name","%김수진%").gte("scheduled_at","2026-05-24T00:00:00Z").lte("scheduled_at","2026-05-26T00:00:00Z").range(0,9);
  console.log(`[김수진 5/25 작업] ${(data||[]).length}건`);
  for(const t of (data||[])){
    console.log(`  ${t.task_no} | ${t.customer_name} | district=${t.district} | status=${t.status} | sched=${t.scheduled_at} | confirmed=${t.scheduled_confirmed_at} | eng=${t.assigned_engineer_id?.slice(0,8)} | updated=${t.updated_at}`);
    console.log(`    category_data: ${JSON.stringify(t.category_data)}`);
    if(t.id){
      const{data:hist}=await sb.from("status_history").select("*").eq("task_id",t.id).order("changed_at");
      console.log(`    status_history: ${(hist||[]).length}건`);
      for(const h of (hist||[])) console.log(`      ${h.changed_at?.slice(0,19)} | ${h.from_status}→${h.to_status} | by=${h.changed_by||"NULL"}`);
      const{data:chg}=await sb.from("task_changes").select("change_type,note,changed_at").eq("task_id",t.id).order("changed_at");
      console.log(`    task_changes: ${(chg||[]).length}건`);
      for(const c of (chg||[])) console.log(`      ${c.changed_at?.slice(0,19)} | ${c.change_type} | ${c.note?.slice(0,80)||""}`);
    }
  }
  // 김수진 + 1way + 강서로 동일
  const{data:d2}=await sb.from("tasks").select("task_no,customer_name,address,district,scheduled_at").ilike("customer_name","%김수진%").or("district.ilike.%강서%,address.ilike.%강서%").range(0,5);
  console.log(`\n[김수진 + 강서] ${(d2||[]).length}건`);
  for(const t of (d2||[])) console.log(`  ${t.task_no} | ${t.customer_name} | district=${t.district} | addr=${t.address?.slice(0,30)}`);
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
