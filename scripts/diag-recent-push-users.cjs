// 최근 push_subscriptions에 등장한 user_id들의 정체 확인
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 최근 push_subscriptions user_id 5개
  const { data: recent } = await sb
    .from("push_subscriptions")
    .select("user_id, role, last_used_at, created_at, ua")
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("=== 최근 push_subscriptions 10건 + user 정보 ===\n");
  for (const r of (recent || [])) {
    const { data: u } = await sb.from("users").select("code, name, phone").eq("id", r.user_id).maybeSingle();
    const { data: ur } = await sb.from("user_roles").select("role, is_primary").eq("user_id", r.user_id);
    const roles = (ur || []).map(x => `${x.role}${x.is_primary?"*":""}`).join(",");
    console.log(`user=${r.user_id?.slice(0,8)}... code=${u?.code||"?"} name=${u?.name||"?"} phone=${u?.phone||"?"}`);
    console.log(`  push_role="${r.role}" db_roles=[${roles}] created=${r.created_at}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
