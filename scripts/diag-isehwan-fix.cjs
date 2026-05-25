// 이세환 살리기 — code 정상화(이세환_mpkruadj → 다음 E###) + engineer 역할 부여
// 2026-05-25
//
// 대상: users.id = 9325dba7-81e7-4f61-aa3b-996c734be853 (phone 010-3077-2388)
// 처리: UPDATE users SET code=<새 E번호> / INSERT user_roles {engineer, is_primary=true}
//
// 사용법:
//   node scripts/diag-isehwan-fix.cjs           # 드라이런
//   node scripts/diag-isehwan-fix.cjs --commit  # 백업 + UPDATE + INSERT + 검증

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

const COMMIT = process.argv.includes("--commit");

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const TARGET_ID = "9325dba7-81e7-4f61-aa3b-996c734be853";
const TARGET_NAME = "이세환";
const TARGET_PHONE = "010-3077-2388";
const CURRENT_CODE = "이세환_mpkruadj";

function bar(c = "═", n = 100) { return c.repeat(n); }
function head(s) { console.log("\n" + bar()); console.log(s); console.log(bar()); }
function sub(s)  { console.log("\n" + bar("─")); console.log(s); console.log(bar("─")); }

async function fetchTarget() {
  const { data, error } = await sb.from("users")
    .select("id, tenant_id, code, name, phone, email, is_active, region, refrigerant_rate, password_hash, must_change_password, created_at")
    .eq("id", TARGET_ID).maybeSingle();
  if (error) throw new Error("target fetch: " + error.message);
  if (!data) throw new Error(`대상 user id=${TARGET_ID} 없음`);
  return data;
}

