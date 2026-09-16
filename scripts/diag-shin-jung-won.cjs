const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  // 신정원 task 찾기
  const{data:tasks}=await sb.from("tasks").select("id,task_no,customer_name,status,external_order_no,product_price,category_data").or("task_no.eq.YS-N-260526-039,customer_name.eq.신정원");
  console.log(`[A] '신정원' 또는 YS-N-260526-039: ${(tasks||[]).length}건`);
  for(const t of (tasks||[])){
    console.log(`\n  task_no=${t.task_no} | ${t.customer_name} | status=${t.status} | product_price=${t.product_price}`);
    console.log(`  external_order_no=${t.external_order_no}`);
    console.log(`  category_data.workItems = ${JSON.stringify(t.category_data?.workItems)}`);
    
    const{data:items}=await sb.from("task_items").select("*, work_types(code,name), appliance_types(code,name)").eq("task_id",t.id);
    console.log(`  task_items: ${(items||[]).length}행`);
    for(const i of (items||[])){
      console.log(`    ─ id=${i.id.slice(0,8)} | work_type=${i.work_types?.name||"?"}(${i.work_types?.code||"?"}) | appliance=${i.appliance_types?.name||"NULL"} | order_type=${i.order_type} | qty=${i.qty} | unit_price=${i.unit_price} | subtotal=${i.subtotal} | product_order_id=${i.product_order_id}`);
    }
  }
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
