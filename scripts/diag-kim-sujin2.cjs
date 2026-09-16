const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  const{data:t}=await sb.from("tasks").select("task_no, customer_name, assigned_engineer_id, principal_id").eq("task_no","CK-260524-001").single();
  const{data:u}=await sb.from("users").select("code,name").eq("id",t.assigned_engineer_id).single();
  console.log(`[CK-260524-001 김수진] 배정 기사: ${u?.name} (${u?.code})`);
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
