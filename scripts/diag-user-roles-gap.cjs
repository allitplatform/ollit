// 진단 — users vs user_roles 차집합 + 역할 분포 (read-only)
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 1) users 전체
  const { data: users } = await sb.from("users").select("id, code, name, phone, email, created_at, must_change_password, password_hash").range(0, 199);
  console.log(`[users] ${(users || []).length}명`);

  // 2) user_roles 전체 (컬럼 안전 확인)
  const { data: roles, error: e2 } = await sb.from("user_roles").select("user_id, role, is_primary").range(0, 999);
  if (e2) {
    // is_primary 없을 수 있어 컬럼 재시도
    const { data: roles2, error: e2b } = await sb.from("user_roles").select("user_id, role").range(0, 999);
    if (e2b) { console.error("user_roles fetch ERR", e2b); return; }
    console.log(`[user_roles] ${(roles2 || []).length}건 (is_primary 컬럼 없음)`);
    var rolesData = roles2 || [];
  } else {
    console.log(`[user_roles] ${(roles || []).length}건`);
    var rolesData = roles || [];
  }

  // 3) [B] role / is_primary 분포
  const byRole = {};
  const byPrimary = { true: 0, false: 0, null: 0 };
  for (const r of rolesData) {
    byRole[r.role || "(NULL)"] = (byRole[r.role || "(NULL)"] || 0) + 1;
    const k = r.is_primary === true ? "true" : r.is_primary === false ? "false" : "null";
    byPrimary[k]++;
  }
  console.log("\n[B] role 분포:", JSON.stringify(byRole));
  console.log("    is_primary 분포:", JSON.stringify(byPrimary));

  // 4) [A] users 중 user_roles 없는 사람
  const userIdsWithRoles = new Set(rolesData.map(r => r.user_id));
  const orphans = (users || []).filter(u => !userIdsWithRoles.has(u.id));
  console.log(`\n[A] ★ user_roles에 row 없는 users: ${orphans.length}명`);
  if (orphans.length === 0) {
    console.log("   ✓ 모든 users가 user_roles 보유 — 권한 누락 0건");
  } else {
    console.log("   ✗ 권한 없어 로그인 못 할 가능성 — 명단:");
    for (const u of orphans) {
      console.log(`     ${(u.created_at || "").slice(0, 10)} | code=${u.code || "?"} | ${u.name || "?"} | phone=${u.phone || "?"} | pw=${u.password_hash ? "✓" : "✗"}`);
    }
  }

  // 5) [E] 최근 신규 기사 user_roles 확인
  const SEVEN_DAYS_AGO = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const recent = (users || []).filter(u => (u.created_at || "") >= SEVEN_DAYS_AGO);
  console.log(`\n[E] 최근 14일 신규 users ${recent.length}명 — user_roles 검증:`);
  for (const u of recent) {
    const myRoles = rolesData.filter(r => r.user_id === u.id);
    const status = myRoles.length === 0 ? "✗ 역할 0건" : `✓ ${myRoles.map(r => r.role).join(",")}`;
    console.log(`  ${(u.created_at || "").slice(0, 16)} | code=${u.code || "?"} | ${u.name || "?"} | pw=${u.password_hash ? "✓" : "✗"} | roles=${status}`);
  }

  // 6) [B-2] 동일 user_id에 여러 role
  const rolesByUser = {};
  for (const r of rolesData) {
    if (!rolesByUser[r.user_id]) rolesByUser[r.user_id] = [];
    rolesByUser[r.user_id].push(r.role);
  }
  const multiRoles = Object.entries(rolesByUser).filter(([_, arr]) => arr.length > 1);
  console.log(`\n[B-2] 다중 역할 user: ${multiRoles.length}명`);
  for (const [uid, arr] of multiRoles.slice(0, 10)) {
    const u = (users || []).find(x => x.id === uid);
    console.log(`  ${u?.name || "?"} (${u?.code || "?"}): [${arr.join(", ")}]`);
  }
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });
