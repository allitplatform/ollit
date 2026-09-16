// 진단 — 원청 계정 role 분포 vs _get_caller_partner_principal() 검사 조건
// 2026-05-25 (read-only)

const fs = require("fs"), path = require("path");
function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function bar(c = "═", n = 100) { return c.repeat(n); }
function head(s) { console.log("\n" + bar()); console.log(s); console.log(bar()); }
function sub(s)  { console.log("\n" + bar("─")); console.log(s); console.log(bar("─")); }

(async () => {
  head("진단 — 원청 계정 role 분포");

  // 1) principals 목록
  sub("[1] principals 목록");
  const { data: principals } = await sb.from("principals").select("id, code, name").order("code");
  console.log(`  ${(principals || []).length}건`);
  (principals || []).forEach(p => console.log(`  · code=${p.code.padEnd(10)} | name=${p.name} | id=${p.id}`));

  // 2) user_roles 전체 role 값 분포 (CHECK 통과한 값들)
  sub("[2] user_roles 전체 role 값 분포");
  const { data: allRoles } = await sb.from("user_roles").select("role");
  const roleCount = new Map();
  (allRoles || []).forEach(r => roleCount.set(r.role, (roleCount.get(r.role) || 0) + 1));
  [...roleCount.entries()].sort().forEach(([k, v]) => console.log(`  · ${k}: ${v}건`));

  // 3) principal_id NOT NULL 인 user_roles — 어떤 role 값을 갖는지
  sub("[3] principal_id NOT NULL 인 user_roles (= 원청 계정 후보)");
  const { data: principalLinkedRoles } = await sb.from("user_roles")
    .select("user_id, role, is_primary, principal_id, granted_at, users!inner(name, code, email), principals!inner(code, name)")
    .not("principal_id", "is", null)
    .order("principal_id");
  console.log(`  ${(principalLinkedRoles || []).length}건`);
  (principalLinkedRoles || []).forEach(r => {
    console.log(`  · principal=${r.principals.code.padEnd(10)} | user=${r.users.name}(${r.users.code}) | role=${r.role} | primary=${r.is_primary}`);
  });

  // 4) _get_caller_partner_principal() 검사 조건 — role='partner' 인 user_roles
  sub("[4] _get_caller_partner_principal() 통과 후보 — role='partner' 인 user_roles");
  const { data: partnerRoles } = await sb.from("user_roles")
    .select("user_id, role, principal_id, users!inner(name, code), principals(code)")
    .eq("role", "partner");
  console.log(`  ${(partnerRoles || []).length}건`);
  (partnerRoles || []).forEach(r => {
    console.log(`  · user=${r.users.name}(${r.users.code}) | principal=${r.principals?.code || "(NULL)"} | id=${r.user_id}`);
  });
  if ((partnerRoles || []).length === 0) {
    console.log(`  ❌ role='partner' 인 행 0건 — _get_caller_partner_principal() 측 LIMIT 1 측 항상 NULL`);
    console.log(`     → partner_full_cancel 측 '권한 없음 — partner 역할 필요' RAISE EXCEPTION`);
  }

  // 5) '유솔' 이름 검색 — 어떤 계정으로 원청 앱 로그인하는지 후보
  sub("[5] 이름에 '유솔' 포함 user 검색");
  const { data: usolUsers } = await sb.from("users")
    .select("id, code, name, phone, email")
    .ilike("name", "%유솔%");
  console.log(`  ${(usolUsers || []).length}건`);
  (usolUsers || []).forEach(u => console.log(`  · code=${u.code} | name=${u.name} | id=${u.id} | email=${u.email}`));

  // 6) 각 유솔 user 측 user_roles
  if (usolUsers && usolUsers.length > 0) {
    sub("[6] 유솔 user 측 user_roles 상세");
    const userIds = usolUsers.map(u => u.id);
    const { data: roles } = await sb.from("user_roles")
      .select("user_id, role, is_primary, principal_id, principals(code, name)")
      .in("user_id", userIds);
    (roles || []).forEach(r => {
      const u = usolUsers.find(x => x.id === r.user_id);
      console.log(`  · ${u?.name}(${u?.code}) | role=${r.role} | primary=${r.is_primary} | principal=${r.principals?.code || "(NULL)"}`);
    });
  }

  // 7) 6 원청 계정별 user 분포 — KA/KB/yongin/usol_h/usol_n/crikrin/allday
  sub("[7] 6 원청 계정별 user_roles 분포");
  const codes = ["allday", "KA", "KB", "yongin", "usol_h", "usol_n", "crikrin"];
  for (const code of codes) {
    const principal = (principals || []).find(p => p.code === code);
    if (!principal) {
      console.log(`  · ${code}: principal 없음`);
      continue;
    }
    const { data: prs } = await sb.from("user_roles")
      .select("user_id, role, is_primary, users!inner(name, code, email)")
      .eq("principal_id", principal.id);
    console.log(`  · ${code}: ${(prs || []).length}건`);
    (prs || []).forEach(r => {
      console.log(`      → user=${r.users.name}(${r.users.code}) | role=${r.role} | primary=${r.is_primary} | email=${r.users.email}`);
    });
  }

  // 8) Root cause 분석
  head("Root cause 분석");
  const partnerCount = (partnerRoles || []).length;
  const principalLinkedCount = (principalLinkedRoles || []).length;
  console.log(`  · role='partner' 행 : ${partnerCount}건`);
  console.log(`  · principal_id NOT NULL 행 : ${principalLinkedCount}건`);
  if (partnerCount === 0 && principalLinkedCount > 0) {
    console.log(`\n  ❗ root cause 후보:`);
    console.log(`     - 원청 계정 측 role 값이 'partner' 아닌 다른 값으로 시드됨.`);
    console.log(`     - _get_caller_partner_principal() 측 role='partner' 만 검사 → 항상 NULL.`);
    console.log(`\n  실제 사용된 role 값 (principal_id NOT NULL 행 기준):`);
    const usedRoles = new Set();
    (principalLinkedRoles || []).forEach(r => usedRoles.add(r.role));
    [...usedRoles].forEach(r => console.log(`     · '${r}'`));
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
