const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const PID="22222222-2222-2222-2222-222222222006";
(async()=>{
  // 판정: unit_price > customer_paid / qty → unit_price가 합계로 들어옴 = subtotal 이중곱
  const{data}=await sb.from("task_items").select("id,task_id,qty,unit_price,subtotal,customer_paid_amount,tasks!inner(task_no,principal_id,customer_name,external_order_no,created_at)").gte("qty",2).eq("tasks.principal_id",PID);
  const items=data||[];
  const susp=items.filter(i=>{
    if(!i.customer_paid_amount||!i.qty) return false;
    const perUnit=i.customer_paid_amount/i.qty;
    return i.unit_price > perUnit;
  });
  console.log(`[이중곱 의심 — unit_price > customer_paid/qty]`);
  console.log(`전체 qty>=2 usol_n items: ${items.length}행`);
  console.log(`의심 행: ${susp.length}행`);
  // 손실 추정
  let bloated=0, correct=0;
  for(const i of susp){
    bloated += i.subtotal||0;
    correct += i.unit_price||0;   // unit_price가 합계라면 그대로가 정확한 subtotal
  }
  console.log(`  의심 행 현재 subtotal 합:    ₩${bloated.toLocaleString()}`);
  console.log(`  unit_price 합 (정정 추정값):  ₩${correct.toLocaleString()}`);
  console.log(`  차액 (부풀어 오른 금액):       ₩${(bloated-correct).toLocaleString()}`);
  
  // 영향 받은 task 수 (중복 제거)
  const taskIds=new Set(susp.map(i=>i.task_id));
  console.log(`  영향 받은 task 수: ${taskIds.size}건`);
  
  // 상위 10건
  console.log(`\n샘플 (의심 행 상위 10):`);
  for(const i of susp.slice(0,10)){
    console.log(`  ${i.tasks.task_no} | ${i.tasks.customer_name} | qty=${i.qty} | up=${i.unit_price} | sub=${i.subtotal} | cp=${i.customer_paid_amount} | cp/qty=${Math.round(i.customer_paid_amount/i.qty)} | ext_order=${i.tasks.external_order_no?'있음':'NULL'} | ${i.tasks.created_at?.slice(0,10)}`);
  }
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