async function nextEngineerCode() {
  // E### 패턴 — max + 1. zero-pad 3자리.
  const { data, error } = await sb.from("users")
    .select("code")
    .eq("tenant_id", TENANT_ID)
    .like("code", "E___")  // 정확히 E + 3자리 (like 와일드카드 _)
    .order("code", { ascending: false })
    .limit(50);
  if (error) throw new Error("max E### fetch: " + error.message);
  let max = 0;
  for (const r of data || []) {
    const m = String(r.code || "").match(/^E(\d{3})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  const next = max + 1;
  return { max, next, code: `E${String(next).padStart(3, "0")}` };
}

async function codeCollisionCheck(newCode) {
  const { data, error } = await sb.from("users")
    .select("id, code, name")
    .eq("tenant_id", TENANT_ID)
    .eq("code", newCode);
  if (error) throw new Error("collision: " + error.message);
  return data || [];
}

// 옛 code('이세환_mpkruadj')를 참조할 가능성 있는 위치 — tasks는 uuid 기준이지만 안전 확인
async function legacyCodeReferences() {
  // tasks.assigned_engineer_id 는 uuid → 영향 없음. 그래도 혹시 모를 dangling text 컬럼 점검.
  // engineer_rates, user_roles 등은 user_id(uuid) 기준이라 영향 없음.
  // 이 함수는 안전망 — 이상치 보고용.
  const findings = [];
  // tasks 측 assigned_engineer_id (uuid) - 옛 코드 잡힐 일 X 이지만 카운트만
  const { count: byId } = await sb.from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("assigned_engineer_id", TARGET_ID);
  findings.push({ where: "tasks.assigned_engineer_id (uuid)", count: byId ?? 0, note: "uuid 기준 — code 변경 무영향" });
  return findings;
}

async function fetchUserRoles() {
  const { data, error } = await sb.from("user_roles")
    .select("user_id, role, is_primary, principal_id, granted_at")
    .eq("user_id", TARGET_ID);
  if (error) throw new Error("user_roles: " + error.message);
  return data || [];
}

async function backup(target, rolesBefore) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `isehwan-fix-before-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({
    timestamp: new Date().toISOString(),
    note: "이세환 살리기 직전 스냅샷 (code 정상화 + engineer 역할 부여 전)",
    target_id: TARGET_ID,
    users_row: target,
    user_roles: rolesBefore,
  }, null, 2));
  console.log(`  ✅ 백업 저장: ${file}`);
  return file;
}

async function verify({ newCode }) {
  sub("【검증】");
  // 1) users.code = 새 E번호
  const { data: after } = await sb.from("users")
    .select("id, code, name, phone, password_hash, must_change_password")
    .eq("id", TARGET_ID).maybeSingle();
  const codeOk = after?.code === newCode;
  const pwOk   = !!after?.password_hash;
  console.log(`  · users.code              : ${after?.code}  ${codeOk ? "✅" : "❌"}`);
  console.log(`  · users.password_hash     : ${pwOk ? "유지(SET)" : "(NULL) ❌"}  ${pwOk ? "✅" : ""}`);
  console.log(`  · users.must_change_password : ${after?.must_change_password}`);

  // 2) user_roles 에 engineer 1건
  const roles = await fetchUserRoles();
  const hasEngineer = roles.some(r => r.role === "engineer" && r.is_primary);
  console.log(`  · user_roles              : ${roles.length}건  ${roles.map(r => `${r.role}${r.is_primary ? "(primary)" : ""}`).join(", ") || "(없음)"}`);
  console.log(`    ${hasEngineer ? "✅ engineer is_primary=true" : "❌ engineer 역할 missing"}`);

  // 3) listEngineersFromDb 흐름 시뮬레이션
  const { data: engineerRoleRows } = await sb.from("user_roles").select("user_id").eq("role", "engineer");
  const engineerIds = (engineerRoleRows || []).map(r => r.user_id);
  const inList = engineerIds.includes(TARGET_ID);
  console.log(`  · listEngineersFromDb 측 잡힘 : ${inList ? "✅ 포함" : "❌ 제외"} (총 engineer ${engineerIds.length}명)`);

  // 4) (tenant_id, code) 측 한 행만 — UNIQUE 위반 X
  const dup = await codeCollisionCheck(newCode);
  console.log(`  · (tenant_id, code=${newCode}) UNIQUE : ${dup.length === 1 && dup[0].id === TARGET_ID ? "✅ 이세환 단독" : `❌ ${dup.length}건`}`);

  return codeOk && pwOk && hasEngineer && inList && dup.length === 1 && dup[0].id === TARGET_ID;
}

(async () => {
  head(`이세환 살리기 ${COMMIT ? "[--commit 모드]" : "[드라이런]"}`);

  // 1) 현재 행
  sub("【1】 현재 이세환 users 행");
  const target = await fetchTarget();
  console.log(`  id                       : ${target.id}`);
  console.log(`  code (현재)              : ${target.code}`);
  console.log(`  name / phone             : ${target.name} / ${target.phone}`);
  console.log(`  email                    : ${target.email}`);
  console.log(`  is_active                : ${target.is_active}`);
  console.log(`  password_hash            : ${target.password_hash ? "SET" : "(NULL)"}`);
  console.log(`  must_change_password     : ${target.must_change_password}`);
  console.log(`  created_at               : ${target.created_at}`);

  // 식별 검증
  const idOk    = target.id === TARGET_ID;
  const nameOk  = target.name === TARGET_NAME;
  const phoneOk = target.phone === TARGET_PHONE;
  const codeOk  = target.code === CURRENT_CODE;
  console.log(`\n  식별 검증:`);
  console.log(`    ${idOk    ? "✅" : "❌"} id`);
  console.log(`    ${nameOk  ? "✅" : "❌"} name=이세환`);
  console.log(`    ${phoneOk ? "✅" : "❌"} phone=${TARGET_PHONE}`);
  console.log(`    ${codeOk  ? "✅" : "❌"} code=${CURRENT_CODE}`);
  if (!(idOk && nameOk && phoneOk && codeOk)) {
    console.log("\n  ❌ 식별 실패 — 중단");
    process.exit(1);
  }

  // 2) 새 E### 산정
  sub("【2】 새 engineer code 산정 (E### max+1)");
  const { max, next, code: NEW_CODE } = await nextEngineerCode();
  console.log(`  · 현재 최대 E번호     : E${String(max).padStart(3, "0")}`);
  console.log(`  · 다음 E번호 (max+1)  : ${NEW_CODE}`);

  // 3) 충돌 검사
  sub(`【3】 (tenant_id, code=${NEW_CODE}) 충돌 검사`);
  const dups = await codeCollisionCheck(NEW_CODE);
  console.log(`  · 동일 code 행 수     : ${dups.length}`);
  if (dups.length > 0) {
    console.log("  ❌ 충돌 — 중단");
    dups.forEach(d => console.log(`    · id=${d.id} name=${d.name} code=${d.code}`));
    process.exit(1);
  }
  console.log(`  ✅ ${NEW_CODE} 사용 가능`);

  // 4) 옛 code 참조 점검 (안전망)
  sub(`【4】 옛 code '${CURRENT_CODE}' 참조 점검`);
  const refs = await legacyCodeReferences();
  refs.forEach(f => console.log(`  · ${f.where} : ${f.count}건  (${f.note})`));

  // 5) user_roles 재확인
  sub("【5】 user_roles 현황 (engineer 역할 부여 전)");
  const rolesBefore = await fetchUserRoles();
  console.log(`  · 현재 user_roles     : ${rolesBefore.length}건`);
  rolesBefore.forEach(r => console.log(`    · role=${r.role} primary=${r.is_primary} principal=${r.principal_id || "(NULL)"}`));
  if (rolesBefore.length > 0) {
    const hasEng = rolesBefore.some(r => r.role === "engineer");
    console.log(`  · engineer 역할 이미 존재? ${hasEng ? "예 — INSERT skip" : "아니오 — INSERT 진행"}`);
  } else {
    console.log(`  · ✅ 0건 — 사장님 진단 일치, INSERT 진행`);
  }

  // 6) 계획
  sub("【6】 변경 계획");
  console.log(`  · UPDATE users SET code='${NEW_CODE}' WHERE id='${TARGET_ID}'`);
  console.log(`  · INSERT user_roles (user_id, role, is_primary) VALUES ('${TARGET_ID}', 'engineer', true)`);
  console.log(`    └ 이미 engineer 역할 있으면 ON CONFLICT skip`);

  if (!COMMIT) {
    sub("[드라이런 종료]");
    console.log("  · 위 내용 확인 후 --commit 으로 재실행");
    return;
  }

  // --commit
  sub("【백업】");
  await backup(target, rolesBefore);

  sub("【UPDATE users SET code】");
  const { error: updErr } = await sb.from("users")
    .update({ code: NEW_CODE })
    .eq("id", TARGET_ID);
  if (updErr) {
    console.log(`  ❌ UPDATE 실패: ${updErr.message}`);
    process.exit(1);
  }
  console.log(`  ✅ users.code: '${CURRENT_CODE}' → '${NEW_CODE}'`);

  sub("【INSERT user_roles {engineer, is_primary=true}】");
  // 2026-05-25 — supabase-js upsert(onConflict='user_id,role')가 PostgREST 측
  //   composite PK 인식 실패. user_roles 측 (user_id, role) PRIMARY KEY 존재하지만 별도 처리.
  //   사전에 rolesBefore 측 engineer 행 존재 여부 확인 후 분기.
  const alreadyEngineer = rolesBefore.some(r => r.role === "engineer");
  if (alreadyEngineer) {
    console.log("  · engineer 역할 이미 있음 — INSERT skip");
  } else {
    const { error: roleErr } = await sb.from("user_roles")
      .insert({ user_id: TARGET_ID, role: "engineer", is_primary: true });
    if (roleErr) {
      console.log(`  ❌ user_roles INSERT 실패: ${roleErr.message}`);
      process.exit(1);
    }
    console.log(`  ✅ user_roles {user_id, 'engineer', primary=true}`);
  }

  // 검증
  const allOk = await verify({ newCode: NEW_CODE });
  console.log("\n" + bar());
  console.log(allOk ? "✅ 검증 전수 통과" : "❌ 검증 실패 — 위 항목 점검");
  console.log(bar());
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
