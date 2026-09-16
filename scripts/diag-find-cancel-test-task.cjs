// 임시 — Round 2 D 시뮬용 테스트 task + 최수연 운영자 role 검증
// 2026-05-25 (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 1) 최수연 user 검색
  console.log("═".repeat(80));
  console.log("[1] 최수연 user 검색");
  console.log("═".repeat(80));
  const { data: u } = await sb.from("users")
    .select("id, code, name, phone, email")
    .ilike("name", "%최수연%");
  console.log(`hits: ${(u || []).length}건`);
  (u || []).forEach(x => console.log(`  · id=${x.id} | code=${x.code} | name=${x.name} | phone=${x.phone} | email=${x.email}`));

  if (!u || u.length === 0) {
    console.log("\n❌ 최수연 user 없음. 운영자 후보 다른 이름 검색:");
    const { data: ops } = await sb.from("user_roles")
      .select("user_id, role, users!inner(name, code, email)")
      .in("role", ["owner", "operator"]);
    (ops || []).forEach(r => console.log(`  · role=${r.role} | code=${r.users.code} | name=${r.users.name} | id=${r.user_id}`));
    return;
  }

  // 2) 최수연의 user_roles 조회
  const userId = u[0].id;
  console.log("\n" + "═".repeat(80));
  console.log(`[2] 최수연(${userId}) user_roles 조회`);
  console.log("═".repeat(80));
  const { data: roles } = await sb.from("user_roles").select("*").eq("user_id", userId);
  console.log(`roles: ${(roles || []).length}건`);
  (roles || []).forEach(r => console.log(`  · role=${r.role} | is_primary=${r.is_primary} | principal_id=${r.principal_id || "(NULL)"}`));

  // 3) _caller_is_admin() 시뮬레이션 — owner/operator 포함 여부
  console.log("\n" + "═".repeat(80));
  console.log("[3] _caller_is_admin() 시뮬레이션");
  console.log("═".repeat(80));
  const isAdmin = (roles || []).some(r => r.role === "owner" || r.role === "operator");
  console.log(`  최수연 측 owner/operator 역할 보유: ${isAdmin ? "✅ 통과 — _caller_is_admin()=true" : "❌ 거부 — admin RPC 호출 시 RAISE EXCEPTION"}`);

  // 4) 운영자/owner 역할 보유 전체 목록 (대안 후보)
  console.log("\n" + "═".repeat(80));
  console.log("[4] (참고) owner/operator 역할 보유 user 전체");
  console.log("═".repeat(80));
  const { data: allOps } = await sb.from("user_roles")
    .select("user_id, role, is_primary, users!inner(name, code, email)")
    .in("role", ["owner", "operator"]);
  (allOps || []).forEach(r => console.log(`  · role=${r.role.padEnd(8)} | code=${r.users.code.padEnd(6)} | name=${r.users.name} | id=${r.user_id}`));
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
