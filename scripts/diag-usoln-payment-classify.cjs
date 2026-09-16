const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const PID="22222222-2222-2222-2222-222222222006";
(async()=>{
  const{data}=await sb.from("tasks").select("task_no,channel,external_order_no,status").eq("principal_id",PID).range(0,1999);
  const r=data||[];
  console.log(`전체 usol_n: ${r.length}건`);
  // 분류
  const naverCsv = r.filter(t => t.external_order_no);          // CSV/sheet 업로드 (네이버 발주)
  const manual   = r.filter(t => !t.external_order_no);         // 수동 입력
  console.log(`  ① 네이버 발주 (external_order_no 있음): ${naverCsv.length}`);
  console.log(`  ② 수동 입력 (external_order_no NULL): ${manual.length}`);
  // 수동 입력의 채널 분포
  const byCh={};
  for(const t of manual) byCh[t.channel||"(NULL)"]=(byCh[t.channel||"(NULL)"]||0)+1;
  console.log(`     수동 입력 채널별:`, JSON.stringify(byCh));
  // 채널="네이버"인데 external_order_no NULL — 채널과 실제 발주 출처가 어긋난 케이스
  const channelNaverNoExt = manual.filter(t => t.channel === "네이버");
  console.log(`\n  ★ channel='네이버' AND external_order_no NULL: ${channelNaverNoExt.length}건 (네이버 CSV 아님)`);
  for(const t of channelNaverNoExt.slice(0,10)) console.log(`     ${t.task_no} | status=${t.status}`);
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
