// 운영자 A004 (최수연) push_subscriptions role 진단
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  console.log("=== A004 (최수연) push_subscriptions 진단 ===\n");

  // 1) users 테이블 (code = A004)
  const { data: u, error: ue } = await sb
    .from("users").select("id, code, name, phone, is_active")
    .eq("code", "A004").maybeSingle();
  if (ue) { console.error("users:", ue); process.exit(1); }
  if (!u) { console.log("A004 user 없음"); process.exit(0); }
  console.log("[1] users:", u);

  // 2) user_roles
  const { data: ur } = await sb
    .from("user_roles").select("role, is_primary, principal_id")
    .eq("user_id", u.id);
  console.log("\n[2] user_roles:", ur);

  // 3) push_subscriptions for A004
  const { data: ps } = await sb
    .from("push_subscriptions")
    .select("id, role, ua, last_used_at, created_at, endpoint")
    .eq("user_id", u.id)
    .order("last_used_at", { ascending: false });
  console.log("\n[3] A004 push_subscriptions:", ps?.length || 0, "건");
  (ps || []).forEach((r, i) => {
    console.log(`  [${i+1}] role="${r.role}" last_used=${r.last_used_at}`);
    console.log(`       ua=${(r.ua||"").slice(0,80)}`);
    console.log(`       endpoint_head=${(r.endpoint||"").slice(0,60)}`);
  });

  // 4) 최근 5건 push_subscriptions (전체)
  const { data: recent } = await sb
    .from("push_subscriptions")
    .select("user_id, role, last_used_at, created_at, ua")
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("\n[4] 최근 created_at 5건:");
  (recent || []).forEach((r, i) => {
    console.log(`  [${i+1}] user=${r.user_id?.slice(0,8)}... role="${r.role}" created=${r.created_at}`);
    console.log(`       ua=${(r.ua||"").slice(0,80)}`);
  });

  // 5) role 분포 (전체)
  const { data: all } = await sb
    .from("push_subscriptions").select("role");
  const dist = {};
  (all || []).forEach(r => { dist[r.role || "(empty)"] = (dist[r.role || "(empty)"] || 0) + 1; });
  console.log("\n[5] 전체 role 분포:", dist);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
