const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  const TABLES=["push_subscriptions","subscriptions","web_push","push","push_subs","engineer_push_subscriptions","user_push_subscriptions"];
  for(const tn of TABLES){
    const{data,error,count}=await sb.from(tn).select("*",{count:"exact",head:false}).range(0,4);
    if(error) console.log(`  ${tn}: ${error.code} ${error.message?.slice(0,60)}`);
    else console.log(`  ✓ ${tn}: ${count}건 / 컬럼: ${data?.[0]?Object.keys(data[0]).join(", "):"(빈 테이블)"}`);
  }
  console.log("\n[환경변수]");
  console.log("  GAS_WEBAPP_URL :", process.env.GAS_WEBAPP_URL ? `있음 (${process.env.GAS_WEBAPP_URL.slice(0,50)}...)` : "❌ 없음");
  console.log("  SUPABASE_URL   :", process.env.SUPABASE_URL ? "있음" : (process.env.VITE_SUPABASE_URL ? "VITE만 있음" : "❌"));
  console.log("  PUSH_API_KEY   :", process.env.PUSH_API_KEY ? "있음" : "❌ 없음");
  console.log("  VAPID_PUBLIC   :", process.env.VITE_VAPID_PUBLIC ? "있음" : "❌");
  console.log("  VAPID_PRIVATE  :", process.env.VAPID_PRIVATE ? "있음" : "❌");
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
