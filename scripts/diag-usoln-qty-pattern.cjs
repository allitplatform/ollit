const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const PID="22222222-2222-2222-2222-222222222006";
(async()=>{
  // 1) usol_n 중 qty>=2인 task_items + customer_paid_amount 비교 — 10건 샘플
  const{data}=await sb.from("task_items").select("id, task_id, qty, unit_price, subtotal, customer_paid_amount, product_order_id, tasks!inner(task_no, principal_id, product_price)").gte("qty",2).eq("tasks.principal_id",PID).limit(15);
  console.log(`[샘플 — qty>=2 usol_n task_items 15건]`);
  console.log(`task_no | qty | unit_price | subtotal | customer_paid | unit_price×qty=? | customer_paid/qty=?`);
  for(const r of (data||[])){
    const expected = r.unit_price * r.qty;
    const cpPerQty = r.customer_paid_amount ? Math.round(r.customer_paid_amount / r.qty) : null;
    console.log(`  ${r.tasks.task_no} | qty=${r.qty} | up=${r.unit_price} | sub=${r.subtotal} | cp=${r.customer_paid_amount} | up×qty=${expected} ${expected===r.subtotal?"✓":"✗"} | cp/qty=${cpPerQty}`);
  }
  // 2) usol_n 전체 — qty>=2인 item 통계 (이중곱 영향 범위)
  const{count:cntQ2}=await sb.from("task_items").select("id",{count:"exact",head:true}).gte("qty",2).eq("tasks.principal_id",PID);
  // 위 count는 inner join 안 통할 수 있어 직접 카운트
  const{data:allUsolnItems}=await sb.from("task_items").select("id,qty,unit_price,subtotal,tasks!inner(principal_id)").eq("tasks.principal_id",PID);
  const items=allUsolnItems||[];
  const q2=items.filter(i=>i.qty>=2);
  const totalSubQ2=q2.reduce((s,i)=>s+(i.subtotal||0),0);
  const correctedTotal=q2.reduce((s,i)=>s+(i.unit_price||0),0);  // 만약 unit_price가 합계라면 그대로 = 정확
  console.log(`\n[영향 범위]`);
  console.log(`  usol_n task_items 전체: ${items.length}행`);
  console.log(`  qty>=2 항목: ${q2.length}행`);
  console.log(`  현재 subtotal 합 (qty>=2): ₩${totalSubQ2.toLocaleString()}`);
  console.log(`  만약 unit_price가 이미 수량합계였다면 정확한 합: ₩${correctedTotal.toLocaleString()}`);
  console.log(`  차액(부풀어 오른 금액): ₩${(totalSubQ2-correctedTotal).toLocaleString()}`);
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
