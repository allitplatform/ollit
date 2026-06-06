// 측 측 측 사용자 측 측 측 (user_roles 측 측 측 측 측 행)
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const { data: roles } = await sb
    .from("user_roles")
    .select("user_id, role, is_primary")
    .order("user_id", { ascending: true });

  const byUser = new Map();
  for (const r of (roles || [])) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id).push(r);
  }

  const multi = [...byUser.entries()].filter(([_, rs]) => rs.length >= 2);
  console.log(`\n=== 측 측 측 사용자: ${multi.length}명 ===\n`);
  for (const [uid, rs] of multi) {
    const { data: u } = await sb.from("users").select("code, name, phone").eq("id", uid).maybeSingle();
    const roleStr = rs.map(r => `${r.role}${r.is_primary ? "*" : ""}`).join(", ");
    console.log(`  ${u?.name || "?"} (${u?.code || "?"} / ${u?.phone || "?"}): ${roleStr}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
