// 측측 측측 mark_visit_only RPC 측측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // pg_proc 측 측측 측측측 (RPC 측측 측측)
  const { data, error } = await sb.rpc("exec_sql", { sql: "SELECT pg_get_functiondef('public.mark_visit_only'::regproc)" }).catch(e => ({ error: e }));
  if (error) {
    console.log("측 RPC 측측 측측 — pg_proc 측측 측측");
    const { data: dump } = await sb.from("pg_proc").select("prosrc").eq("proname","mark_visit_only").limit(1);
    if (dump && dump.length > 0) {
      console.log(dump[0].prosrc);
    } else {
      console.log("측측 측측");
    }
  } else {
    console.log(data);
  }
})().catch(e => { console.error("FATAL", e); });
