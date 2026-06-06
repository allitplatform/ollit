// 조동욱 / 구현서 — user_id / role / push_subscriptions 진단
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const NAMES = ["조동욱", "구현서"];
  for (const nm of NAMES) {
    console.log(`\n=== ${nm} ===`);
    const { data: users } = await sb.from("users").select("id, code, name, phone").ilike("name", `%${nm}%`);
    if (!users || users.length === 0) { console.log("  (없음)"); continue; }
    for (const u of users) {
      console.log(`  user_id=${u.id}`);
      console.log(`    code=${u.code} name=${u.name} phone=${u.phone}`);
      const { data: ur } = await sb.from("user_roles").select("role, is_primary, principal_id").eq("user_id", u.id);
      console.log(`    roles=${(ur||[]).map(x=>`${x.role}${x.is_primary?"*":""}${x.principal_id?`(p=${x.principal_id.slice(0,8)})`:""}`).join(", ") || "(없음)"}`);
      const { data: ps } = await sb.from("push_subscriptions").select("id, role, ua, endpoint, created_at, last_used_at").eq("user_id", u.id).order("created_at", { ascending: false });
      console.log(`    push_subscriptions: ${(ps||[]).length}건`);
      for (const s of (ps||[])) {
        const epHash = s.endpoint ? s.endpoint.slice(-16) : "?";
        const uaShort = (s.ua||"").replace(/Mozilla\/[^\s]+\s*/,"").slice(0, 60);
        console.log(`      [${s.role}] ...${epHash}  ua="${uaShort}"  created=${s.created_at?.slice(0,16)}`);
      }
    }
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
