const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const PID="22222222-2222-2222-2222-222222222006";
(async()=>{
  const{data,error}=await sb.from("tasks").select("task_no,customer_name,district,address,channel,external_order_no").eq("principal_id",PID).range(0,1999);
  if(error){console.error(error);process.exit(1);}
  const rows=data||[];
  const SIDO=["서울특별시","부산광역시","대구광역시","인천광역시","광주광역시","대전광역시","울산광역시","세종특별자치시","경기도","강원특별자치도","강원도","충청북도","충청남도","전라북도","전라남도","전북특별자치도","경상북도","경상남도","제주특별자치도"];
  const skew=rows.filter(r=>r.district && SIDO.includes(String(r.district).trim()));
  console.log(`전체 usol_n: ${rows.length}건`);
  console.log(`district가 시·도 단위로 저장된 건: ${skew.length}건`);
  const byChannel={};
  for(const r of skew) byChannel[r.channel||"(NULL)"]=(byChannel[r.channel||"(NULL)"]||0)+1;
  console.log(`  채널별:`,JSON.stringify(byChannel));
  // 운영자 수동 입력만 (external_order_no=null) 별도
  const skewManual=skew.filter(r=>!r.external_order_no);
  console.log(`  중 운영자 수동입력(external_order_no=null): ${skewManual.length}건`);
  console.log(`\n샘플 5건:`);
  for(const r of skew.slice(0,5)) console.log(`  ${r.task_no} | ${r.customer_name} | district="${r.district}" | addr="${r.address?.slice(0,40)}..."`);
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
