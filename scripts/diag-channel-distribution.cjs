const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  // 전체 tasks 채널 분포
  const{data,error}=await sb.from("tasks").select("channel,principal_id").range(0,9999);
  if(error){console.error(error);process.exit(1);}
  const rows=data||[];
  console.log(`전체 tasks: ${rows.length}건`);
  // principal 별칭
  const PRI={
    "11111111-1111-1111-1111-111111111111":"(테넌트?)",
    "22222222-2222-2222-2222-222222222001":"allday",
    "22222222-2222-2222-2222-222222222002":"KA",
    "22222222-2222-2222-2222-222222222003":"KB",
    "22222222-2222-2222-2222-222222222004":"yongin",
    "22222222-2222-2222-2222-222222222005":"usol_h",
    "22222222-2222-2222-2222-222222222006":"usol_n",
    "22222222-2222-2222-2222-222222222007":"crikrin",
  };
  // 채널 분포 전체
  const ch={};
  for(const r of rows) ch[r.channel||"(NULL)"]=(ch[r.channel||"(NULL)"]||0)+1;
  console.log(`\n채널 분포 (전체):`);
  for(const[k,v]of Object.entries(ch).sort((a,b)=>b[1]-a[1])) console.log(`  ${k}: ${v}`);
  // 원청별 채널 분포
  console.log(`\n원청 × 채널 (상위 10조합):`);
  const px={};
  for(const r of rows){
    const k=`${PRI[r.principal_id]||r.principal_id.slice(0,8)} / ${r.channel||"(NULL)"}`;
    px[k]=(px[k]||0)+1;
  }
  for(const[k,v]of Object.entries(px).sort((a,b)=>b[1]-a[1]).slice(0,15)) console.log(`  ${k}: ${v}`);
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
