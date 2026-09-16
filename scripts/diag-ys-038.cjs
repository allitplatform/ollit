const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  const{data,error}=await sb.from("tasks").select("id,task_no,customer_name,address,district,phone,channel,request_note,external_order_no,created_at,principal_id").eq("task_no","YS-N-260526-038");
  console.log("[YS-N-260526-038]");
  if(error){console.error("ERR",error);return;}
  for(const t of (data||[])){
    console.log("  customer_name :", JSON.stringify(t.customer_name));
    console.log("  address       :", JSON.stringify(t.address));
    console.log("  district      :", JSON.stringify(t.district));
    console.log("  phone         :", JSON.stringify(t.phone));
    console.log("  channel       :", JSON.stringify(t.channel));
    console.log("  request_note  :", JSON.stringify(t.request_note));
    console.log("  external_order_no:", JSON.stringify(t.external_order_no));
    console.log("  created_at    :", t.created_at);
  }
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
