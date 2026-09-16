const fs = require("fs"), path = require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});

(async()=>{
  // task_memos 측측 측측 측측?
  const {data, error} = await sb.from("task_memos").select("id").limit(1);
  if (error) {
    console.log("task_memos 측측: ERROR —", error.code, error.message);
  } else {
    console.log(`task_memos 측측 측측 OK — sample count: ${(data || []).length}`);
  }

  // 측측 task_id 측측 측측 측측 측측 측측 — 사장님 측측 측측 측측 측측 측측 측측 측측 measure.
  const candidates = ["task_disputes", "status_history", "task_assignments", "task_changes", "raw_orders"];
  for (const tbl of candidates) {
    try {
      const r = await sb.from(tbl).select("id").limit(1);
      console.log(`${tbl}: ${r.error ? "ERROR " + r.error.code : "OK"}`);
    } catch (e) { console.log(`${tbl}: 측측 — ${e.message}`); }
  }
  process.exit(0);
})();
