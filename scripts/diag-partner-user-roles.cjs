// KA/crikrin partner 계정 + user_roles row 확인 (Phase 1-G).
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname,"..",".env"));
L(path.join(__dirname,"..",".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 1) KA/crikrin principal id
  const { data: ps } = await sb.from("principals").select("id, code, name").in("code", ["KA", "crikrin"]);
  console.log("=== Principals ===");
  ps.forEach(p => console.log(`  ${p.code} / ${p.name} / id=${p.id}`));
  const pidByCode = Object.fromEntries(ps.map(p => [p.code, p.id]));

  // 2) 각 principal 의 partner role 보유 user_roles 행
  for (const code of ["KA", "crikrin"]) {
    const pid = pidByCode[code];
    if (!pid) continue;
    const { data: roles } = await sb.from("user_roles")
      .select("user_id, role, is_primary, principal_id, granted_at")
      .eq("role", "partner")
      .eq("principal_id", pid);
    console.log(`\n=== ${code} (${pid}) partner user_roles ===`);
    if (!roles || roles.length === 0) {
      console.log("  ❌ 없음 — partner 계정 미설정. update_task_basic RPC 측 'role_not_allowed' 거부됨.");
    } else {
      for (const r of roles) {
        const { data: u } = await sb.from("users").select("code, name, phone").eq("id", r.user_id).maybeSingle();
        console.log(`  ✓ user=${u?.code || "?"} ${u?.name || "?"} (${u?.phone || "?"}) is_primary=${r.is_primary} granted=${r.granted_at}`);
      }
    }
  }

  // 3) 운영자 (admin role) 보유 user_roles 표본
  const { data: admins } = await sb.from("user_roles")
    .select("user_id, role")
    .in("role", ["owner", "admin", "operator"]);
  console.log(`\n=== 운영자 role 보유 user_roles 총 ${admins?.length || 0}건 ===`);
  for (const r of (admins || []).slice(0, 5)) {
    const { data: u } = await sb.from("users").select("code, name").eq("id", r.user_id).maybeSingle();
    console.log(`  ${r.role} / ${u?.code || "?"} ${u?.name || "?"}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
