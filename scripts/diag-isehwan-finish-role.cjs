// 이세환 살리기 finish — user_roles INSERT (직전 commit 실패 보완)
// 2026-05-25
//
// 배경: diag-isehwan-fix.cjs --commit 측 UPDATE users SET code='E030' 까지 성공.
//   이어진 user_roles upsert(onConflict='user_id,role')가 PostgREST 측 PK
//   composite 인식 실패로 에러. user_roles 행이 0건이므로 plain INSERT 안전.

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

const TARGET_ID = "9325dba7-81e7-4f61-aa3b-996c734be853";

function bar(c = "═", n = 100) { return c.repeat(n); }
function sub(s) { console.log("\n" + bar("─")); console.log(s); console.log(bar("─")); }

(async () => {
  console.log(bar());
  console.log("이세환 살리기 finish — user_roles INSERT");
  console.log(bar());

  // 1) 현재 user 행 재확인
  const { data: user } = await sb.from("users").select("id, code, name, phone, password_hash, must_change_password").eq("id", TARGET_ID).maybeSingle();
  sub("현재 users 행");
  console.log(`  code=${user?.code} name=${user?.name} phone=${user?.phone} password=${user?.password_hash ? "SET" : "(NULL)"}`);
  if (!user || user.name !== "이세환") { console.log("❌ 식별 실패 — 중단"); process.exit(1); }
  if (user.code !== "E030") { console.log("❌ code != E030 — 중단 (직전 UPDATE 결과 불일치)"); process.exit(1); }

  // 2) user_roles 현재
  const { data: rolesBefore } = await sb.from("user_roles").select("user_id, role, is_primary").eq("user_id", TARGET_ID);
  sub("user_roles 현황 (INSERT 전)");
  console.log(`  ${(rolesBefore || []).length}건`);
  (rolesBefore || []).forEach(r => console.log(`    · role=${r.role} primary=${r.is_primary}`));

  const hasEngineer = (rolesBefore || []).some(r => r.role === "engineer");
  if (hasEngineer) {
    console.log("  ⚠️  이미 engineer 역할 있음 — INSERT skip");
  } else {
    sub("INSERT user_roles {user_id, 'engineer', is_primary=true}");
    const { error } = await sb.from("user_roles")
      .insert({ user_id: TARGET_ID, role: "engineer", is_primary: true });
    if (error) {
      console.log(`  ❌ INSERT 실패: ${error.message}`);
      process.exit(1);
    }
    console.log("  ✅ INSERT 완료");
  }

  // 3) 검증
  sub("검증");
  const { data: after } = await sb.from("users").select("id, code, name, phone, password_hash, must_change_password").eq("id", TARGET_ID).maybeSingle();
  const { data: roles } = await sb.from("user_roles").select("user_id, role, is_primary").eq("user_id", TARGET_ID);

  const codeOk = after?.code === "E030";
  const pwOk   = !!after?.password_hash;
  const eng    = (roles || []).find(r => r.role === "engineer");
  const engOk  = !!eng && eng.is_primary === true;

  console.log(`  · users.code              : ${after?.code}  ${codeOk ? "✅" : "❌"}`);
  console.log(`  · users.password_hash    : ${pwOk ? "SET ✅" : "(NULL) ❌"}`);
  console.log(`  · users.must_change_password : ${after?.must_change_password}`);
  console.log(`  · user_roles             : ${(roles || []).length}건 — ${(roles || []).map(r => `${r.role}${r.is_primary ? "(primary)" : ""}`).join(", ")}`);
  console.log(`    ${engOk ? "✅" : "❌"} engineer + is_primary=true`);

  // listEngineersFromDb 시뮬레이션
  const { data: engRows } = await sb.from("user_roles").select("user_id").eq("role", "engineer");
  const engineerIds = (engRows || []).map(r => r.user_id);
  const inList = engineerIds.includes(TARGET_ID);
  console.log(`  · listEngineersFromDb 측 잡힘 : ${inList ? "✅ 포함" : "❌ 제외"} (총 engineer ${engineerIds.length}명)`);

  // (tenant_id, code='E030') 단독
  const TENANT_ID = "11111111-1111-1111-1111-111111111111";
  const { data: dup } = await sb.from("users").select("id, code").eq("tenant_id", TENANT_ID).eq("code", "E030");
  const dupOk = (dup || []).length === 1 && dup[0].id === TARGET_ID;
  console.log(`  · (tenant_id, code='E030') UNIQUE : ${dupOk ? "✅ 이세환 단독" : `❌ ${(dup||[]).length}건`}`);

  const allOk = codeOk && pwOk && engOk && inList && dupOk;
  console.log("\n" + bar());
  console.log(allOk ? "✅ 검증 전수 통과" : "❌ 검증 실패");
  console.log(bar());
  process.exit(allOk ? 0 : 1);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
