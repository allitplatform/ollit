const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  // A) tasks 전체 row + items
  const{data:t}=await sb.from("tasks").select("*").eq("task_no","YS-N-260526-038").single();
  console.log("[A] tasks 컬럼 dump:");
  console.log(JSON.stringify(t,null,2));
  
  if(t){
    const{data:items}=await sb.from("task_items").select("*").eq("task_id",t.id);
    console.log("\n[A] task_items:");
    for(const i of (items||[])) console.log(JSON.stringify(i));
    const{data:pays}=await sb.from("payments").select("*").eq("task_id",t.id);
    console.log("\n[A] payments:");
    for(const p of (pays||[])) console.log(JSON.stringify(p));
  }
})().catch(e=>{console.error("FATAL",e.message,e.stack);process.exit(1);});
