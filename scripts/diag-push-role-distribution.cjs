// push_subscriptions role 분포 + user별 endpoint 누적 현황 진단
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const { data: all } = await sb
    .from("push_subscriptions")
    .select("id, user_id, role, ua, endpoint, created_at, last_used_at")
    .order("user_id", { ascending: true })
    .order("created_at", { ascending: false });

  console.log(`\n=== 전체 push_subscriptions: ${(all||[]).length}건 ===\n`);

  // role 분포
  const roleCount = {};
  for (const r of (all||[])) {
    const k = r.role || "(빈값)";
    roleCount[k] = (roleCount[k] || 0) + 1;
  }
  console.log("--- role 분포 ---");
  for (const [k, v] of Object.entries(roleCount).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${k}: ${v}건`);
  }

  // user별 그룹
  const byUser = new Map();
  for (const r of (all||[])) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id).push(r);
  }

  console.log(`\n--- user별 endpoint 수 (2건 이상만) ---`);
  const multi = [...byUser.entries()].filter(([_, rs]) => rs.length >= 2);
  for (const [uid, rs] of multi.sort((a,b) => b[1].length - a[1].length)) {
    const { data: u } = await sb.from("users").select("code, name").eq("id", uid).maybeSingle();
    console.log(`\n  ${u?.name || "?"} (${u?.code || "?"}) — ${rs.length}건`);
    // role / ua / 최근사용 / 생성일
    for (const r of rs) {
      const ua = (r.ua || "").replace(/Mozilla\/[^\s]+\s*/,"").slice(0, 50);
      const last = r.last_used_at?.slice(0, 16) || "-";
      const created = r.created_at?.slice(0, 16) || "-";
      const stale = (Date.now() - new Date(r.last_used_at || 0).getTime()) / 86400000;
      const staleStr = stale > 7 ? ` ⚠️${Math.round(stale)}일전` : "";
      console.log(`    [${r.role||"빈값"}] last=${last} created=${created}${staleStr}  ua="${ua}"`);
    }
  }

  // 빈 role 측 측
  console.log(`\n--- role="" (빈값) 측 측 ---`);
  const blank = (all||[]).filter(r => !r.role);
  console.log(`  ${blank.length}건`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
