// 유솔홈케어 측 계정 측 user_roles 측 principal_id 측 측.
//   sign_in_with_phone (Mig 057) 측 measure user.principals = [{code, ...}] 측 측 측 측.
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // partner role 측 유저 모두 (principals codes)
  const { data: partners } = await sb
    .from("user_roles")
    .select("user_id, role, principal_id, is_primary, users:user_id ( code, name, phone ), principals:principal_id ( code, name )")
    .eq("role", "partner")
    .order("user_id", { ascending: true });

  const byUser = new Map();
  for (const r of (partners || [])) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, { user: r.users, rows: [] });
    byUser.get(r.user_id).rows.push(r);
  }

  console.log(`\n=== partner 측 측 사용자 ${byUser.size}명 + principal 측 ===\n`);
  for (const [uid, info] of byUser.entries()) {
    const u = info.user;
    console.log(`${u?.name || "?"} (${u?.code || "?"} / ${u?.phone || "?"})`);
    for (const r of info.rows) {
      console.log(`  - principal: ${r.principals?.code || "(null)"} ${r.principals?.name || ""} ${r.is_primary ? "*" : ""}`);
    }
  }

  // usol 측 측 측 principals 측
  console.log("\n=== usol_h / usol_n principals row 측 ===");
  const { data: usols } = await sb.from("principals").select("id, code, name").in("code", ["usol_h","usol_n"]);
  for (const p of (usols || [])) {
    console.log(`  ${p.code}: ${p.name} (id=${p.id})`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
