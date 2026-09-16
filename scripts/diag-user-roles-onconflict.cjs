// user_roles ON CONFLICT 오류 + 이연신 누락 진단 (SELECT only)
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // [A] user_roles 제약 + 인덱스 (RPC가 없으면 직접 PG metadata 못 봄 — Supabase는 information_schema 일부만 노출)
  console.log("=".repeat(140));
  console.log("[A] user_roles 제약/인덱스 — Supabase 통해 PG metadata 직접 조회 불가");
  console.log("=".repeat(140));
  console.log("→ 코드로 알 수 있는 사실 (db/migrations 분석 결과):");
  console.log("  · 001_init.sql:63  PRIMARY KEY (user_id, role)  ← 옛 제약");
  console.log("  · 057_user_roles_multi_principal.sql:");
  console.log("    [32]  ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;");
  console.log("    [34]  CREATE UNIQUE INDEX user_roles_uk_no_principal");
  console.log("            ON user_roles (user_id, role) WHERE principal_id IS NULL;  ← PARTIAL!");
  console.log("    [38]  CREATE UNIQUE INDEX user_roles_uk_with_principal");
  console.log("            ON user_roles (user_id, role, principal_id) WHERE principal_id IS NOT NULL;  ← PARTIAL!");
  console.log("");
  console.log("→ ★ PG는 ON CONFLICT 타겟 매칭 시 partial index의 predicate(WHERE)도 명시해야 매칭");
  console.log("   Supabase JS client의 onConflict: 'user_id,role' 만으로는 둘 다 매칭 못함");
  console.log("   → '역할 부여 실패: there is no unique or exclusion constraint matching' 정확히 이 케이스");
  console.log("");
  console.log("→ pg_constraint 직접 조회는 사장님이 SQL Editor에서 다음 실행하면 표 볼 수 있음:");
  console.log("    SELECT conname, contype, pg_get_constraintdef(oid)");
  console.log("      FROM pg_constraint WHERE conrelid = 'user_roles'::regclass;");
  console.log("    SELECT indexname, indexdef FROM pg_indexes WHERE tablename='user_roles';");

  // [B] user_roles 컬럼 — sample row 1개로 확인
  console.log("\n" + "=".repeat(140));
  console.log("[B] user_roles 컬럼 구조 (sample row 1개)");
  console.log("=".repeat(140));
  const { data: sample } = await sb.from("user_roles").select("*").limit(1);
  if (sample?.[0]) {
    console.log(`  컬럼: ${Object.keys(sample[0]).join(", ")}`);
    console.log(`  sample: ${JSON.stringify(sample[0])}`);
  }

  // [C] 코드 분석 결과
  console.log("\n" + "=".repeat(140));
  console.log("[C] upsertEngineerToDb의 onConflict 지정 (src/lib/engineersDb.js)");
  console.log("=".repeat(140));
  console.log("  INSERT 분기 (200줄): onConflict: 'user_id,role'");
  console.log("  UPDATE 분기 (175줄): onConflict: 'user_id,role' + ignoreDuplicates:true");
  console.log("  → 두 분기 모두 동일한 단순 컬럼 리스트 — partial index predicate 미지정");
  console.log("  → 둘 다 같은 에러 발생할 것");

  // [D] 중복 검사
  console.log("\n" + "=".repeat(140));
  console.log("[D] user_roles 중복 검사 (UNIQUE 정정 위한 사전 점검)");
  console.log("=".repeat(140));
  const { data: allRoles } = await sb.from("user_roles").select("user_id, role, principal_id").limit(5000);
  console.log(`  전체 row: ${(allRoles || []).length}`);
  // (user_id, role) 중복
  const noPidKeyCount = new Map();
  const withPidKeyCount = new Map();
  for (const r of (allRoles || [])) {
    if (r.principal_id === null) {
      const k = `${r.user_id}|${r.role}`;
      noPidKeyCount.set(k, (noPidKeyCount.get(k) || 0) + 1);
    } else {
      const k = `${r.user_id}|${r.role}|${r.principal_id}`;
      withPidKeyCount.set(k, (withPidKeyCount.get(k) || 0) + 1);
    }
  }
  const dupNoPid = [...noPidKeyCount.entries()].filter(([_, n]) => n > 1);
  const dupWithPid = [...withPidKeyCount.entries()].filter(([_, n]) => n > 1);
  console.log(`  (user_id, role) 중복 [principal_id IS NULL]    : ${dupNoPid.length}건`);
  for (const [k, n] of dupNoPid) console.log(`    ${k} → ${n}회`);
  console.log(`  (user_id, role, principal_id) 중복 [NOT NULL]  : ${dupWithPid.length}건`);
  for (const [k, n] of dupWithPid) console.log(`    ${k} → ${n}회`);
  // 같은 (user_id, role) 인데 한쪽은 principal_id NULL, 다른쪽은 NOT NULL 인 경우 (혼재)
  const mixedKeys = new Map();
  for (const r of (allRoles || [])) {
    const k = `${r.user_id}|${r.role}`;
    if (!mixedKeys.has(k)) mixedKeys.set(k, { nulls: 0, notnulls: 0 });
    const v = mixedKeys.get(k);
    if (r.principal_id === null) v.nulls++; else v.notnulls++;
  }
  const mixed = [...mixedKeys.entries()].filter(([_, v]) => v.nulls > 0 && v.notnulls > 0);
  console.log(`  같은 (user_id, role) 의 principal_id NULL/NOT NULL 혼재: ${mixed.length}건`);
  for (const [k, v] of mixed.slice(0, 5)) console.log(`    ${k} → NULL=${v.nulls}, NOT_NULL=${v.notnulls}`);

  // [E] 이연신 찾기
  console.log("\n" + "=".repeat(140));
  console.log("[E] 이연신 (010-5609-1181) users + user_roles 조회");
  console.log("=".repeat(140));
  // 하이픈 유무 양쪽 검색
  const { data: byPhoneA } = await sb.from("users").select("*").or("phone.eq.01056091181,phone.eq.010-5609-1181,phone.ilike.%5609-1181%,phone.ilike.%56091181%");
  const { data: byName } = await sb.from("users").select("*").ilike("name", "%이연신%");
  const candidates = [...(byPhoneA || []), ...(byName || [])];
  const uniq = new Map();
  for (const u of candidates) uniq.set(u.id, u);
  const found = [...uniq.values()];
  console.log(`  매칭 user 수: ${found.length}`);
  for (const u of found) {
    console.log(`  ─ id=${u.id}`);
    console.log(`    code=${u.code}  name=${u.name}  phone=${u.phone}`);
    console.log(`    tenant_id=${u.tenant_id}  is_active=${u.is_active}`);
    console.log(`    password_hash=${u.password_hash ? "있음("+String(u.password_hash).slice(0,12)+"…)" : "NULL"}`);
    console.log(`    must_change_password=${u.must_change_password}`);
    console.log(`    created_at=${u.created_at}  updated_at=${u.updated_at}`);
    // user_roles 조회
    const { data: roles } = await sb.from("user_roles").select("*").eq("user_id", u.id);
    console.log(`    user_roles: ${(roles || []).length}건`);
    for (const r of (roles || [])) console.log(`      role=${r.role}  is_primary=${r.is_primary}  principal_id=${r.principal_id || "NULL"}`);
  }

  // [F] "프로 관리" 목록 쿼리 필터 — engineersDb.js fetchEngineersFromDb 로직 재현
  console.log("\n" + "=".repeat(140));
  console.log("[F] '프로 관리' 목록 쿼리 — fetchEngineersFromDb 동작 재현");
  console.log("=".repeat(140));
  console.log("  로직 (engineersDb.js):");
  console.log("    [1] user_roles WHERE role='engineer' → user_id 목록");
  console.log("    [2] users WHERE id IN (위 목록)");
  console.log("    → user_roles에 engineer 역할 없으면 절대 보이지 않음");
  console.log("");
  console.log("  이연신이 위에서 매칭된 경우 — user_roles.role='engineer' 행이 0건이면 이게 정답.");

  // 추가: engineer role user 수
  const { data: engRoles } = await sb.from("user_roles").select("user_id").eq("role", "engineer");
  console.log(`\n  현재 engineer 역할 가진 user_id 총 수: ${(engRoles || []).length}`);
  const { data: engUsers } = await sb.from("users").select("id, code, name").in("id", (engRoles || []).map(r => r.user_id)).order("code");
  console.log(`  대응 users 행: ${(engUsers || []).length}`);

  // users 에는 있지만 engineer 역할 없는 (잠재 ghost users) — 이름에 기사 패턴 있는지
  const allUserIds = new Set((engUsers || []).map(u => u.id));
  const { data: allUsers } = await sb.from("users").select("id, code, name, phone, created_at").limit(2000);
  const ghosts = (allUsers || []).filter(u => !allUserIds.has(u.id));
  console.log(`\n  ghost 후보 (users 있지만 engineer role 없음): ${ghosts.length}건`);
  console.log(`  최근 created 5건:`);
  for (const g of ghosts.sort((a,b) => (b.created_at||"").localeCompare(a.created_at||"")).slice(0, 10)) {
    // 다른 role 가졌는지 확인
    const { data: gRoles } = await sb.from("user_roles").select("role").eq("user_id", g.id);
    const roleStr = (gRoles || []).map(r => r.role).join(",") || "NONE";
    console.log(`    code=${g.code}  name=${g.name}  phone=${g.phone}  created=${g.created_at?.slice(0,16)}  roles=[${roleStr}]`);
  }
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });
