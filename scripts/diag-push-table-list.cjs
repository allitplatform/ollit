const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  // 1) RPC로 information_schema 조회 — pg_meta 또는 RPC 시도
  const{data:tbls,error}=await sb.rpc("pg_meta_tables");
  if(error) {
    console.log("pg_meta_tables RPC 없음:", error.message);
    // 2) information_schema 직접 SELECT — 일부 환경 가능
    const{data:t2,error:e2}=await sb.from("information_schema.tables").select("table_name").eq("table_schema","public");
    if(e2) console.log("information_schema 접근 불가:", e2.message);
    else console.log("public 테이블:", t2?.map(x=>x.table_name).join(", "));
  } else {
    console.log("테이블:", JSON.stringify(tbls).slice(0,500));
  }
  // 3) 가능한 모든 푸시 관련 이름 — 사장님 실제 사용했을 작명 후보 확장
  const NAMES = [
    "push_subscriptions","push_subscription","push_subs","push_sub",
    "webpush_subscriptions","webpush_subs","web_push_subs",
    "subscriptions","push_targets","push_devices","devices",
    "notifications","engineer_notifications","push_log","push_logs",
    "push_history","push_dispatch","push_outbox","push_inbox",
    "notification_subscriptions","notification_targets","sub","subs",
    "device_subscriptions","client_subscriptions"
  ];
  console.log("\n[추가 후보 테이블 모두 시도]");
  for(const tn of NAMES){
    const{data,error,count}=await sb.from(tn).select("*",{count:"exact",head:true});
    if(!error) console.log(`  ✓ ${tn}: ${count}건`);
  }
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
