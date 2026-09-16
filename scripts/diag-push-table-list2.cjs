const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  const NAMES=["push_subscriptions","push_subscription","push_subs","push_sub","webpush_subscriptions","webpush_subs","web_push_subs","subscriptions","push_targets","push_devices","devices","notifications","engineer_notifications","push_log","push_logs","push_history","push_dispatch","push_outbox","push_inbox","notification_subscriptions","notification_targets","subs","device_subscriptions","client_subscriptions","push_notifications","alerts","push_endpoint","endpoints"];
  console.log("[정확 확인 — select(*) range(0,4)]");
  for(const tn of NAMES){
    const{data,error}=await sb.from(tn).select("*").range(0,4);
    if(error){
      if(error.code==="PGRST205") {} // 없음 — 출력 생략
      else console.log(`  ${tn}: ERR ${error.code} ${error.message?.slice(0,60)}`);
    } else {
      const cols = data?.[0] ? Object.keys(data[0]).join(", ") : "(빈 row)";
      console.log(`  ★ ${tn}: ${(data||[]).length}건 / 컬럼: ${cols}`);
    }
  }
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
