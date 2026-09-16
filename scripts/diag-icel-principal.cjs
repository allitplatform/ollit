const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  const{data:t}=await sb.from("tasks").select("task_no,customer_name,principal_id,status").in("task_no",["YS-260427-061","YS-260507-023","YS-260517-027","YS-260518-075"]);
  console.log("principal_id 확인:");
  for(const r of (t||[])) console.log(`  ${r.task_no} | ${r.customer_name} | principal_id=${r.principal_id} | status=${r.status}`);
  const{data:p}=await sb.from("principals").select("id,code,name");
  console.log("\nprincipals:");
  for(const r of (p||[])) console.log(`  ${r.id} | ${r.code} | ${r.name}`);
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
