const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  // notifications 테이블 (인앱 알림)
  const N=["notifications","alerts","in_app_notifications","engineer_notifications"];
  for(const tn of N){
    const{data,error,count}=await sb.from(tn).select("*",{count:"exact",head:false}).range(0,2);
    if(error)console.log(`  ${tn}: ${error.code} ${error.message?.slice(0,60)}`);
    else console.log(`  ✓ ${tn}: ${count}건 / 컬럼: ${data?.[0]?Object.keys(data[0]).join(", "):"(빈)"}`);
  }
  // pg_net 큐 확인 — 실제 푸시 호출 흔적 있는지 (Supabase 권한 따라 안 될 수 있음)
  const{data:net,error:nErr}=await sb.from("_http_response").select("id,status_code,created").order("created",{ascending:false}).range(0,5);
  if(nErr)console.log(`\n  net._http_response: ${nErr.code} ${nErr.message?.slice(0,60)} (권한 제한 시 정상)`);
  else console.log(`\n  net._http_response 최근 5건:`,(net||[]).map(r=>`${r.created?.slice(0,16)} status=${r.status_code}`).join(" / "));
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
